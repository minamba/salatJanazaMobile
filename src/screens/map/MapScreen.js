import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { capitalizeFirst } from '../../utils/text';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Modal,
  TouchableWithoutFeedback, ScrollView, RefreshControl,
  Linking, Platform, TextInput, KeyboardAvoidingView, Keyboard, Image,
  Animated, Alert,
} from 'react-native';

const MOSQUE_PIN_IMG = require('../../../assets/icons/mosquee.png');
const MOSQUE_ICON_IMG = require('../../../assets/icons/mosquee_icon.png');
const USER_PIN_IMG = require('../../../assets/icons/pin.png');
const GENRE_IMAGES = {
  homme: require('../../../assets/icons/homme.png'),
  femme: require('../../../assets/icons/femme.png'),
  enfant: require('../../../assets/icons/enfant.png'),
};
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import { JanazaShareModal } from '../declare/AnnouncementGenerator';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '../../utils/theme';
import { normalize, fetchNearbyMosques, enrichAddresses } from '../../utils/mosqueSearch';
import apiClient from '../../lib/api/apiClient';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

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

function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA' };

// ── Components ─────────────────────────────────────────────────────────────────
function ModeToggle({ value, onToggle }) {
  const anim = useRef(new Animated.Value(value === 'home' ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value === 'home' ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 8,
    }).start();
  }, [value]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.accent, colors.primary],
  });
  const thumbX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 29],
  });

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
      <Animated.View style={[styles.toggleTrack, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.toggleThumb, { transform: [{ translateX: thumbX }] }]}>
          <Ionicons
            name={value === 'home' ? 'home' : 'navigate'}
            size={13}
            color={value === 'home' ? colors.primary : colors.accent}
          />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function GpsPermissionModal({ onClose }) {
  const { t } = useTranslation();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.gpsModalOverlay}>
        <View style={styles.gpsModalBox}>
          <View style={styles.gpsModalIconCircle}>
            <Ionicons name="location" size={36} color={colors.primary} />
          </View>
          <Text style={styles.gpsModalTitle}>{t('map.gps_title')}</Text>
          <Text style={styles.gpsModalText}>{t('map.gps_message')}</Text>
          <TouchableOpacity
            style={styles.gpsModalPrimaryBtn}
            onPress={() => { Linking.openSettings(); onClose(); }}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={16} color={colors.white} />
            <Text style={styles.gpsModalPrimaryBtnText}>{t('map.gps_settings')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gpsModalSecondaryBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.gpsModalSecondaryBtnText}>{t('map.gps_later')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function MosqueCard({ mosque, distKm, subscribed, janazaCount, onToggle, onPress, showSubscribe, showUserBadge }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.mosqueCard} activeOpacity={0.7} onPress={() => onPress(mosque)}>
      <View style={styles.mosqueInfo}>
        <View style={styles.mosqueNameRow}>
          <Text style={styles.mosqueName} numberOfLines={1}>{capitalizeFirst(mosque.nom)}</Text>
          {showUserBadge && mosque.source === 'user' && (
            <View style={styles.userAddedBadge}>
              <Text style={styles.userAddedBadgeText}>{t('map.user_badge')}</Text>
            </View>
          )}
          {janazaCount > 0 && (
            <View style={styles.janazaBadge}>
              <Text style={styles.janazaBadgeText}>{janazaCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.mosqueAddress} numberOfLines={1}>
          {mosque.adresse || t('map.no_address')}
        </Text>
        <View style={styles.mosqueDistRow}>
          <Ionicons name="location-outline" size={12} color="#C97070" />
          <Text style={styles.mosqueDistance}>
            {distKm != null ? `${distKm.toFixed(1)} km` : '— km'}
          </Text>
        </View>
      </View>
      {showSubscribe && (
        <TouchableOpacity
          style={[styles.subscribeBtn, subscribed && styles.subscribeBtnActive]}
          onPress={() => onToggle(mosque.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={subscribed ? 'notifications' : 'add'}
            size={14}
            color={subscribed ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.subscribeBtnText, subscribed && styles.subscribeBtnTextActive]}>
            {subscribed ? t('map.subscribed') : t('map.subscribe')}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function SmartMarker({ children, ...props }) {
  return (
    <Marker {...props} tracksViewChanges={true}>
      {children}
    </Marker>
  );
}

function JanazaMapPin({ count }) {
  return (
    <View style={styles.pinWrapper}>
      <View style={styles.pinImgWrapper}>
        <View style={styles.pinCircle}>
          <Image source={MOSQUE_PIN_IMG} style={styles.pinImg} resizeMode="contain" />
        </View>
        <View style={styles.pinBadge}>
          <Text style={styles.pinBadgeText}>{count}</Text>
        </View>
      </View>
    </View>
  );
}

export function MosqueDetailModal({ mosque, distKm, janazas, onClose, onShare, onDelete, currentUserId, currentUserRole, subscribed, onToggleSubscribe, showSubscribe }) {
  const { t, i18n } = useTranslation();
  const dateLocale = LOCALE_MAP[i18n.language] ?? 'fr-FR';

  function formatDateLabel(date) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return t('home.today');
    if (date.toDateString() === tomorrow.toDateString()) return t('home.tomorrow');
    return date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function groupByDate(list) {
    const groups = [];
    const seen = {};
    for (const j of list) {
      const key = j.dateHeure.toDateString();
      if (!seen[key]) {
        seen[key] = { date: j.dateHeure, label: formatDateLabel(j.dateHeure), items: [] };
        groups.push(seen[key]);
      }
      seen[key].items.push(j);
    }
    return groups;
  }

  const sortedJanazas = (janazas ?? []).slice().sort((a, b) => a.dateHeure - b.dateHeure);

  async function copyAddress() {
    if (mosque.adresse) await Clipboard.setStringAsync(mosque.adresse);
  }

  function openNavigation() {
    const label = encodeURIComponent(mosque.nom);
    const nativeUrl =
      Platform.OS === 'ios'
        ? `maps:${mosque.latitude},${mosque.longitude}?q=${label}`
        : `geo:${mosque.latitude},${mosque.longitude}?q=${label}`;
    Linking.openURL(nativeUrl).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${mosque.latitude},${mosque.longitude}`)
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

          <View style={styles.modalMosqueHeader}>
            <View style={styles.modalMosqueIcon}>
              <Image source={MOSQUE_ICON_IMG} style={styles.modalMosqueIconImg} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalMosqueName}>{capitalizeFirst(mosque.nom)}</Text>
              {!!mosque.adresse && (
                <Text style={styles.modalMosqueAddress}>{mosque.adresse}</Text>
              )}
              {distKm != null && (
                <Text style={styles.modalMosqueDist}>
                  📍 {distKm.toFixed(1)} km
                </Text>
              )}
            </View>
          </View>

          {!!mosque.adresse && (
            <View style={styles.addressRow}>
              <Ionicons name="business-outline" size={15} color={colors.textMuted} />
              <Text style={styles.addressText} numberOfLines={2}>{mosque.adresse}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={copyAddress} activeOpacity={0.7}>
                <Ionicons name="copy-outline" size={14} color={colors.primary} />
                <Text style={styles.copyBtnText}>{t('map.copy')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.navBtn} onPress={openNavigation} activeOpacity={0.8}>
            <Ionicons name="navigate" size={18} color={colors.white} />
            <Text style={styles.navBtnText}>{t('map.directions')}</Text>
          </TouchableOpacity>

          {showSubscribe && (
            <TouchableOpacity
              style={[styles.subscribeModalBtn, subscribed && styles.subscribeModalBtnActive]}
              onPress={onToggleSubscribe}
              activeOpacity={0.8}
            >
              <Ionicons
                name={subscribed ? 'notifications' : 'notifications-outline'}
                size={18}
                color={subscribed ? colors.textMuted : colors.primary}
              />
              <Text style={[styles.subscribeModalBtnText, subscribed && styles.subscribeModalBtnTextActive]}>
                {subscribed ? t('map.subscribed') : t('map.subscribe')}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.modalDivider} />

          {sortedJanazas.length === 0 ? (
            <View style={styles.emptyJanazaBox}>
              <Text style={styles.emptyJanazaEmoji}>🤲</Text>
              <Text style={styles.emptyJanazaText}>{t('map.no_prayers')}</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {groupByDate(sortedJanazas).map((group) => (
                <View key={group.label}>
                  <Text style={styles.modalSectionTitle}>
                    {t(group.items.length <= 1 ? 'map.prayer_count' : 'map.prayer_count_plural', { count: group.items.length, date: group.label })}
                  </Text>
                  {group.items.map((j, i) => {
                    const genreLabels = { homme: t('home.male'), femme: t('home.female'), enfant: t('home.child') };
                    const nom = j.estAnonyme ? t('home.anonymous') : (j.nomDefunt || t('home.not_specified'));
                    const canDelete = onDelete && (
                      (currentUserId != null && j.utilisateurId != null && Number(currentUserId) === Number(j.utilisateurId))
                      || currentUserRole === 'admin' || currentUserRole === 'superadmin'
                    );
                    return (
                      <View key={j.id} style={[styles.janazaRow, i > 0 && styles.janazaRowBorder]}>
                        <View style={styles.janazaTimeBox}>
                          <Text style={styles.janazaTime}>{formatTime(j.dateHeure)}</Text>
                        </View>
                        <Image source={GENRE_IMAGES[j.genre]} style={styles.janazaGenreImg} resizeMode="contain" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.janazaNom}>{nom}</Text>
                          <Text style={styles.janazaGenreLabel}>{genreLabels[j.genre]}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => onShare?.({ ...j, mosquee: mosque.nom, adresse: mosque.adresse })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.6}
                          style={{ marginLeft: 4 }}
                        >
                          <Ionicons name="share-social-outline" size={17} color={colors.primary} />
                        </TouchableOpacity>
                        {canDelete && (
                          <TouchableOpacity
                            onPress={() => onDelete(j.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="trash-outline" size={17} color={colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>{t('map.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function normalizeAccents(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Contrôle minimal : bloque les saisies évidemment trop courtes/incomplètes.
// On ne cherche pas à deviner le format du pays — Nominatim + addressdetails s'en charge.
function looksLikeEnoughToGeocode(text) {
  const t = text.trim();
  if (t.length < 8) return false;                                   // trop court
  const tokens = t.split(/[\s,،、।]+/).filter((w) => w.length > 0);
  return tokens.length >= 3;                                         // au moins 3 mots/parties
}

function formatNom(raw) {
  const text = raw.trim();
  if (!text) return text;
  const norm = normalizeAccents(text);
  if (norm.startsWith('mosquee')) {
    const m = text.match(/^mosqu[eéèê]{1,2}/i);
    const rest = m ? text.slice(m[0].length) : text.slice(7);
    return 'Mosquée' + rest;
  }
  if (norm.startsWith('salle de priere')) {
    const m = text.match(/^salle\s+de\s+pri[eèéê]re/i);
    const rest = m ? text.slice(m[0].length) : text.slice(15);
    return 'Salle de prière' + rest;
  }
  return text;
}

function hasValidPrefix(text) {
  const norm = normalizeAccents(text.trim());
  return norm.startsWith('mosquee') || norm.startsWith('salle de priere');
}

function AddMosqueModal({ onAdd, onClose }) {
  const { t } = useTranslation();
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [coords, setCoords] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nomError, setNomError] = useState('');
  const [adresseError, setAdresseError] = useState('');
  const debounceRef = useRef(null);

  function handleAdresseChange(text) {
    setAdresse(text);
    setCoords(null);
    setAdresseError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => fetchSugg(text), 500);
  }

  async function fetchSugg(query) {
    setLoadingSugg(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { 'User-Agent': 'QabrApp/1.0' } }
      );
      setSuggestions(await res.json());
    } catch { setSuggestions([]); }
    finally { setLoadingSugg(false); }
  }

  function selectSuggestion(item) {
    setAdresse(item.display_name);
    setCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
    setSuggestions([]);
    setAdresseError('');
    Keyboard.dismiss();
  }

  async function handleAdd() {
    let hasError = false;

    // Validate + format nom
    const formatted = formatNom(nom);
    if (!formatted || !hasValidPrefix(formatted)) {
      setNomError(t('map.add_name_error'));
      hasError = true;
    } else {
      setNomError('');
      setNom(formatted);
    }

    // Validate adresse
    let finalCoords = coords; // défini si suggestion sélectionnée
    if (!adresse.trim()) {
      setAdresseError(t('map.add_address_required'));
      hasError = true;
    } else if (!finalCoords) {
      // Pas de suggestion sélectionnée → valider le format avant d'appeler Nominatim
      if (!looksLikeEnoughToGeocode(adresse)) {
        setAdresseError(t('map.add_address_incomplete'));
        hasError = true;
      } else {
        // Format suffisant → on vérifie avec Nominatim + addressdetails
        setSaving(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse.trim())}&format=json&limit=1&addressdetails=1`,
            { headers: { 'User-Agent': 'QabrApp/1.0' } }
          );
          const data = await res.json();
          if (data[0]) {
            const addr = data[0].address ?? {};
            // Voie / rue / zone nommée (FR/US/BR/KR/JP/CN/AR/DE/UK/IN...)
            const hasWay = !!(
              addr.road || addr.pedestrian || addr.footway || addr.path ||
              addr.cycleway || addr.street || addr.quarter || addr.neighbourhood ||
              addr.hamlet || addr.house_number || addr.building || addr.amenity ||
              addr.locality || addr.place
            );
            // Localité — ville, district, état, gouvernorat... (tous pays)
            const hasPlace = !!(
              addr.city || addr.town || addr.village || addr.suburb ||
              addr.county || addr.district || addr.state_district ||
              addr.municipality || addr.city_district || addr.borough ||
              addr.region || addr.state || addr.province || addr.department ||
              addr.governorate || addr.locality
            );
            // Fallback adresses informelles (Afrique sub-saharienne, zones rurales...) :
            // sans rue identifiable, 2 niveaux de localité distincts suffisent
            // ex: "Médina, Dakar" → suburb + city ; "Yaba, Lagos" → suburb + state
            const localityLevels = [
              addr.suburb, addr.neighbourhood, addr.quarter, addr.hamlet, addr.locality,
              addr.city, addr.town, addr.village,
              addr.county, addr.district, addr.city_district, addr.borough,
              addr.state, addr.province, addr.region, addr.governorate,
            ].filter(Boolean).length;
            if ((hasWay && hasPlace) || localityLevels >= 2) {
              finalCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            }
          }
        } catch {}
        setSaving(false);
        if (!finalCoords) {
          setAdresseError(t('map.add_address_not_found'));
          hasError = true;
        } else {
          setAdresseError('');
        }
      }
    } else {
      setAdresseError('');
    }

    if (hasError) return;

    onAdd({
      id: `user_${Date.now()}`,
      nom: formatted,
      adresse: adresse.trim(),
      latitude: finalCoords.lat,
      longitude: finalCoords.lon,
      source: 'user',
    });
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
        <View style={styles.addModalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.addModalTitle}>{t('map.add_title')}</Text>
          <Text style={styles.addModalSubtitle}>{t('map.add_subtitle')}</Text>
          <Text style={styles.addFieldLabel}>{t('map.add_name_label')}</Text>
          <View style={[styles.addInputRow, nomError ? styles.addInputRowError : null]}>
            <Ionicons name="business-outline" size={16} color={nomError ? colors.error : colors.textMuted} style={styles.addInputIcon} />
            <TextInput
              style={styles.addInput}
              placeholder={t('map.add_name_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={nom}
              onChangeText={(v) => { setNom(v); setNomError(''); }}
            />
          </View>
          {nomError ? <Text style={styles.fieldError}>{nomError}</Text> : null}
          <Text style={[styles.addFieldLabel, { marginTop: spacing.xs }]}>{t('map.add_address_label')}</Text>
          <View style={{ zIndex: 10 }}>
            <View style={[styles.addInputRow, adresseError ? styles.addInputRowError : null]}>
              <Ionicons name="location-outline" size={16} color={adresseError ? colors.error : colors.textMuted} style={styles.addInputIcon} />
              <TextInput
                style={styles.addInput}
                placeholder={t('map.add_address_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={adresse}
                onChangeText={handleAdresseChange}
              />
              {loadingSugg
                ? <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
                : coords
                  ? <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginLeft: spacing.xs }} />
                  : null
              }
            </View>
            {adresseError ? <Text style={styles.fieldError}>{adresseError}</Text> : null}
            {suggestions.length > 0 && (
              <View style={styles.suggestionsList}>
                {suggestions.map((item) => (
                  <TouchableOpacity key={item.place_id} style={styles.suggestionItem} onPress={() => selectSuggestion(item)} activeOpacity={0.7}>
                    <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.suggestionText} numberOfLines={2}>{item.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.addBtn, saving && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color={colors.white} size="small" />
              : <><Ionicons name="add-circle-outline" size={18} color={colors.white} /><Text style={styles.addBtnText}>{t('map.add_submit')}</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>{t('map.add_cancel')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const apiUser = useSelector((state) => state.auth.apiUser);
  const isGuest = useSelector((state) => state.auth.isGuest);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const knownMosques = useSelector((state) => state.mosques.known);
  const janazaList = useSelector((state) => state.janazas.list);
  const subscriptions = useSelector((state) => state.mosques.subscriptions);
  const appRefresh = useSelector((state) => state.appRefresh);
  const mapRef = useRef(null);

  useEffect(() => {
    if (appRefresh === 0) return;
    setRetryKey(k => k + 1);
  }, [appRefresh]);

  const subscribedIds = useMemo(() => {
    const set = new Set();
    subscriptions.forEach((s) => {
      set.add(s.id);
      if (s.mosqueeId) set.add('_db_' + s.mosqueeId);
    });
    return set;
  }, [subscriptions]);

  const findSub = (mosque) => subscriptions.find(
    (s) => s.id === mosque.id ||
      (mosque._dbId != null && String(s.mosqueeId) === String(mosque._dbId))
  );

  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationMode, setLocationMode] = useState('gps'); // 'gps' | 'home'
  const [shareItem, setShareItem] = useState(null);
  const [androidLabels, setAndroidLabels] = useState([]);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const labelTimerRef = useRef(null);

  // Restore persisted mode on mount
  useEffect(() => {
    AsyncStorage.getItem('map_location_mode')
      .then(saved => { if (saved) setLocationMode(saved); })
      .catch(() => {});
  }, []);

  const persistLocationMode = useCallback((mode) => {
    setLocationMode(mode);
    AsyncStorage.setItem('map_location_mode', mode).catch(() => {});
  }, []);
  const [homeCoords, setHomeCoords] = useState(null);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [osmMosques, setOsmMosques] = useState([]);
  const [osmLoading, setOsmLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [osmError, setOsmError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [selectedMosque, setSelectedMosque] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  async function refreshGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setShowGpsModal(true); return null; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc.coords);
      return loc.coords;
    } catch { return null; }
  }

  async function handleRefresh() {
    setRefreshing(true);
    if (locationMode === 'gps') await refreshGps();
    if (apiUser?.id) {
      apiClient.get(`/api/abonnement/utilisateur/${apiUser.id}`)
        .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
        .catch(() => {});
    }
    setRetryKey(k => k + 1);
  }

  // GPS permission on mount
  useEffect(() => {
    (async () => {
      const coords = await refreshGps();
      if (!coords) setShowGpsModal(true);
      setLocationLoading(false);
    })();
  }, []);

  // Geocode home address whenever it changes
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

  // Auto-switch mode: home when address added, GPS when address removed
  const prevHasHome = useRef(false);
  useEffect(() => {
    const hasHome = !!apiUser?.adresseDomicile;
    if (hasHome && !prevHasHome.current) {
      persistLocationMode('home');
    } else if (!hasHome) {
      persistLocationMode('gps');
    }
    prevHasHome.current = hasHome;
  }, [apiUser?.adresseDomicile]);

  // Active reference coordinates based on current mode
  const activeCoords = useMemo(() => {
    if (locationMode === 'home' && homeCoords) return homeCoords;
    if (location) return { latitude: location.latitude, longitude: location.longitude };
    return null;
  }, [locationMode, homeCoords, location]);

  const notifRadius = isGuest ? 5 : (apiUser?.rayonNotification ?? 5);

  // Fetch nearby mosques: DB d'abord (affichage immédiat), Overpass en arrière-plan (enrichissement)
  useEffect(() => {
    const lat = activeCoords?.latitude;
    const lon = activeCoords?.longitude;
    if (lat == null || lon == null) return;
    setOsmLoading(true);
    setOsmError(false);

    let cancelled = false;
    let resolvedDb = null;
    let resolvedOverpass = null;
    let dbFailed = false;
    let overpassFailed = false;

    function mapDbMosque(m) {
      const numericOsmId = m.osmId ? m.osmId.replace(/^(node|way|relation)_/, '') : null;
      return {
        id: m.osmId ? `osm_${m.osmId}` : `db_${m.id}`,
        _dbId: m.id,
        osmId: numericOsmId,
        nom: m.nom,
        adresse: m.adresse ?? '',
        latitude: m.latitude,
        longitude: m.longitude,
        source: m.source ?? 'user',
      };
    }

    function mergeAndSet() {
      if (cancelled) return;
      const db = resolvedDb ?? [];
      const overpass = resolvedOverpass ?? [];
      const dbIds = new Set(db.map(m => m.id));
      const extras = overpass.filter(m => {
        if (dbIds.has(m.id)) return false;
        if (m.latitude != null && m.longitude != null) {
          return !db.some(
            (d) => d.latitude != null && d.longitude != null &&
              haversineKm(m.latitude, m.longitude, d.latitude, d.longitude) < 0.2
          );
        }
        return true;
      });
      setOsmMosques([...db, ...extras]);
    }

    // Phase 1 : DB cache — affichage immédiat dès que le serveur répond
    apiClient.get(`/api/mosquee/nearby?latitude=${lat}&longitude=${lon}&radiusKm=${notifRadius}`)
      .then(res => {
        resolvedDb = res.data.map(mapDbMosque);
        setOsmLoading(false);
        mergeAndSet();
      })
      .catch(() => { dbFailed = true; });

    // Phase 2 : Overpass — enrichit la liste en arrière-plan
    fetchNearbyMosques(lat, lon, notifRadius)
      .then(enrichAddresses)
      .then(overpassResults => {
        resolvedOverpass = overpassResults;
        mergeAndSet();
        if (!isGuest && overpassResults.length > 0) {
          apiClient.post('/api/mosquee/sync-osm', {
            mosques: overpassResults
              .filter(m => m.osmId && m.osmType && m.adresse?.trim() && m.latitude != null && m.longitude != null && (m.latitude !== 0 || m.longitude !== 0))
              .map(m => ({
                osmId: `${m.osmType === 'N' ? 'node' : 'way'}_${m.osmId}`,
                nom: m.nom,
                adresse: m.adresse || null,
                latitude: m.latitude,
                longitude: m.longitude,
              })),
          }).then(syncRes => {
            if (cancelled) return;
            const suppressed = new Set(syncRes?.data?.suppressedOsmIds ?? []);
            if (suppressed.size > 0) {
              resolvedOverpass = (resolvedOverpass ?? []).filter(m => {
                const key = `${m.osmType === 'N' ? 'node' : 'way'}_${m.osmId}`;
                return !suppressed.has(key);
              });
              mergeAndSet();
            }
          }).catch(() => {});
        }
      })
      .catch(() => { overpassFailed = true; })
      .finally(() => {
        if (cancelled) return;
        if (dbFailed && overpassFailed) setOsmError(true);
        setOsmLoading(false);
        setRefreshing(false);
      });

    return () => { cancelled = true; };
  }, [activeCoords?.latitude, activeCoords?.longitude, notifRadius, retryKey]);

  // Janazas grouped by mosqueeId for quick lookup
  const janazaGroups = useMemo(() => {
    const map = {};
    janazaList.forEach((j) => {
      if (!map[j.mosqueeId]) {
        map[j.mosqueeId] = { mosqueeId: j.mosqueeId, mosquee: j.mosquee, adresse: j.adresse, latitude: j.latitude, longitude: j.longitude, janazas: [] };
      }
      map[j.mosqueeId].janazas.push(j);
    });
    return map;
  }, [janazaList]);

  function getJanazaCount(mosque) {
    if (janazaGroups[mosque.id]) return janazaGroups[mosque.id].janazas.length;
    if (mosque._dbId != null && janazaGroups[String(mosque._dbId)]) return janazaGroups[String(mosque._dbId)].janazas.length;
    const nomLower = mosque.nom.toLowerCase();
    const match = Object.values(janazaGroups).find((g) => g.mosquee.toLowerCase() === nomLower);
    return match ? match.janazas.length : 0;
  }

  function getJanazas(mosque) {
    if (janazaGroups[mosque.id]) return janazaGroups[mosque.id].janazas;
    if (mosque._dbId != null && janazaGroups[String(mosque._dbId)]) return janazaGroups[String(mosque._dbId)].janazas;
    const nomLower = mosque.nom.toLowerCase();
    const match = Object.values(janazaGroups).find((g) => g.mosquee.toLowerCase() === nomLower);
    return match ? match.janazas : [];
  }

  // Merged mosque list: OSM + known (deduped), filtered by notifRadius, sorted by distance
  const allMosques = useMemo(() => {
    const osmIds = new Set(osmMosques.map((m) => m.id));
    const extras = knownMosques.filter((m) => {
      if (osmIds.has(m.id)) return false;
      if (m.id.startsWith('db_')) return false;
      // Exclure les mosquées OSM en doublon géographique avec une mosquée BDD (< 200m)
      if (m.latitude != null && m.longitude != null) {
        const isDuplicate = osmMosques.some(
          (db) => db.latitude != null && db.longitude != null &&
            haversineKm(m.latitude, m.longitude, db.latitude, db.longitude) < 0.2
        );
        if (isDuplicate) return false;
      }
      return true;
    });
    const raw = [...osmMosques, ...extras];

    const refLat = activeCoords?.latitude;
    const refLon = activeCoords?.longitude;

    const withinRadius = (refLat != null && refLon != null)
      ? raw.filter((m) => m.latitude == null || m.longitude == null ||
          haversineKm(refLat, refLon, m.latitude, m.longitude) <= notifRadius)
      : raw;

    return withinRadius
      .map((m) => ({
        ...m,
        _dist: m.latitude != null && m.longitude != null && refLat != null && refLon != null
          ? haversineKm(refLat, refLon, m.latitude, m.longitude)
          : null,
      }))
      .sort((a, b) => {
        if (a._dist == null && b._dist == null) return 0;
        if (a._dist == null) return 1;
        if (b._dist == null) return -1;
        return a._dist - b._dist;
      });
  }, [osmMosques, knownMosques, activeCoords?.latitude, activeCoords?.longitude, notifRadius]);

  const filteredMosques = useMemo(() => {
    if (!search.trim()) return allMosques;
    const q = normalize(search);
    return allMosques.filter(
      (m) => normalize(m.nom).includes(q) || normalize(m.adresse).includes(q)
    );
  }, [allMosques, search]);

  async function resolveMosqueeApiId(mosque) {
    // Mosquée déjà enregistrée en DB (cache OSM ou contribution utilisateur)
    if (mosque._dbId) return mosque._dbId;
    if (mosque.id.startsWith('db_')) return parseInt(mosque.id.replace('db_', ''), 10);
    if (!mosque.id.startsWith('osm_')) return parseInt(mosque.id, 10);
    // Mosquée OSM fraîche pas encore dans le cache DB : recherche ou création
    const osmId = mosque.osmId
      ? `${mosque.osmType === 'N' ? 'node' : 'way'}_${mosque.osmId}`
      : mosque.id.replace('osm_', '');
    try {
      const res = await apiClient.get(`/api/mosquee/osm/${osmId}`);
      return res.data.id;
    } catch (e) {
      if (e.response?.status === 404) {
        const created = await apiClient.post('/api/mosquee', {
          nom: mosque.nom,
          adresse: mosque.adresse || null,
          latitude: mosque.latitude,
          longitude: mosque.longitude,
          osmId,
        });
        return created.data.id;
      }
      throw e;
    }
  }

  async function toggleSubscription(mosque) {
    const sub = findSub(mosque);
    const isSubscribed = !!sub;
    if (isSubscribed) {
      if (sub?.apiId) {
        await apiClient.delete(`/api/abonnement/${sub.apiId}`).catch(() => {});
      }
      dispatch({ type: 'MOSQUE_UNSUBSCRIBE', payload: { id: sub.id } });
    } else {
      const payload = {
        id: mosque.id,
        nom: mosque.nom,
        adresse: mosque.adresse,
        latitude: mosque.latitude,
        longitude: mosque.longitude,
      };
      if (apiUser?.id) {
        try {
          const mosqueeApiId = await resolveMosqueeApiId(mosque);
          const res = await apiClient.post('/api/abonnement', {
            utilisateurId: apiUser.id,
            mosqueeId: mosqueeApiId,
          });
          payload.apiId = res.data.id;
        } catch {}
      }
      dispatch({ type: 'MOSQUE_SUBSCRIBE', payload });
    }
  }

  async function addUserMosque(mosque) {
    setShowAddModal(false);
    try {
      await apiClient.post('/api/mosquee/suggestion', {
        nom: mosque.nom,
        adresse: mosque.adresse || null,
        latitude: mosque.latitude ?? 0,
        longitude: mosque.longitude ?? 0,
      });
      Alert.alert(
        'Demande envoyée ✓',
        'Votre demande a bien été reçue et sera analysée par un administrateur. Merci pour votre contribution !',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de l\'envoi de votre demande. Veuillez réessayer.',
        [{ text: 'OK' }]
      );
    }
  }


  const refreshAndroidLabels = useCallback(async () => {
    if (Platform.OS !== 'android' || !mapRef.current) return;
    const groups = Object.values(janazaGroups);
    if (groups.length === 0) { setAndroidLabels([]); return; }
    try {
      const labels = await Promise.all(groups.map(async (g) => {
        const pt = await mapRef.current.pointForCoordinate({ latitude: g.latitude, longitude: g.longitude });
        return { id: g.mosqueeId, nom: g.mosquee, count: g.janazas.length, x: pt.x, y: pt.y };
      }));
      setAndroidLabels(labels.filter(Boolean));
    } catch {}
  }, [janazaGroups]);

  function handleMapReady() {
    if (Platform.OS !== 'android') return;
    setTimeout(() => refreshAndroidLabels(), 600);
  }

  function handleMapRegionChange() {
    if (Platform.OS !== 'android') return;
    setLabelsVisible(false);
    clearTimeout(labelTimerRef.current);
  }

  async function handleRegionChangeComplete() {
    if (Platform.OS !== 'android') return;
    await refreshAndroidLabels();
    setLabelsVisible(true);
  }

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => {
      if (activeCoords && mapRef.current) {
        mapRef.current.animateToRegion(regionForRadius, 500);
      }
      if (Platform.OS === 'android') {
        refreshAndroidLabels();
        setLabelsVisible(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [activeCoords, regionForRadius, refreshAndroidLabels]));

  function handlePressMosque(mosque) {
    // Resolve canonical mosque from allMosques so selectedMosque.id matches subscription ids
    const canonical = allMosques.find((m) =>
      m.id === mosque.id ||
      String(m._dbId) === String(mosque.id) ||
      m.id === 'db_' + String(mosque.id)
    ) ?? mosque;
    setSelectedMosque({ ...canonical, janazas: getJanazas(mosque) });
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
            try { await apiClient.delete(`/api/prierejanaza/${id}`); } catch {}
            dispatch({ type: 'JANAZA_DELETE', payload: { id } });
          },
        },
      ]
    );
  }


  async function centerOnActive() {
    let lat = activeCoords?.latitude;
    let lon = activeCoords?.longitude;
    if (locationMode === 'gps') {
      const fresh = await refreshGps();
      if (fresh) { lat = fresh.latitude; lon = fresh.longitude; }
    }
    if (lat != null && lon != null && mapRef.current) {
      const delta = (notifRadius * 2 / 111) * 1.4;
      mapRef.current.animateToRegion(
        { latitude: lat, longitude: lon, latitudeDelta: delta, longitudeDelta: delta },
        500
      );
    }
  }

  const regionForRadius = useMemo(() => {
    const lat = activeCoords?.latitude ?? 48.8566;
    const lon = activeCoords?.longitude ?? 2.3522;
    const delta = (notifRadius * 2 / 111) * 1.4;
    return { latitude: lat, longitude: lon, latitudeDelta: delta, longitudeDelta: delta };
  }, [activeCoords?.latitude, activeCoords?.longitude, notifRadius]);

  const hasHomeAddress = !!apiUser?.adresseDomicile;

  if (locationLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('map.loading')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('map.title')}</Text>
          {osmLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />}
        </View>
        <View style={styles.headerRight}>
          {!isGuest && apiUser?.adresseDomicile && (
            <ModeToggle
              value={locationMode}
              onToggle={() => persistLocationMode(locationMode === 'gps' ? 'home' : 'gps')}
            />
          )}
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, view === 'map' && styles.tabActive]} onPress={() => setView('map')}>
              <Text style={[styles.tabText, view === 'map' && styles.tabTextActive]}>{t('map.tab_map')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, view === 'list' && styles.tabActive]} onPress={() => setView('list')}>
              <Text style={[styles.tabText, view === 'list' && styles.tabTextActive]}>{t('map.tab_list')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {osmError && (
        <View style={styles.errorBanner}>
          <Ionicons name="wifi-outline" size={14} color={colors.warning} />
          <Text style={styles.errorBannerText}>{t('map.error_banner')}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>{t('map.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {view === 'map' ? (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={regionForRadius}
            userInterfaceStyle="light"
            onMapReady={handleMapReady}
            onRegionChange={handleMapRegionChange}
            onRegionChangeComplete={handleRegionChangeComplete}
          >
            {locationMode === 'home' && homeCoords ? (
              <>
                {Platform.OS === 'ios' ? (
                  <SmartMarker coordinate={homeCoords}>
                    <View style={styles.homePin}>
                      <Ionicons name="home" size={20} color={colors.primary} />
                    </View>
                  </SmartMarker>
                ) : (
                  <Marker coordinate={homeCoords} pinColor="#2563eb" tappable={false} />
                )}
                <Circle
                  center={homeCoords}
                  radius={notifRadius * 1000}
                  strokeColor={colors.primary + '80'}
                  fillColor={colors.primary + '15'}
                />
              </>
            ) : location ? (
              <>
                {Platform.OS === 'ios' ? (
                  <SmartMarker coordinate={{ latitude: location.latitude, longitude: location.longitude }}>
                    <Image source={USER_PIN_IMG} style={styles.userPinImg} resizeMode="contain" />
                  </SmartMarker>
                ) : (
                  <Marker
                    coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                    pinColor="#2563eb"
                    tappable={false}
                  />
                )}
                <Circle
                  center={{ latitude: location.latitude, longitude: location.longitude }}
                  radius={notifRadius * 1000}
                  strokeColor={colors.primary + '80'}
                  fillColor={colors.primary + '15'}
                />
              </>
            ) : null}
            {Object.values(janazaGroups).map((group) => (
              Platform.OS === 'ios' ? (
                <SmartMarker
                  key={group.mosqueeId}
                  coordinate={{ latitude: group.latitude, longitude: group.longitude }}
                  onPress={() => handlePressMosque({
                    id: group.mosqueeId,
                    nom: group.mosquee,
                    adresse: group.adresse,
                    latitude: group.latitude,
                    longitude: group.longitude,
                  })}
                >
                  <JanazaMapPin count={group.janazas.length} />
                </SmartMarker>
              ) : (
                <Marker
                  key={group.mosqueeId}
                  coordinate={{ latitude: group.latitude, longitude: group.longitude }}
                  pinColor={colors.primary}
                  onPress={() => handlePressMosque({
                    id: group.mosqueeId,
                    nom: group.mosquee,
                    adresse: group.adresse,
                    latitude: group.latitude,
                    longitude: group.longitude,
                  })}
                />
              )
            ))}
          </MapView>
          {Platform.OS === 'android' && labelsVisible && (
            <View style={[StyleSheet.absoluteFillObject, { direction: 'ltr' }]} pointerEvents="box-none">
              {androidLabels.map(lbl => (
                <TouchableOpacity
                  key={lbl.id}
                  style={[styles.androidMapLabel, { left: lbl.x - 10, top: lbl.y - 52 }]}
                  onPress={() => handlePressMosque({
                    id: lbl.id, nom: lbl.nom,
                    latitude: janazaGroups[lbl.id]?.latitude,
                    longitude: janazaGroups[lbl.id]?.longitude,
                    adresse: janazaGroups[lbl.id]?.adresse,
                  })}
                  activeOpacity={0.8}
                >
                  <View style={styles.androidMapLabelBadge}>
                    <Text style={styles.androidMapLabelBadgeText}>{lbl.count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {activeCoords && (
            <TouchableOpacity style={styles.locateBtn} onPress={centerOnActive} activeOpacity={0.8}>
              <Ionicons name={locationMode === 'home' ? 'home' : 'locate'} size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('map.search_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>
          <View style={styles.radiusStrip}>
            <Ionicons
              name={locationMode === 'home' ? 'home-outline' : 'radio-outline'}
              size={13}
              color={colors.primary}
            />
            <Text style={styles.radiusStripText}>
              {t('map.mosque_count_prefix', { count: filteredMosques.length })}{' '}
              <Text style={styles.radiusStripBold}>{notifRadius} {t('map.radius_suffix')}</Text>
              {locationMode === 'home' && apiUser?.adresseDomicile
                ? <Text> · {apiUser.adresseDomicile.split(',')[0]}</Text>
                : locationMode === 'gps' && location
                ? <Text> · {t('map.radius_gps')}</Text>
                : null}
            </Text>
          </View>
          {!apiUser?.adresseDomicile && (
            <View style={styles.profileHintBanner}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
              <Text style={styles.profileHintText}>
                {(() => {
                  const hint = t('map.profile_hint', { profile: '|||' });
                  const [before, after] = hint.split('|||');
                  return <>{before}<Text style={styles.profileHintBold}>{t('map.profile_link')}</Text>{after}</>;
                })()}
              </Text>
            </View>
          )}
          <FlatList
            data={filteredMosques}
            keyExtractor={(item) => item.id}
            extraData={subscribedIds}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) => (
              <MosqueCard
                mosque={item}
                distKm={item._dist}
                subscribed={subscribedIds.has(item.id) || (item._dbId != null && subscribedIds.has('_db_' + String(item._dbId)))}
                janazaCount={getJanazaCount(item)}
                onToggle={() => toggleSubscription(item)}
                onPress={handlePressMosque}
                showSubscribe={!isGuest}
                showUserBadge={isAdmin}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              osmLoading ? (
                <View style={styles.emptyBox}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.emptyText}>{t('map.loading_mosques')}</Text>
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="business-outline" size={40} color={colors.border} />
                  <Text style={styles.emptyText}>{t('map.no_mosques')}</Text>
                </View>
              )
            }
            ListFooterComponent={
              <TouchableOpacity style={styles.addMosqueBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addMosqueBtnText}>{t('map.add_mosque_prompt')}</Text>
              </TouchableOpacity>
            }
          />
        </>
      )}

      {selectedMosque && (
        <MosqueDetailModal
          mosque={selectedMosque}
          distKm={selectedMosque._dist}
          janazas={selectedMosque.janazas}
          onClose={() => setSelectedMosque(null)}
          onShare={(janaza) => { setSelectedMosque(null); setTimeout(() => setShareItem(janaza), 350); }}
          onDelete={handleDelete}
          currentUserId={apiUser?.id}
          currentUserRole={user?.role}
          showSubscribe={!isGuest}
          subscribed={subscribedIds.has(selectedMosque.id) || (selectedMosque._dbId != null && subscribedIds.has('_db_' + String(selectedMosque._dbId)))}
          onToggleSubscribe={() => toggleSubscription(selectedMosque)}
        />
      )}
      {showAddModal && <AddMosqueModal onAdd={addUserMosque} onClose={() => setShowAddModal(false)} />}
      {showGpsModal && <GpsPermissionModal onClose={() => setShowGpsModal(false)} />}
      <JanazaShareModal
        visible={shareItem !== null}
        onClose={() => setShareItem(null)}
        janaza={shareItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundSecondary, gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { ...typography.h2 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceElevated, borderRadius: radius.md, padding: 3, borderWidth: 1, borderColor: colors.border },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.bodySmall, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.white },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleTrack: { width: 56, height: 30, borderRadius: 15, justifyContent: 'center' },
  toggleThumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(180,83,9,0.07)', borderBottomWidth: 1, borderBottomColor: 'rgba(180,83,9,0.20)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  errorBannerText: { ...typography.bodySmall, color: colors.warning, flex: 1 },
  retryBtn: { backgroundColor: colors.warning, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  retryBtnText: { color: colors.white, fontSize: 12, fontWeight: '600' },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.xs },
  radiusStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryDim, borderBottomWidth: 1, borderBottomColor: colors.border },
  radiusStripText: { ...typography.caption, color: colors.primary, flex: 1 },
  radiusStripBold: { fontWeight: '700' },

  profileHintBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(220,38,38,0.07)', borderBottomWidth: 1, borderBottomColor: 'rgba(220,38,38,0.20)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  profileHintText: { ...typography.bodySmall, color: colors.error, flex: 1, lineHeight: 18 },
  profileHintBold: { fontWeight: '700' },

  map: { flex: 1 },
  locateBtn: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary, ...shadow.md },

  // Custom map pin
  userPinImg: { width: 120, height: 120 },
  homePin: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.primary, ...shadow.sm },
  pinWrapper: { alignItems: 'center' },
  pinImgWrapper: { position: 'relative', alignItems: 'center' },
  pinCircle: {
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pinImg: { width: 38, height: 38 },
  pinBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: colors.primary, borderRadius: radius.full, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: colors.white },
  pinBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  pinLabel: { fontSize: 11, fontWeight: '700', color: colors.text, maxWidth: 120, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, overflow: 'hidden' },

  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  mosqueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  mosqueInfo: { flex: 1, marginRight: spacing.sm },
  mosqueNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  mosqueName: { ...typography.body, fontWeight: '700', flex: 1 },
  userAddedBadge: { backgroundColor: colors.accent + '20', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: colors.accent + '60' },
  userAddedBadgeText: { fontSize: 10, fontWeight: '700', color: colors.accent },
  janazaBadge: { backgroundColor: colors.primary, borderRadius: radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  janazaBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  mosqueAddress: { ...typography.caption, color: colors.textSecondary, marginBottom: 3 },
  mosqueDistRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mosqueDistance: { ...typography.caption, color: '#C97070' },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderWidth: 1.5, borderColor: colors.border },
  subscribeBtnActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  subscribeBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  subscribeBtnTextActive: { color: colors.primary },

  addMosqueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed' },
  addMosqueBtnText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  // Detail modal
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, borderTopWidth: 1, borderColor: colors.border, ...shadow.md },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalMosqueHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  modalMosqueIcon: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  modalMosqueIconImg: { width: 64, height: 64 },
  modalMosqueName: { ...typography.h3, marginBottom: 3 },
  modalMosqueAddress: { ...typography.bodySmall, marginBottom: 3 },
  modalMosqueDist: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  addressText: { ...typography.bodySmall, flex: 1 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryDim, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  copyBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  navBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginBottom: spacing.sm },
  navBtnText: { ...typography.button },
  subscribeModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, paddingVertical: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: colors.primary },
  subscribeModalBtnActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
  subscribeModalBtnText: { ...typography.button, color: colors.primary },
  subscribeModalBtnTextActive: { color: colors.textMuted },
  modalDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  modalSectionTitle: { ...typography.label, color: colors.primary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
  janazaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, gap: spacing.sm },
  janazaRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  janazaTimeBox: { backgroundColor: colors.primaryDim, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minWidth: 56, alignItems: 'center' },
  janazaTime: { ...typography.label, color: colors.primary, fontSize: 14 },
  janazaGenreImg: { width: 64, height: 64 },
  janazaNom: { ...typography.body, fontWeight: '600' },
  janazaGenreLabel: { ...typography.caption },
  emptyJanazaBox: { alignItems: 'center', paddingVertical: spacing.lg },
  emptyJanazaEmoji: { fontSize: 36, marginBottom: spacing.sm },
  emptyJanazaText: { ...typography.body, color: colors.textSecondary },
  closeBtn: { paddingVertical: spacing.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: spacing.sm },
  closeBtnText: { ...typography.body, color: colors.textMuted },

  // Add mosque modal
  addModalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, borderTopWidth: 1, borderColor: colors.border, ...shadow.md },
  addModalTitle: { ...typography.h3, marginBottom: spacing.xs },
  addModalSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg },
  addFieldLabel: { ...typography.label, marginBottom: spacing.xs, color: colors.text },
  addInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  addInputRowError: { borderColor: colors.error },
  fieldError: { ...typography.caption, color: colors.error, marginBottom: spacing.sm, marginLeft: spacing.xs },
  addInputIcon: { marginRight: spacing.sm },
  addInput: { flex: 1, paddingVertical: spacing.md, color: colors.text, fontSize: 15 },
  suggestionsList: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: -spacing.md, marginBottom: spacing.md, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggestionText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { ...typography.button },

  // GPS permission modal
  gpsModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  gpsModalBox: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 360, ...shadow.md },
  gpsModalIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.md },
  gpsModalTitle: { ...typography.h3, textAlign: 'center', marginBottom: spacing.sm },
  gpsModalText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  gpsModalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginBottom: spacing.sm },
  gpsModalPrimaryBtnText: { ...typography.button },
  gpsModalSecondaryBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  gpsModalSecondaryBtnText: { ...typography.body, color: colors.textMuted },

  // Android map label overlay
  androidMapLabel: { position: 'absolute', alignItems: 'center', pointerEvents: 'box-only' },
  androidMapLabelText: { fontSize: 11, fontWeight: '700', color: colors.text, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', textAlign: 'center', borderWidth: 1, borderColor: colors.border },
  androidMapLabelBadge: { marginTop: 2, backgroundColor: colors.white, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 1.5, borderColor: colors.primary },
  androidMapLabelBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
});
