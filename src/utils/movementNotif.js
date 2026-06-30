import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MOVEMENT_TASK = 'MOVEMENT_JANAZA_TASK';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.salatjanaza.org';
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

    // Seulement les janazas d'aujourd'hui dont l'heure n'est pas passée (force UTC parsing)
    const parseDate = (raw) => new Date(/Z$|[+-]\d{2}:/.test(raw) ? raw : raw + 'Z');
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const relevant = janazas.filter(
      (j) =>
        j.mosqueeLatitude != null &&
        j.mosqueeLongitude != null &&
        parseDate(j.dateHeurePriere) > now &&
        parseDate(j.dateHeurePriere) <= oneHourLater,
    );

    const notified = await getNotifiedToday();
    let changed = false;

    for (const j of relevant) {
      const key = `${j.id}`;
      if (notified.has(key)) continue;

      const dist = distKm(latitude, longitude, j.mosqueeLatitude, j.mosqueeLongitude);
      if (dist <= PROXIMITY_KM) {
        const prayerDate = parseDate(j.dateHeurePriere);
        const minutesLeft = Math.round((prayerDate - now) / 60000);
        const heure = prayerDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const defunt = j.estAnonyme || !j.nomDefunt ? 'Défunt anonyme' : j.nomDefunt;
        const genre = j.genre?.toLowerCase();
        const genreLabel = genre === 'homme' ? 'Homme' : genre === 'femme' ? 'Femme' : genre === 'enfant' ? 'Enfant' : null;
        const timeLabel = minutesLeft <= 60 ? `dans ${minutesLeft} min` : `à ${heure}`;

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
          notificationBody: 'Surveillance des mosquées environnantes active',
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
