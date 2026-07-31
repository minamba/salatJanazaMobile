import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { refreshAllData as refreshAllDataUtil } from '../../utils/refreshStore';
import { capitalizeFirst, formatNomDefunt } from '../../utils/text';
import { computeStatut, useMinuteTick } from '../../utils/statut';
import EditDeclarationModal from '../../components/EditDeclarationModal';
import {
  View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, RefreshControl, Modal, Linking, Platform,
  TouchableWithoutFeedback, Image, AppState, Animated, TextInput,
  KeyboardAvoidingView, ScrollView, Dimensions,
} from 'react-native';
import * as Notifications from 'expo-notifications';


const GENRE_IMAGES = {
  homme: require('../../../assets/icons/homme.png'),
  femme: require('../../../assets/icons/femme.png'),
  enfant: require('../../../assets/icons/enfant.png'),
};
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const SHEET_H = Dimensions.get('window').height * 0.88;
import { useSelector, useDispatch } from 'react-redux';
import * as Location from 'expo-location';
import apiClient from '../../lib/api/apiClient';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, radius, typography, shadow } from '../../utils/theme';
import { useTranslation } from 'react-i18next';
import { getCountryName } from '../../utils/countryNames';
import { JanazaShareModal } from '../declare/AnnouncementGenerator';

function ModeToggle({ value, onToggle }) {
  const anim = useRef(new Animated.Value(value === 'home' ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value === 'home' ? 1 : 0, useNativeDriver: false, tension: 120, friction: 8 }).start();
  }, [value]);
  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.accent, colors.primary] });
  const thumbX = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 29] });
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
      <Animated.View style={{ width: 56, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: trackColor, overflow: 'hidden' }}>
        <Animated.View style={{ position: 'absolute', left: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3, transform: [{ translateX: thumbX }] }}>
          <Ionicons name={value === 'home' ? 'home' : 'navigate'} size={13} color={value === 'home' ? colors.primary : colors.accent} />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function useGenreLabel() {
  const { t } = useTranslation();
  return (genre) => ({ homme: t('home.male'), femme: t('home.female'), enfant: t('home.child') }[genre] ?? genre);
}


const LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA', tr: 'tr-TR', ja: 'ja-JP', ko: 'ko-KR', ms: 'ms-MY', ur: 'ur-PK', id: 'id-ID', bn: 'bn-BD', ru: 'ru-RU', pt: 'pt-BR', de: 'de-DE', it: 'it-IT', es: 'es-ES' };

// ── Country flag from GPS coords ──────────────────────────────────────────────
const _geoCache = new Map(); // "lat,lon" → { flag, isoCode } | null

