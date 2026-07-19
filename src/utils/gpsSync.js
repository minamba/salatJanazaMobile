import * as Location from 'expo-location';
import apiClient from '../lib/api/apiClient';

const GPS_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _intervalId = null;

async function syncGpsPosition(userId) {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await apiClient.put(`/api/utilisateur/${userId}`, {
      latitudeCourante: loc.coords.latitude,
      longitudeCourante: loc.coords.longitude,
    });
  } catch {
    // Silencieux : perte GPS ou réseau temporaire
  }
}

// Démarre la synchronisation périodique toutes les 5 min (mode GPS uniquement).
// Envoie une première mise à jour immédiate puis toutes les GPS_SYNC_INTERVAL_MS.
export function startGpsSync(userId) {
  stopGpsSync();
  if (!userId) return;
  syncGpsPosition(userId);
  _intervalId = setInterval(() => syncGpsPosition(userId), GPS_SYNC_INTERVAL_MS);
}

export function stopGpsSync() {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}
