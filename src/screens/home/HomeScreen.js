import React, { useState, useEffect, useMemo } from 'react';
import { capitalizeFirst } from '../../utils/text';
import {
  View, Text, FlatList, TouchableOpacity, Alert,
  StyleSheet, RefreshControl, Modal, Linking, Platform,
  TouchableWithoutFeedback, Image, AppState,
} from 'react-native';
import * as Notifications from 'expo-notifications';


const GENRE_IMAGES = {
  homme: require('../../../assets/icons/homme.png'),
  femme: require('../../../assets/icons/femme.png'),
  enfant: require('../../../assets/icons/enfant.png'),
};
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import * as Location from 'expo-location';
import apiClient from '../../lib/api/apiClient';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '../../utils/theme';
import { useTranslation } from 'react-i18next';
import { JanazaShareModal } from '../declare/AnnouncementGenerator';

function useGenreLabel() {
  const { t } = useTranslation();
  return (genre) => ({ homme: t('home.male'), femme: t('home.female'), enfant: t('home.child') }[genre] ?? genre);
}


const LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA' };

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(date, locale) {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date, locale, t) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return t('home.today');
  if (date.toDateString() === tomorrow.toDateString()) return t('home.tomorrow');
  const label = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupJanazasByDate(janazas, locale, t) {
  const groups = [];
  const seen = {};
  for (const j of janazas) {
    const key = j.dateHeure.toDateString();
    if (!seen[key]) {
      seen[key] = { label: formatDate(j.dateHeure, locale, t), items: [] };
      groups.push(seen[key]);
    }
    seen[key].items.push(j);
  }
  return groups;
}

function distKm(coords, item) {
  if (coords?.latitude != null && coords?.longitude != null) {
    return haversineKm(coords.latitude, coords.longitude, item.latitude, item.longitude);
  }
  return null;
}

const STATUS_COLORS = {
  a_venir: colors.accent,
  en_cours: colors.success,
  terminee: colors.textMuted,
};