function isoToFlag(code) {
  if (!code || code.length !== 2) return null;
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

// Fast path: French country name at end of address → ISO code, no geocoding needed
const FR_TO_ISO = {
  'Afghanistan': 'AF', 'Afrique du Sud': 'ZA', 'Algérie': 'DZ',
  'Allemagne': 'DE', 'Angola': 'AO', 'Arabie Saoudite': 'SA',
  'Argentine': 'AR', 'Australie': 'AU', 'Autriche': 'AT',
  'Azerbaïdjan': 'AZ', 'Bahreïn': 'BH', 'Bangladesh': 'BD',
  'Belgique': 'BE', 'Bénin': 'BJ', 'Birmanie': 'MM',
  'Bosnie-Herzégovine': 'BA', 'Bulgarie': 'BG', 'Burkina Faso': 'BF',
  'Burundi': 'BI', 'Cambodge': 'KH', 'Cameroun': 'CM', 'Canada': 'CA',
  'Centrafrique': 'CF', 'Comores': 'KM', 'Congo': 'CG', 'RD Congo': 'CD',
  "Côte d'Ivoire": 'CI', 'Danemark': 'DK', 'Djibouti': 'DJ',
  'Égypte': 'EG', 'Émirats arabes unis': 'AE', 'Espagne': 'ES',
  'Éthiopie': 'ET', 'Finlande': 'FI', 'France': 'FR', 'Gabon': 'GA',
  'Gambie': 'GM', 'Ghana': 'GH', 'Grèce': 'GR', 'Guinée': 'GN',
  'Guinée-Bissau': 'GW', 'Guinée équatoriale': 'GQ', 'Inde': 'IN',
  'Indonésie': 'ID', 'Irak': 'IQ', 'Iran': 'IR', 'Irlande': 'IE',
  'Italie': 'IT', 'Jordanie': 'JO', 'Kazakhstan': 'KZ', 'Kenya': 'KE',
  'Kirghizistan': 'KG', 'Koweït': 'KW', 'Liban': 'LB', 'Libye': 'LY',
  'Luxembourg': 'LU', 'Macédoine du Nord': 'MK', 'Madagascar': 'MG',
  'Malaisie': 'MY', 'Mali': 'ML', 'Maroc': 'MA', 'Mauritanie': 'MR',
  'Mexique': 'MX', 'Moldavie': 'MD', 'Mozambique': 'MZ', 'Namibie': 'NA',
  'Niger': 'NE', 'Nigéria': 'NG', 'Norvège': 'NO', 'Oman': 'OM',
  'Ouganda': 'UG', 'Ouzbékistan': 'UZ', 'Pakistan': 'PK',
  'Palestine': 'PS', 'Pays-Bas': 'NL', 'Philippines': 'PH',
  'Pologne': 'PL', 'Portugal': 'PT', 'Qatar': 'QA', 'Roumanie': 'RO',
  'Royaume-Uni': 'GB', 'Rwanda': 'RW', 'Sénégal': 'SN',
  'Sierra Leone': 'SL', 'Singapour': 'SG', 'Somalie': 'SO',
  'Soudan': 'SD', 'Suède': 'SE', 'Suisse': 'CH', 'Syrie': 'SY',
  'Tadjikistan': 'TJ', 'Tanzanie': 'TZ', 'Tchad': 'TD', 'Togo': 'TG',
  'Tunisie': 'TN', 'Turquie': 'TR', 'Turkménistan': 'TM',
  'Ukraine': 'UA', 'États-Unis': 'US', 'Yémen': 'YE', 'Zambie': 'ZM',
  'Zimbabwe': 'ZW', 'Chine': 'CN', 'Japon': 'JP', 'Corée du Sud': 'KR',
  'Thaïlande': 'TH', 'Vietnam': 'VN',
  // Europe
  'Albanie': 'AL', 'Andorre': 'AD', 'Arménie': 'AM', 'Biélorussie': 'BY',
  'Chypre': 'CY', 'Croatie': 'HR', 'République tchèque': 'CZ', 'Estonie': 'EE',
  'Géorgie': 'GE', 'Hongrie': 'HU', 'Islande': 'IS', 'Kosovo': 'XK',
  'Lettonie': 'LV', 'Liechtenstein': 'LI', 'Lituanie': 'LT', 'Malte': 'MT',
  'Monaco': 'MC', 'Monténégro': 'ME', 'Russie': 'RU', 'Saint-Marin': 'SM',
  'Serbie': 'RS', 'Slovaquie': 'SK', 'Slovénie': 'SI', 'Vatican': 'VA',
  // Asie
  'Brunéi': 'BN', 'Bhoutan': 'BT', 'Israël': 'IL', 'Corée du Nord': 'KP',
  'Laos': 'LA', 'Sri Lanka': 'LK', 'Mongolie': 'MN', 'Maldives': 'MV',
  'Népal': 'NP', 'Timor oriental': 'TL', 'Taïwan': 'TW',
  // Afrique
  'Botswana': 'BW', 'Cap-Vert': 'CV', 'Érythrée': 'ER', 'Eswatini': 'SZ',
  'Lesotho': 'LS', 'Libéria': 'LR', 'Malawi': 'MW', 'Maurice': 'MU',
  'Seychelles': 'SC', 'Soudan du Sud': 'SS', 'Sao Tomé-et-Principe': 'ST',
  // Amériques
  'Antigua-et-Barbuda': 'AG', 'Barbade': 'BB', 'Belize': 'BZ', 'Bolivie': 'BO',
  'Brésil': 'BR', 'Bahamas': 'BS', 'Chili': 'CL', 'Colombie': 'CO',
  'Costa Rica': 'CR', 'Cuba': 'CU', 'Dominique': 'DM', 'République dominicaine': 'DO',
  'Équateur': 'EC', 'Grenade': 'GD', 'Guatemala': 'GT', 'Guyana': 'GY',
  'Haïti': 'HT', 'Honduras': 'HN', 'Jamaïque': 'JM',
  'Saint-Kitts-et-Nevis': 'KN', 'Sainte-Lucie': 'LC', 'Nicaragua': 'NI',
  'Panama': 'PA', 'Pérou': 'PE', 'Paraguay': 'PY', 'Suriname': 'SR',
  'Salvador': 'SV', 'Trinité-et-Tobago': 'TT', 'Uruguay': 'UY',
  'Saint-Vincent-et-les-Grenadines': 'VC', 'Venezuela': 'VE',
  // Océanie
  'Fidji': 'FJ', 'Micronésie': 'FM', 'Kiribati': 'KI', 'Îles Marshall': 'MH',
  'Nauru': 'NR', 'Nouvelle-Zélande': 'NZ', 'Papouasie-Nouvelle-Guinée': 'PG',
  'Palaos': 'PW', 'Îles Salomon': 'SB', 'Tonga': 'TO', 'Tuvalu': 'TV',
  'Vanuatu': 'VU', 'Samoa': 'WS',
};

function getIsoFromAddress(adresse) {
  if (!adresse) return null;
  const parts = adresse.split(',').map(p => p.trim());
  return FR_TO_ISO[parts[parts.length - 1]] ?? null;
}

function useCountryFlag(lat, lon, adresse, enabled) {
  const [result, setResult] = useState(null); // { flag, isoCode, country } | null
  const hasCoords = lat != null && lon != null && !(lat === 0 && lon === 0);
  const key = hasCoords
    ? `${lat.toFixed(4)},${lon.toFixed(4)}`
    : (adresse ? `addr:${adresse}` : null);

  useEffect(() => {
    if (!enabled || !key) { setResult(null); return; }
    if (_geoCache.has(key)) { setResult(_geoCache.get(key)); return; }
    let cancelled = false;

    function applyGeoResult(results) {
      if (cancelled) return;
      const r = results?.[0];
      const isoCode = r?.isoCountryCode ?? null;
      const country = r?.country ?? null;
      const entry = isoCode ? { flag: isoToFlag(isoCode), isoCode, country } : null;
      _geoCache.set(key, entry);
      setResult(entry);
    }

    if (hasCoords) {
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
        .then(applyGeoResult)
        .catch(() => {});
    } else if (adresse) {
      // Fast path: extract country directly from French address (works on all platforms)
      const directIso = getIsoFromAddress(adresse);
      if (directIso) {
        const entry = { flag: isoToFlag(directIso), isoCode: directIso, country: null };
        _geoCache.set(key, entry);
        if (!cancelled) setResult(entry);
        return;
      }
      // Slow path: geocode the address (may fail on iOS with non-English country names)
      Location.geocodeAsync(adresse)
        .then(coords => {
          if (cancelled || !coords?.[0]) return;
          return Location.reverseGeocodeAsync({ latitude: coords[0].latitude, longitude: coords[0].longitude })
            .then(applyGeoResult);
        })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [key, enabled]);
  return result;
}

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
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

function formatDate(date, locale, t) {
  const dateUTC = date.toISOString().slice(0, 10);
  const now = new Date();
  const todayUTC = now.toISOString().slice(0, 10);
  const tomorrowUTC = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  if (dateUTC === todayUTC) return t('home.today');
  if (dateUTC === tomorrowUTC) return t('home.tomorrow');
  const label = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupJanazasByDate(janazas, locale, t) {
  const groups = [];
  const seen = {};
  for (const j of janazas) {
    const d = j.dateHeure instanceof Date ? j.dateHeure : new Date(j.dateHeure);
    const key = d.toISOString().slice(0, 10);
    if (!seen[key]) {
      seen[key] = { label: formatDate(d, locale, t), items: [] };
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
  terminee: colors.error,
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
function MosqueCard({ group, coords, onPressJanaza, currentUserId, currentUserRole, onDelete, onEdit, isSubscribed, showWorldFlag }) {
  const { t, i18n } = useTranslation();
  useMinuteTick();
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
  const [reminders, setReminders] = useState({});
  const [shareItem, setShareItem] = useState(null);

  useEffect(() => {
    const refreshReminders = () => {
      Notifications.getAllScheduledNotificationsAsync().then(scheduled => {
        const restored = {};
        scheduled.forEach(notif => {
          const data = notif.content.data;
          if (data?.mosquee === group.mosquee && data?.janazaId) {
            restored[String(data.janazaId)] = notif.identifier;
          }
        });
        setReminders(restored);
      }).catch(() => {});
    };

    refreshReminders();

    const notifSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.mosquee === group.mosquee && data?.janazaId) {
        setReminders(prev => {
          const updated = { ...prev };
          delete updated[String(data.janazaId)];
          return updated;
        });
      }
      refreshReminders();
    });
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshReminders();
    });

    return () => {
      notifSub.remove();
      appStateSub.remove();
    };
  }, [group.mosquee]);
  const [showCountryName, setShowCountryName] = useState(false);
  const countryResult = useCountryFlag(group.latitude, group.longitude, group.adresse, !!showWorldFlag);
  const countryFlag = countryResult?.flag ?? null;
  const countryName = countryResult?.isoCode
    ? getCountryName(countryResult.isoCode, locale)
    : (countryResult?.country ?? null);

  const prayerTime = earliest.dateHeure instanceof Date ? earliest.dateHeure : new Date(earliest.dateHeure);
  const prayerMs = isNaN(prayerTime.getTime()) ? 0 : prayerTime.getTime();
  const reminderIsActive = reminder != null;
  const allSameDay = group.janazas.every(j => {
    const d = j.dateHeure instanceof Date ? j.dateHeure : new Date(j.dateHeure);
    const d0 = group.janazas[0].dateHeure instanceof Date ? group.janazas[0].dateHeure : new Date(group.janazas[0].dateHeure);
    return d.toISOString().slice(0, 10) === d0.toISOString().slice(0, 10);
  });
  const allSameTime = group.janazas.every(j => {
    const d = j.dateHeure instanceof Date ? j.dateHeure : new Date(j.dateHeure);
    const d0 = group.janazas[0].dateHeure instanceof Date ? group.janazas[0].dateHeure : new Date(group.janazas[0].dateHeure);
    return d.getTime() === d0.getTime();
  });
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

      // Wall-clock UTC → interprété comme heure locale appareil → 30min avant = 11h30 local
      const prayerLocal = new Date(
        prayerTime.getUTCFullYear(), prayerTime.getUTCMonth(), prayerTime.getUTCDate(),
        prayerTime.getUTCHours(), prayerTime.getUTCMinutes(), 0, 0,
      );
      const reminderTime = new Date(prayerLocal.getTime() - 30 * 60 * 1000);
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

  async function toggleReminderForPrayer(janaza) {
    const pt = janaza.dateHeure instanceof Date ? janaza.dateHeure : new Date(janaza.dateHeure);
    const key = String(janaza.id);
    try {
      if (reminders[key]) {
        await Notifications.cancelScheduledNotificationAsync(reminders[key]);
        setReminders(prev => { const n = { ...prev }; delete n[key]; return n; });
        return;
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
      const utcOffsetMs = (janaza.utcOffsetMinutes ?? 0) * 60 * 1000;
      const trueUtcPrayer = new Date(pt.getTime() - utcOffsetMs);
      const reminderTime = new Date(trueUtcPrayer.getTime() - 30 * 60 * 1000);
      if (reminderTime <= new Date()) {
        Alert.alert(t('home.too_late'), t('home.too_late_message'));
        return;
      }
      const nom = janaza.estAnonyme ? t('home.anonymous') : (formatNomDefunt(janaza.nomDefunt) || t('home.not_specified'));
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Salat al-Janaza — ${group.mosquee}`,
          body: `${nom} · ${formatTime(janaza.dateHeure, locale)} · ${group.adresse}`,
          sound: true,
          data: { janazaId: janaza.id, mosquee: group.mosquee },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderTime,
        },
      });
      setReminders(prev => ({ ...prev, [key]: id }));
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
            const nom = item.estAnonyme ? t('home.anonymous') : (formatNomDefunt(item.nomDefunt) || t('home.not_specified'));
            const canDelete = (currentUserId != null && item.utilisateurId != null && Number(currentUserId) === Number(item.utilisateurId)) || currentUserRole === 'admin' || currentUserRole === 'superadmin';
            const reminderActive = !!reminders[String(item.id)];
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.janazaRow, i > 0 && styles.janazaRowBorder]}
                onPress={() => onPressJanaza(item)}
                activeOpacity={0.65}
              >
                  <View style={styles.janazaLeftCol}>
                    <StatusBadge statut={computeStatut(item)} />
                    <View style={styles.janazaTimePill}>
                      <Text style={styles.janazaTime}>{formatTime(item.dateHeure, locale)}</Text>
                    </View>
                  </View>
                  <View style={styles.janazaAvatarCircle}>
                    <Image source={GENRE_IMAGES[item.genre]} style={styles.janazaGenreImg} resizeMode="contain" />
                  </View>
                  <View style={styles.janazaInfo}>
                    <Text style={styles.janazaNom} numberOfLines={1}>{nom}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); setShareItem({ ...item, mosquee: group.mosquee, adresse: group.adresse }); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.6}
                    style={{ marginLeft: 4 }}
                  >
                    <Ionicons name="share-social-outline" size={17} color={colors.primary} />
                  </TouchableOpacity>
                  {canDelete && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); onEdit?.(item); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.6}
                      style={{ marginLeft: 4 }}
                    >
                      <Ionicons name="create-outline" size={17} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  {!isSubscribed && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); toggleReminderForPrayer(item); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.6}
                      style={{ marginLeft: 4 }}
                    >
                      <Ionicons
                        name={reminderActive ? 'notifications' : 'notifications-outline'}
                        size={17}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  )}
                  {canDelete ? (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); onDelete(item.id); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.6}
                      style={{ marginLeft: 4 }}
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
        {showWorldFlag && countryFlag ? (
          <TouchableOpacity
            onPress={() => setShowCountryName(v => !v)}
            style={styles.countryFlagBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.countryFlag}>{countryFlag}</Text>
            {showCountryName && countryName && (
              <Text style={styles.countryName}>{countryName}</Text>
            )}
          </TouchableOpacity>
        ) : <View />}
        {isSubscribed && (
          <View style={[styles.notifBtn, styles.notifBtnActive]}>
            <Ionicons name="notifications" size={13} color={colors.white} />
            <Text style={[styles.notifBtnText, styles.notifBtnTextActive]}>
              {t('home.reminder_auto')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
export function DetailModal({ item, coords, apiUserId, currentUserRole, onClose, onDelete, onEdit }) {
  const { t, i18n } = useTranslation();
  useMinuteTick();
  const locale = LOCALE_MAP[i18n.language?.split('-')[0]] ?? 'fr-FR';
  const isAr = i18n.language?.startsWith('ar');
  const fmtDist = (d) => isAr
    ? d.toLocaleString('ar-SA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : d.toFixed(1);
  const getGenreLabel = useGenreLabel();
  const genreLabel = getGenreLabel(item.genre);
  const nomAffiche = item.estAnonyme ? t('home.anonymous') : (formatNomDefunt(item.nomDefunt) || t('home.not_specified'));
  const canDelete = (apiUserId != null && item.utilisateurId != null && Number(apiUserId) === Number(item.utilisateurId))
    || currentUserRole === 'admin' || currentUserRole === 'superadmin';
  const d = distKm(coords, item);

  async function copyAddress() {
    await Clipboard.setStringAsync(item.adresse);
  }

  function openDirections() {
    const address = encodeURIComponent(item.adresse || '');
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    if (Platform.OS === 'ios') {
      Linking.openURL(`maps://?daddr=${address}`).catch(() => Linking.openURL(googleMapsUrl));
    } else {
      Linking.openURL(googleMapsUrl);
    }
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
            <StatusBadge statut={computeStatut(item)} />
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
              style={[styles.deleteModalBtn, { borderColor: colors.primary }]}
              onPress={() => { onClose(); setTimeout(() => onEdit?.(item), 350); }}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={[styles.deleteModalBtnText, { color: colors.primary }]}>{t('profile.edit')}</Text>
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity
              style={styles.deleteModalBtn}
              onPress={() => { onClose(); setTimeout(() => onDelete(item.id), 300); }}
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
  const { bottom: insetBottom } = useSafeAreaInsets();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const apiUser = useSelector((state) => state.auth.apiUser);
  const apiUserId = useSelector((state) => state.auth.apiUser?.id);
  const isGuest = useSelector((state) => state.auth.isGuest);
  const items = useSelector((state) => state.janazas.list);
  const subscriptions = useSelector((state) => state.mosques.subscriptions);
  const locationMode = useSelector((state) => state.ui.locationMode);
  const donationButtonVisible = useSelector((state) => state.features.donationButtonVisible);
  const [selected, setSelected] = useState(null);
  const [editDecl, setEditDecl] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const globeBreath = useRef(new Animated.Value(0)).current;
  const [homeCoords, setHomeCoords] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);

  useEffect(() => {
    if (apiUser?.latitudeDomicile && apiUser?.longitudeDomicile)
      setHomeCoords({ latitude: apiUser.latitudeDomicile, longitude: apiUser.longitudeDomicile });
    else setHomeCoords(null);
  }, [apiUser?.latitudeDomicile, apiUser?.longitudeDomicile]);

  async function refreshGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {}
  }

  // Feature flags (public, pas besoin d'auth)
  useEffect(() => {
    apiClient.get('/api/features')
      .then(res => dispatch({ type: 'FEATURES_LOADED', payload: { donationButtonVisible: res.data.donationButtonVisible } }))
      .catch(() => {});
  }, []);

  // Charger les abonnements au montage pour que isSubscribed soit correct
  useEffect(() => {
    if (!apiUserId) return;
    apiClient.get(`/api/abonnement/utilisateur/${apiUserId}`)
      .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
      .catch(() => {});
  }, [apiUserId]);

  useEffect(() => {
    if (showAll) {
      globeBreath.stopAnimation();
      globeBreath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(globeBreath, { toValue: 1, duration: 1300, useNativeDriver: false }),
        Animated.timing(globeBreath, { toValue: 0, duration: 1300, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showAll]);

  // Restore persisted location mode (en cas d'ouverture avant l'onglet mosquée)
  useEffect(() => {
    AsyncStorage.getItem('map_location_mode')
      .then(saved => { if (saved) dispatch({ type: 'SET_LOCATION_MODE', payload: saved }); })
      .catch(() => {});
  }, []);

  function persistLocationMode(mode) {
    dispatch({ type: 'SET_LOCATION_MODE', payload: mode });
    AsyncStorage.setItem('map_location_mode', mode).catch(() => {});
    if (apiUserId) {
      apiClient.put(`/api/utilisateur/${apiUserId}`, { modeLocalisation: mode }).catch(() => {});
    }
  }

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

  const refreshAllData = useCallback(
    () => refreshAllDataUtil(dispatch, apiUserId),
    [dispatch, apiUserId]
  );

  useFocusEffect(useCallback(() => {
    refreshAllData();
  }, [refreshAllData]));

  // Polling toutes les 90s quand l'app est au premier plan
  useEffect(() => {
    const POLL_MS = 90 * 1000;
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      refreshAllData();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refreshAllData]);

  // GPS : sans adresse domicile (fallback) ou avec adresse mais mode GPS actif
  useEffect(() => {
    if (!apiUser?.adresseDomicile || locationMode === 'gps') refreshGps();
  }, [apiUser?.adresseDomicile, locationMode]);



  const activeCoords = useMemo(() => {
    if (!apiUser?.adresseDomicile) return gpsCoords;
    return locationMode === 'home' ? (homeCoords ?? gpsCoords) : (gpsCoords ?? homeCoords);
  }, [locationMode, homeCoords, gpsCoords, apiUser?.adresseDomicile]);

  // Auto-expire 2h after prayer time
  useEffect(() => {
    dispatch({ type: 'JANAZA_EXPIRE' });
    const timer = setInterval(() => dispatch({ type: 'JANAZA_EXPIRE' }), 60_000);
    return () => clearInterval(timer);
  }, []);

  const subscribedMosqueeIds = useMemo(() => new Set(
    subscriptions.map(s => s.mosqueeId).filter(Boolean)
  ), [subscriptions]);

  // Subset : abonnements avec notifications actives — pour l'affichage "Rappel automatique"
  const notifActiveMosqueeIds = useMemo(() => new Set(
    subscriptions.filter(s => s.notifActive).map(s => s.mosqueeId).filter(Boolean)
  ), [subscriptions]);

  // Filter by radius then group by mosque, sorted by nearest first (or by prayer time if no coords)
  const groups = useMemo(() => {
    const rayon = apiUser?.rayonNotification ?? 5;

    const filtered = (!showAll && activeCoords)
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
    if (!apiUser?.adresseDomicile || locationMode === 'gps') await refreshGps();
    await refreshAllData();
    dispatch({ type: 'JANAZA_EXPIRE' });
    setRefreshing(false);
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
            refreshAllData();
          },
        },
      ]
    );
  }

  const rayon = apiUser?.rayonNotification ?? 5;
  const inRadiusCount = activeCoords
    ? groups.filter(g => haversineKm(activeCoords.latitude, activeCoords.longitude, g.latitude, g.longitude) <= rayon).length
    : groups.length;

  const [filSearch, setFilSearch]     = useState('');
  const [filGenre, setFilGenre]       = useState(null);
  const [filOpen, setFilOpen]         = useState(false);
  const [donationVisible, setDonationVisible]   = useState(false);
  const [donationAmount, setDonationAmount]     = useState(null);
  const [donationCustom, setDonationCustom]     = useState('');
  const [donationLoading, setDonationLoading]   = useState(false);

  const totalJanazas = items.length;
  const showFilSearch = totalJanazas >= 4;
  const hasActiveFilter = !!filSearch || !!filGenre;

  const parsedCustom = parseFloat(donationCustom);
  const effectiveAmount = donationCustom && !isNaN(parsedCustom) ? parsedCustom : donationAmount;

  const handleDonate = async () => {
    if (!effectiveAmount || donationLoading) return;
    setDonationLoading(true);
    try {
      const res = await apiClient.post('/api/payment/checkout', {
        amountCents: Math.round(effectiveAmount * 100),
      });
      await WebBrowser.openAuthSessionAsync(res.data.url, 'qabr://');
      setDonationVisible(false);
      setDonationAmount(null);
      setDonationCustom('');
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le lien de paiement.');
    } finally {
      setDonationLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!filSearch && !filGenre) return groups;
    const q = filSearch.trim().toLowerCase();
    return groups.map(group => {
      let janazas = group.janazas;
      if (filGenre) janazas = janazas.filter(j => j.genre === filGenre);
      if (q) {
        const mosqueMatch =
          (group.mosquee ?? '').toLowerCase().includes(q) ||
          (group.adresse  ?? '').toLowerCase().includes(q);
        if (!mosqueMatch) {
          janazas = janazas.filter(j =>
            (j.nomDefunt        ?? '').toLowerCase().includes(q) ||
            (j.paysEnterrement  ?? '').toLowerCase().includes(q) ||
            (j.villeEnterrement ?? '').toLowerCase().includes(q)
          );
        }
      }
      return janazas.length > 0 ? { ...group, janazas } : null;
    }).filter(Boolean);
  }, [groups, filSearch, filGenre]);

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => {
                setShowAll(v => !v);
                apiClient.get('/api/prierejanaza/upcoming')
                  .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
                  .catch(() => {});
              }}
              style={{ padding: 0 }}
              activeOpacity={0.75}
            >
              <Animated.View style={[
                styles.globeToggle,
                showAll ? styles.globeToggleActive : {
                  backgroundColor: globeBreath.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.accent + '18'] }),
                  borderColor: globeBreath.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.accent + '66'] }),
                  transform: [{ scale: globeBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
                },
              ]}>
                {showAll ? (
                  <Ionicons name="earth" size={20} color={colors.accent} />
                ) : (
                  <View style={{ width: 20, height: 20 }}>
                    <Animated.View style={{ position: 'absolute', opacity: globeBreath }}>
                      <Ionicons name="earth" size={20} color={colors.accent} />
                    </Animated.View>
                    <Animated.View style={{ position: 'absolute', opacity: globeBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
                      <Ionicons name="earth-outline" size={20} color={colors.textMuted} />
                    </Animated.View>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
            {!isGuest && apiUser?.adresseDomicile && (
              <ModeToggle
                value={locationMode}
                onToggle={() => persistLocationMode(locationMode === 'gps' ? 'home' : 'gps')}
              />
            )}
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{count} {count <= 1 ? t('home.prayer_singular') : t('home.prayer_plural')}</Text>
            </View>
          </View>
        ); })()}
      </View>

      {showAll ? (
        <View style={[styles.radiusStrip, styles.radiusStripWorld]}>
          <Ionicons name="planet-outline" size={14} color={colors.accent} />
          <Text style={[styles.radiusStripText, { color: colors.accent, fontWeight: '600' }]} numberOfLines={1}>
            {groups.length} {groups.length <= 1 ? t('home.mosque_singular_world') : t('home.mosque_plural_world')}
          </Text>
          <View style={[styles.radiusStripBadge, styles.radiusStripBadgeWorld]}>
            <Text style={[styles.radiusStripBadgeText, { color: colors.white }]}>{t('home.world_all')}</Text>
          </View>
        </View>
      ) : apiUser?.adresseDomicile ? (
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

      {showFilSearch && (
        <View style={styles.filBar}>
          <TouchableOpacity
            style={[styles.filBtn, (filOpen || hasActiveFilter) && styles.filBtnActive]}
            onPress={() => setFilOpen(o => !o)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="options-outline"
              size={15}
              color={(filOpen || hasActiveFilter) ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.filBtnText, (filOpen || hasActiveFilter) && styles.filBtnTextActive]}>
              {t('home.filter')}
            </Text>
            {hasActiveFilter && (
              <View style={styles.filDot} />
            )}
          </TouchableOpacity>
          {hasActiveFilter && !filOpen && (
            <TouchableOpacity
              onPress={() => { setFilSearch(''); setFilGenre(null); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {donationButtonVisible && (
            <TouchableOpacity
              onPress={() => setDonationVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              activeOpacity={0.7}
              style={styles.donationSupportBtn}
            >
              <Ionicons name="heart" size={13} color="#e53e3e" />
              <Text style={styles.donationSupportText}>{t('home.support_btn')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showFilSearch && filOpen && (
        <View style={styles.filSearchBlock}>
          <View style={styles.filSearchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
            <TextInput
              style={styles.filSearchInput}
              placeholder={t('home.search_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={filSearch}
              onChangeText={setFilSearch}
              returnKeyType="search"
              autoFocus={false}
            />
            {!!filSearch && (
              <TouchableOpacity onPress={() => setFilSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filGenreRow}>
            {[null, 'homme', 'femme', 'enfant'].map((g) => (
              <TouchableOpacity
                key={g ?? 'tous'}
                style={[styles.filGenreChip, filGenre === g && styles.filGenreChipActive]}
                onPress={() => setFilGenre(g)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filGenreChipText, filGenre === g && styles.filGenreChipTextActive]}>
                  {g === null ? t('home.all') : t(`home.${g === 'homme' ? 'male' : g === 'femme' ? 'female' : 'child'}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <FlatList
        data={filteredGroups}
        keyExtractor={(g) => g.mosqueeId}
        renderItem={({ item: group }) => (
          <MosqueCard group={group} coords={activeCoords} onPressJanaza={setSelected} currentUserId={apiUserId} currentUserRole={user?.role} onDelete={handleDelete} onEdit={setEditDecl} isSubscribed={notifActiveMosqueeIds.has(String(group.mosqueeId))} showWorldFlag={showAll} />
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
          apiUserId={apiUserId}
          currentUserRole={user?.role}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onEdit={setEditDecl}
        />
      )}
      {editDecl && (
        <EditDeclarationModal
          item={editDecl}
          onClose={() => setEditDecl(null)}
          onSaved={(updated) => {
            dispatch({ type: 'JANAZA_UPDATE', payload: updated });
            setEditDecl(null);
            refreshAllData();
          }}
        />
      )}

      <Modal
        visible={donationVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDonationVisible(false)}
      >
        <View style={styles.donationOverlay}>
          <TouchableWithoutFeedback onPress={() => setDonationVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.donationSheet, { minHeight: SHEET_H, paddingBottom: insetBottom + spacing.xxl }]}
            style={{ maxHeight: SHEET_H }}
          >
          <View style={styles.donationHandleBar} />
          <TouchableOpacity style={styles.donationCloseBtn} onPress={() => setDonationVisible(false)}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.donationIconRing}>
            <Ionicons name="heart" size={30} color="#e53e3e" />
          </View>
          <Text style={styles.donationTitle}>{t('home.support_title')}</Text>
          <Text style={styles.donationDesc}>{t('home.support_desc')}</Text>

          <View style={styles.donationUsage}>
            <Text style={styles.donationUsageTitle}>{t('home.support_usage_title')}</Text>
            {[
              { icon: 'server-outline',    key: 'support_usage_hosting' },
              { icon: 'code-slash-outline', key: 'support_usage_dev' },
              { icon: 'construct-outline',  key: 'support_usage_maintenance' },
            ].map(({ icon, key }) => (
              <View key={key} style={styles.donationUsageRow}>
                <View style={styles.donationUsageIconWrap}>
                  <Ionicons name={icon} size={14} color={colors.primary} />
                </View>
                <Text style={styles.donationUsageText}>{t(`home.${key}`)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.donationHadith}>
            <Text style={styles.donationHadithAr}>اللَّهُمَّ اجْزِهِ خَيْرًا فِي الدُّنْيَا وَالْآخِرَةِ</Text>
            <Text style={styles.donationHadithText}>{t('home.support_dua')}</Text>
          </View>

          <View style={styles.donationAmountsGrid}>
            {[1, 2, 5, 10, 20, 50].map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.donationAmountBtn, donationAmount === a && !donationCustom && styles.donationAmountBtnActive]}
                onPress={() => { setDonationAmount(a); setDonationCustom(''); }}
              >
                <Text style={[styles.donationAmountText, donationAmount === a && !donationCustom && styles.donationAmountTextActive]}>
                  {a}€
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.donationCustomInput, !!donationCustom && styles.donationCustomInputActive]}
            placeholder={t('home.support_custom')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={donationCustom}
            onChangeText={v => { setDonationCustom(v.replace(/[^0-9.]/g, '')); setDonationAmount(null); }}
          />

          {effectiveAmount ? (
            <View style={styles.donationRecap}>
              <Text style={styles.donationRecapLabel}>{t('home.support_recap')}</Text>
              <Text style={styles.donationRecapAmount}>{effectiveAmount} €</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.donationCta, (!effectiveAmount || donationLoading) && styles.donationCtaDisabled]}
            onPress={handleDonate}
            disabled={!effectiveAmount || donationLoading}
            activeOpacity={0.8}
          >
            {donationLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="card-outline" size={18} color="#fff" />
            }
            <Text style={styles.donationCtaText}>
              {donationLoading ? '...' : (effectiveAmount ? t('home.support_cta_confirm') : t('home.support_choose'))}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setDonationVisible(false)} style={styles.donationBack}>
            <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
            <Text style={styles.donationBackText}>{t('home.support_back')}</Text>
          </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  radiusStripWorld: {
    backgroundColor: colors.accent + '0F',
    borderBottomColor: colors.accent + '33',
  },
  radiusStripBadgeWorld: {
    backgroundColor: colors.accent,
  },

  globeToggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  globeToggleActive: {
    backgroundColor: colors.accent + '18',
    borderColor: colors.accent + '66',
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
  janazaLeftCol: { alignItems: 'center', gap: spacing.xs },
  janazaTimePill: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    minWidth: 52,
    alignItems: 'center',
  },
  janazaTime: { fontSize: 13, fontWeight: '700', color: colors.primary },
  janazaAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(92, 128, 98, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  janazaGenreImg: { width: 46, height: 46 },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  countryFlagBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countryFlag: { fontSize: 22, lineHeight: 28 },
  countryName: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },

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

  donationSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#e53e3e',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    backgroundColor: '#fff0f0',
  },
  donationSupportText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e53e3e',
  },
  donationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  donationSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  donationHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  donationCloseBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: 6,
  },
  donationIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  donationTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  donationDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  donationAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: '100%',
  },
  donationAmountBtn: {
    width: '30%',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  donationAmountBtnActive: {
    borderColor: '#e53e3e',
    backgroundColor: '#fff0f0',
  },
  donationAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  donationAmountTextActive: {
    color: '#e53e3e',
  },
  donationCustomInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  donationCustomInputActive: {
    borderColor: '#e53e3e',
  },
  donationRecap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: colors.primaryDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  donationRecapLabel: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  donationRecapAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  donationCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#635BFF',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  donationCtaDisabled: {
    backgroundColor: colors.border,
  },
  donationCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  donationBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  donationBackText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  donationUsage: {
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  donationUsageTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  donationUsageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  donationUsageIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donationUsageText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  donationHadith: {
    backgroundColor: colors.primaryDim,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
    width: '100%',
  },
  donationHadithAr: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'right',
    lineHeight: 26,
    marginBottom: 6,
  },
  donationHadithText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },

  filBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    backgroundColor: colors.surface,
  },
  filBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filBtnTextActive: { color: colors.white },
  filDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  filSearchBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  filSearchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filSearchInput: { flex: 1, fontSize: 15, color: colors.text },
  filGenreRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.xs },
  filGenreChip: {
    paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filGenreChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  filGenreChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filGenreChipTextActive: { color: colors.primary },
});
