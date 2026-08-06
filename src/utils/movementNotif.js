import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatNomDefunt } from './text';
import i18n, { SUPPORTED_LANGUAGES } from '../i18n';

export const MOVEMENT_TASK = 'MOVEMENT_JANAZA_TASK';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.salatjanaza.org';
import { getDateLocale } from './dateLocale';
const PROXIMITY_KM = 10; // 10 km

function distKm(lat1, lon1, lat2, lon2) {
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

async function getNotifiedToday() {
  try {
    const raw = await AsyncStorage.getItem('movement_notified');
    if (!raw) return new Set();
    const { date, ids } = JSON.parse(raw);
    if (date !== new Date().toDateString()) return new Set();
    return new Set(ids);
  } catch {
    return new Set();
  }
}

async function saveNotified(ids) {
  await AsyncStorage.setItem(
    'movement_notified',
    JSON.stringify({ date: new Date().toDateString(), ids: [...ids] }),
  );
}

// La tâche doit être définie au niveau module (avant tout render)
TaskManager.defineTask(MOVEMENT_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.[0]) return;

  const { latitude, longitude } = data.locations[0].coords;

  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (!token) return;

    const res = await fetch(`${API_URL}/api/prierejanaza/upcoming`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const janazas = await res.json();
    const now = new Date();
    const todayStr = now.toDateString();

    // Wall-clock UTC → interprété comme heure locale de l'appareil (même chiffre partout)
    const parseDate = (raw) => new Date(/Z$|[+-]\d{2}:/.test(raw) ? raw : raw + 'Z');
    const toLocalTime = (raw) => {
      const d = parseDate(raw);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0);
    };
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const relevant = janazas.filter(
      (j) =>
        j.mosqueeLatitude != null &&
        j.mosqueeLongitude != null &&
        toLocalTime(j.dateHeurePriere) > now &&
        toLocalTime(j.dateHeurePriere) <= oneHourLater,
    );

    const notified = await getNotifiedToday();
    const savedLang = await AsyncStorage.getItem('@app_language').catch(() => null);
    const lang = savedLang && SUPPORTED_LANGUAGES.includes(savedLang) ? savedLang : 'fr';
    const locale = getDateLocale(lang);
    if (i18n.language !== lang) await i18n.changeLanguage(lang);
    let changed = false;

    for (const j of relevant) {
      const key = `${j.id}`;
      if (notified.has(key)) continue;

      const dist = distKm(latitude, longitude, j.mosqueeLatitude, j.mosqueeLongitude);
      if (dist <= PROXIMITY_KM) {
        const prayerDate = parseDate(j.dateHeurePriere);
        const prayerLocal = toLocalTime(j.dateHeurePriere);
        const minutesLeft = Math.round((prayerLocal - now) / 60000);
        const heure = prayerDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

        const defunt = j.estAnonyme || !j.nomDefunt ? i18n.t('home.anonymous') : formatNomDefunt(j.nomDefunt);
        const genre = j.genre?.toLowerCase();
        const genreLabel = genre === 'homme' ? i18n.t('home.male') : genre === 'femme' ? i18n.t('home.female') : genre === 'enfant' ? i18n.t('home.child') : null;
        const timeLabel = minutesLeft <= 60 ? i18n.t('home.notif_in_min', { count: minutesLeft }) : i18n.t('home.notif_at', { time: heure });

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🕌 Salat al-Janaza · ${j.mosqueeNom}`,
            body: `${defunt}${genreLabel ? ` (${genreLabel})` : ''} · ${timeLabel}${j.mosqueeAdresse ? ` · ${j.mosqueeAdresse}` : ''}`,
            sound: 'default',
            // Android 8+ : obligatoire, sinon la notification est rejetée silencieusement
            ...(Platform.OS === 'android' && { channelId: 'default', priority: 'high' }),
          },
          trigger: null,
        });
        notified.add(key);
        changed = true;
      }
    }

    if (changed) await saveNotified(notified);
  } catch {
    // Silence — tâche background
  }
});

export async function startMovementTracking() {
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(MOVEMENT_TASK);
    if (already) return;

    await Location.startLocationUpdatesAsync(MOVEMENT_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 200, // déclenche toutes les 200 m
      showsBackgroundLocationIndicator: true,
      ...(Platform.OS === 'android' && {
        foregroundService: {
          notificationTitle: 'Salat Janaza',
          notificationBody: i18n.t('profile.movement_tracking_body'),
          notificationColor: '#238636',
        },
      }),
    });
  } catch (e) {
    console.warn('[MovementNotif] startTracking error:', e?.message);
  }
}

export async function stopMovementTracking() {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(MOVEMENT_TASK);
    if (running) await Location.stopLocationUpdatesAsync(MOVEMENT_TASK);
  } catch (e) {
    console.warn('[MovementNotif] stopTracking error:', e?.message);
  }
}