function StatusBadge({ statut }) {
  const { t } = useTranslation();
  const statusLabels = {
    a_venir: t('home.status_upcoming'),
    en_cours: t('home.status_ongoing'),
    terminee: t('home.status_completed'),
  };
  const label = statusLabels[statut] ?? statusLabels.a_venir;
  const color = STATUS_COLORS[statut] ?? STATUS_COLORS.a_venir;
  return (
    <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '55' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Grouped mosque card ────────────────────────────────────────────────────────
function MosqueCard({ group, coords, onPressJanaza, currentUserId, currentUserRole, onDelete, isSubscribed }) {
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language?.split('-')[0]] ?? 'fr-FR';
  const isAr = i18n.language?.startsWith('ar');
  const fmtNum = (n) => isAr ? n.toLocaleString('ar-SA') : String(n);
  const fmtDist = (d) => isAr
    ? d.toLocaleString('ar-SA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : d.toFixed(1);
  const getGenreLabel = useGenreLabel();
  const d = distKm(coords, group);
  const earliest = group.janazas[0];
  const [reminder, setReminder] = useState(null);
  const [shareItem, setShareItem] = useState(null);

  const prayerTime = earliest.dateHeure instanceof Date ? earliest.dateHeure : new Date(earliest.dateHeure);
  const prayerMs = isNaN(prayerTime.getTime()) ? 0 : prayerTime.getTime();
  const reminderIsActive = reminder != null;
  const allSameDay = group.janazas.every(j => j.dateHeure.toDateString() === group.janazas[0].dateHeure.toDateString());
  const dateGroups = groupJanazasByDate(group.janazas, locale, t);


  async function toggleReminder() {
    try {
      if (reminder && reminder.prayerMs === prayerMs) {
        // Same prayer time → toggle off (cancel)
        await Notifications.cancelScheduledNotificationAsync(reminder.id);
        setReminder(null);
        return;
      }

      // Cancel any stale reminder for a different (outdated) prayer time
      if (reminder) {
        await Notifications.cancelScheduledNotificationAsync(reminder.id).catch(() => {});
        setReminder(null);
      }

      const { status } = await Notifications.getPermissionsAsync();
      let finalStatus = status;
      if (status !== 'granted') {
        const { status: asked } = await Notifications.requestPermissionsAsync();
        finalStatus = asked;
      }
      if (finalStatus !== 'granted') {
        Alert.alert(t('home.notification_disabled'), t('home.notification_disabled'));
        return;
      }

      const reminderTime = new Date(prayerMs - 30 * 60 * 1000);
      if (reminderTime <= new Date()) {
        Alert.alert(t('home.too_late'), t('home.too_late_message'));
        return;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Salat al-Janaza — ${group.mosquee}`,
          body: t('home.notification_body', { count: group.janazas.length, address: group.adresse }),
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderTime,
        },
      });
      setReminder({ id, prayerMs });
      Alert.alert(t('home.reminder_activated'), t('home.reminder_activated_message', { mosque: group.mosquee }));
    } catch (e) {
      Alert.alert(t('home.reminder_error'), e?.message ?? t('home.reminder_error_message'));
    }
  }

  return (
    <View style={styles.card}>
      {/* Mosque header */}
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.mosquee}>{capitalizeFirst(group.mosquee)}</Text>
          <Text style={styles.adresse} numberOfLines={1}>{group.adresse}</Text>
        </View>
        <View style={styles.distPill}>
          <Ionicons name="location-outline" size={11} color="#C97070" />
          <Text style={styles.distText}>{d != null ? `${fmtDist(d)} ${t('home.km_suffix')}` : '—'}</Text>
        </View>
      </View>

      {/* Date label */}
      <View style={styles.dateLabelRow}>
        <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
        {allSameDay ? (
          <>
            <Text style={styles.dateLabel}>{formatDate(earliest.dateHeure, locale, t)}</Text>
            <Text style={styles.janazaCountLabel}>
              · {fmtNum(group.janazas.length)} {group.janazas.length > 1 ? t('home.prayer_plural') : t('home.prayer_singular')}
            </Text>
          </>
        ) : (
          <Text style={styles.janazaCountLabel}>
            {fmtNum(group.janazas.length)} {t('home.prayer_plural')}
          </Text>
        )}
      </View>

      <View style={styles.divider} />

      {/* Janaza rows — grouped by date when multi-day */}
      {dateGroups.map((dateGroup) => (
        <View key={dateGroup.label}>
          {!allSameDay && (
            <View style={styles.dateSubHeaderRow}>
              <Ionicons name="calendar-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.dateSubHeader}>
                {dateGroup.label} · {fmtNum(dateGroup.items.length)} {dateGroup.items.length > 1 ? t('home.prayer_plural') : t('home.prayer_singular')}
              </Text>
            </View>
          )}
          {dateGroup.items.map((item, i) => {
            const genreLabel = getGenreLabel(item.genre);
            const nom = item.estAnonyme ? t('home.anonymous') : (item.nomDefunt || t('home.not_specified'));
            const canDelete = (currentUserId != null && item.utilisateurId != null && Number(currentUserId) === Number(item.utilisateurId)) || currentUserRole === 'admin' || currentUserRole === 'superadmin';
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.janazaRow, i > 0 && styles.janazaRowBorder]}
                onPress={() => onPressJanaza(item)}
                activeOpacity={0.65}
              >
                <View style={styles.janazaTimePill}>
                  <Text style={styles.janazaTime}>{formatTime(item.dateHeure, locale)}</Text>
                </View>
                <Image source={GENRE_IMAGES[item.genre]} style={styles.janazaGenreImg} resizeMode="contain" />
                <View style={styles.janazaInfo}>
                  <Text style={styles.janazaNom} numberOfLines={1}>{nom}</Text>
                  <Text style={styles.janazaGenre}>{genreLabel}</Text>
                </View>
                <StatusBadge statut={item.statut} />
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); setShareItem({ ...item, mosquee: group.mosquee, adresse: group.adresse }); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.6}
                  style={{ marginLeft: 4 }}
                >
                  <Ionicons name="share-social-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
                {canDelete ? (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.error} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={15} color={colors.border} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <JanazaShareModal
        visible={shareItem !== null}
        onClose={() => setShareItem(null)}
        janaza={shareItem}
      />

      {/* Footer */}
      <View style={styles.cardFooter}>
        {isSubscribed ? (
          <View style={[styles.notifBtn, styles.notifBtnActive]}>
            <Ionicons name="notifications" size={13} color={colors.white} />
            <Text style={[styles.notifBtnText, styles.notifBtnTextActive]}>
              {t('home.reminder_auto')}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.notifBtn, reminderIsActive && styles.notifBtnActive]}
            onPress={toggleReminder}
            activeOpacity={0.7}
          >
            <Ionicons
              name={reminderIsActive ? 'notifications' : 'notifications-outline'}
              size={13}
              color={reminderIsActive ? colors.white : colors.primary}
            />
            <Text style={[styles.notifBtnText, reminderIsActive && styles.notifBtnTextActive]}>
              {reminderIsActive ? t('home.reminder_set') : t('home.reminder_not_set')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Detail modal (unchanged logic) ────────────────────────────────────────────
function DetailModal({ item, coords, user, onClose, onDelete }) {
  const { t, i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language?.split('-')[0]] ?? 'fr-FR';
  const isAr = i18n.language?.startsWith('ar');
  const fmtDist = (d) => isAr
    ? d.toLocaleString('ar-SA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : d.toFixed(1);
  const getGenreLabel = useGenreLabel();
  const genreLabel = getGenreLabel(item.genre);
  const nomAffiche = item.estAnonyme ? t('home.anonymous') : (item.nomDefunt || t('home.not_specified'));
  const canDelete = user?.email === item.declarantEmail || user?.isAdmin;
  const d = distKm(coords, item);

  async function copyAddress() {
    await Clipboard.setStringAsync(item.adresse);
  }

  function openDirections() {
    const nativeUrl =
      Platform.OS === 'ios'
        ? `maps:${item.latitude},${item.longitude}?q=${encodeURIComponent(item.mosquee)}`
        : `geo:${item.latitude},${item.longitude}?q=${encodeURIComponent(item.mosquee)}`;
    Linking.openURL(nativeUrl).catch(() =>
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`
      )
    );
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalMosquee} numberOfLines={2}>{capitalizeFirst(item.mosquee)}</Text>
            <StatusBadge statut={item.statut} />
          </View>
          <View style={styles.modalMetaRow}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.modalMeta}>
              {formatDate(item.dateHeure, locale, t)} · {formatTime(item.dateHeure, locale)}
            </Text>
            {d != null && (
              <>
                <Ionicons name="location-outline" size={13} color={colors.textMuted} style={{ marginLeft: spacing.sm }} />
                <Text style={styles.modalMeta}>{fmtDist(d)} {t('home.km_suffix')}</Text>
              </>
            )}
          </View>

          <View style={styles.modalInfoBox}>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t('home.detail_genre')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.modalGenreImgBox}>
                  <Image source={GENRE_IMAGES[item.genre]} style={styles.modalGenreImg} resizeMode="contain" />
                </View>
                <Text style={styles.modalValue}>{genreLabel}</Text>
              </View>
            </View>
            <View style={[styles.modalRow, styles.modalRowTop]}>
              <Text style={styles.modalLabel}>{t('home.detail_deceased')}</Text>
              <Text style={[styles.modalValue, item.estAnonyme && styles.modalValueMuted]}>
                {nomAffiche}
              </Text>
            </View>
            {!!item.commentaire && (
              <View style={[styles.modalRow, styles.modalRowTop, { alignItems: 'flex-start' }]}>
                <Text style={styles.modalLabel}>{t('home.detail_info')}</Text>
                <Text style={[styles.modalValue, { flex: 1, textAlign: 'right' }]}>
                  {item.commentaire}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="business-outline" size={15} color={colors.textMuted} />
            <Text style={styles.addressText} numberOfLines={2}>{item.adresse}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={copyAddress} activeOpacity={0.7}>
              <Ionicons name="copy-outline" size={14} color={colors.primary} />
              <Text style={styles.copyBtnText}>{t('home.copy')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.directionsBtn} onPress={openDirections} activeOpacity={0.8}>
            <Ionicons name="navigate" size={18} color={colors.white} />
            <Text style={styles.directionsBtnText}>{t('home.directions')}</Text>
          </TouchableOpacity>

          {canDelete && (
            <TouchableOpacity
              style={styles.deleteModalBtn}
              onPress={() => { onDelete(item.id); onClose(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteModalBtnText}>{t('home.delete_prayer')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>{t('home.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const apiUser = useSelector((state) => state.auth.apiUser);
  const apiUserId = useSelector((state) => state.auth.apiUser?.id);
  const isGuest = useSelector((state) => state.auth.isGuest);
  const items = useSelector((state) => state.janazas.list);
  const subscriptions = useSelector((state) => state.mosques.subscriptions);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homeCoords, setHomeCoords] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);

  useEffect(() => {
    if (!apiUser?.adresseDomicile) { setHomeCoords(null); return; }
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(apiUser.adresseDomicile)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'QabrApp/1.0' } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data[0]) setHomeCoords({ latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) });
        else setHomeCoords(null);
      })
      .catch(() => setHomeCoords(null));
  }, [apiUser?.adresseDomicile]);

  async function refreshGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {}
  }

  // Charger les abonnements au montage pour que isSubscribed soit correct
  useEffect(() => {
    if (!apiUserId) return;
    apiClient.get(`/api/abonnement/utilisateur/${apiUserId}`)
      .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
      .catch(() => {});
  }, [apiUserId]);

  useEffect(() => {
    AsyncStorage.getItem('home_info_seen').then(seen => {
      if (seen) return;
      const timer = setTimeout(() => {
        Alert.alert(t('home.title'), t('home.subtitle'));
        AsyncStorage.setItem('home_info_seen', '1');
      }, 500);
      return () => clearTimeout(timer);
    });
  }, []);

  // Polling toutes les 5 min quand l'app est au premier plan
  useEffect(() => {
    const POLL_MS = 5 * 60 * 1000;
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      dispatch({ type: 'FORCE_DATA_REFRESH' });
      apiClient.get('/api/prierejanaza/upcoming')
        .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
        .catch(() => {});
      if (apiUserId) {
        apiClient.get(`/api/abonnement/utilisateur/${apiUserId}`)
          .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
          .catch(() => {});
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [apiUserId]);

  // Fallback GPS quand pas d'adresse domicile
  useEffect(() => {
    if (apiUser?.adresseDomicile) return;
    refreshGps();
  }, [apiUser?.adresseDomicile]);


  const activeCoords = homeCoords ?? gpsCoords;

  // Auto-expire 2h after prayer time
  useEffect(() => {
    dispatch({ type: 'JANAZA_EXPIRE' });
    const timer = setInterval(() => dispatch({ type: 'JANAZA_EXPIRE' }), 60_000);
    return () => clearInterval(timer);
  }, []);

  const subscribedMosqueeIds = useMemo(() => new Set(
    subscriptions.map(s => s.mosqueeId).filter(Boolean)
  ), [subscriptions]);

  // Filter by radius then group by mosque, sorted by nearest first (or by prayer time if no coords)
  const groups = useMemo(() => {
    const rayon = apiUser?.rayonNotification ?? 5;

    const filtered = activeCoords
      ? items.filter((item) => {
          if (subscribedMosqueeIds.has(String(item.mosqueeId))) return true;
          return haversineKm(activeCoords.latitude, activeCoords.longitude, item.latitude, item.longitude) <= rayon;
        })
      : items;

    const map = {};
    filtered.forEach((item) => {
      if (!map[item.mosqueeId]) {
        map[item.mosqueeId] = {
          mosqueeId: item.mosqueeId,
          mosquee: item.mosquee,
          adresse: item.adresse,
          latitude: item.latitude,
          longitude: item.longitude,
          janazas: [],
        };
      }
      map[item.mosqueeId].janazas.push(item);
    });
    return Object.values(map)
      .map((g) => ({ ...g, janazas: g.janazas.sort((a, b) => a.dateHeure - b.dateHeure) }))
      .sort((a, b) => {
        if (activeCoords) {
          const dA = haversineKm(activeCoords.latitude, activeCoords.longitude, a.latitude, a.longitude);
          const dB = haversineKm(activeCoords.latitude, activeCoords.longitude, b.latitude, b.longitude);
          return dA - dB;
        }
        return a.janazas[0].dateHeure - b.janazas[0].dateHeure;
      });
  }, [items, apiUser?.rayonNotification, activeCoords, subscribedMosqueeIds]);

  async function onRefresh() {
    setRefreshing(true);
    if (!apiUser?.adresseDomicile) await refreshGps();
    const requests = [
      apiClient.get('/api/prierejanaza/upcoming')
        .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data })),
    ];
    if (apiUserId) {
      requests.push(
        apiClient.get(`/api/prierejanaza/utilisateur/${apiUserId}`)
          .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
      );
      requests.push(
        apiClient.get(`/api/abonnement/utilisateur/${apiUserId}`)
          .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
      );
    }
    Promise.all(requests)
      .catch(() => {})
      .finally(() => {
        dispatch({ type: 'JANAZA_EXPIRE' });
        setRefreshing(false);
      });
  }

  function handleDelete(id) {
    Alert.alert(
      t('home.delete_title'),
      t('home.delete_message'),
      [
        { text: t('home.delete_cancel'), style: 'cancel' },
        {
          text: t('home.delete_confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/prierejanaza/${id}`);
            } catch {}
            dispatch({ type: 'JANAZA_DELETE', payload: { id } });
            dispatch({ type: 'FORCE_DATA_REFRESH' });
            apiClient.get('/api/prierejanaza/upcoming')
              .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
              .catch(() => {});
            if (apiUser?.id) {
              apiClient.get(`/api/prierejanaza/utilisateur/${apiUser.id}`)
                .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
                .catch(() => {});
            }
          },
        },
      ]
    );
  }

  const rayon = apiUser?.rayonNotification ?? 5;
  const inRadiusCount = activeCoords
    ? groups.filter(g => haversineKm(activeCoords.latitude, activeCoords.longitude, g.latitude, g.longitude) <= rayon).length
    : groups.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.headerTitle}>{t('home.title')}</Text>
          <TouchableOpacity onPress={() => Alert.alert(t('home.title'), t('home.subtitle'))} activeOpacity={0.7}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        {(() => { const count = groups.reduce((sum, g) => sum + g.janazas.length, 0); return (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{count} {count <= 1 ? t('home.prayer_singular') : t('home.prayer_plural')}</Text>
          </View>
        ); })()}
      </View>

      {apiUser?.adresseDomicile ? (
        <View style={styles.radiusStrip}>
          <Ionicons name="location-outline" size={14} color={colors.primary} />
          <Text style={styles.radiusStripText} numberOfLines={1}>
            {inRadiusCount} {inRadiusCount <= 1 ? t('home.mosque_singular') : t('home.mosque_plural')}
          </Text>
          <View style={styles.radiusStripBadge}>
            <Text style={styles.radiusStripBadgeText}>{rayon} km</Text>
          </View>
        </View>
      ) : (
        <View style={styles.addressBanner}>
          <Ionicons name="location-outline" size={16} color={colors.warning} />
          <Text style={styles.addressBannerText}>
            {t('home.address_banner', { profile: t('home.profile_link') })}
          </Text>
        </View>
      )}

      <FlatList
        data={groups}
        keyExtractor={(g) => g.mosqueeId}
        renderItem={({ item: group }) => (
          <MosqueCard group={group} coords={activeCoords} onPressJanaza={setSelected} currentUserId={apiUserId} currentUserRole={user?.role} onDelete={handleDelete} isSubscribed={subscribedMosqueeIds.has(String(group.mosqueeId))} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🤲</Text>
            <Text style={styles.emptyText}>{t('home.empty')}</Text>
          </View>
        }
      />

      {selected && (
        <DetailModal
          item={selected}
          coords={activeCoords}
          user={user}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flex: 1 },
  headerSub: { ...typography.caption, flexShrink: 1 },

  addressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(180, 83, 9, 0.07)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(180, 83, 9, 0.20)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  addressBannerText: {
    ...typography.bodySmall,
    color: colors.warning,
    flex: 1,
    lineHeight: 18,
  },
  addressBannerLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  radiusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.primaryDim,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  radiusStripText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  radiusStripBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  radiusStripBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },

  headerBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBadgeText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  list: { padding: spacing.lg, gap: spacing.md },

  // ── Card ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  cardTopLeft: { flex: 1, marginRight: spacing.sm },
  mosquee: { ...typography.h3, marginBottom: 2 },
  adresse: { ...typography.bodySmall },
  distPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },
  distText: { fontSize: 11, color: '#C97070', fontWeight: '600' },

  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  dateLabel: { ...typography.caption, color: colors.textSecondary },
  janazaCountLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  divider: { height: 1, backgroundColor: colors.borderLight, marginHorizontal: spacing.md },
  dateSubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  dateSubHeader: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', fontSize: 11 },

  // ── Janaza rows ──
  janazaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  janazaRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  janazaTimePill: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    minWidth: 52,
    alignItems: 'center',
  },
  janazaTime: { fontSize: 13, fontWeight: '700', color: colors.primary },
  janazaGenreImg: { width: 64, height: 64 },
  modalGenreImgBox: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDim,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalGenreImg: { width: 44, height: 44 },
  janazaInfo: { flex: 1 },
  janazaNom: { ...typography.body, fontWeight: '600', fontSize: 14 },
  janazaGenre: { ...typography.caption },

  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },

  // ── Card footer ──
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  notifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  notifBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  notifBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  notifBtnTextActive: { color: colors.white },

  // ── Modal ──
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  modalHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalMosquee: { ...typography.h3, flex: 1 },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.lg,
  },
  modalMeta: { ...typography.bodySmall },
  modalInfoBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  modalRowTop: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  modalLabel: { ...typography.label },
  modalValue: { ...typography.body, fontWeight: '600' },
  modalValueMuted: { color: colors.textMuted, fontStyle: 'italic' },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  addressText: { ...typography.bodySmall, flex: 1 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryDim,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  copyBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  directionsBtnText: { ...typography.button },
  deleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: spacing.sm,
  },
  deleteModalBtnText: { color: colors.error, fontWeight: '600', fontSize: 15 },
  closeBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  closeBtnText: { ...typography.body, color: colors.textMuted },

  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
