import { useEffect, useState } from 'react';

// Same formula as the server (ToModelWithComputedStatut) and push notification service:
//   trueUtc = DateHeurePriere (wall-clock stored as UTC) - utcOffsetMinutes
//   à venir   → trueUtc > now
//   en cours  → trueUtc <= now AND trueUtc > now - 2h
//   terminée  → trueUtc <= now - 2h
export function computeStatut(item) {
  const dateHeure = item.dateHeure instanceof Date ? item.dateHeure : new Date(item.dateHeure);
  const offset = item.utcOffsetMinutes || (-new Date().getTimezoneOffset());
  const trueUtcMs = dateHeure.getTime() - offset * 60_000;
  const now = Date.now();
  if (trueUtcMs > now) return 'a_venir';
  if (trueUtcMs > now - 90 * 60 * 1000) return 'en_cours';
  return 'terminee';
}

// Re-renders the calling component every minute so statut stays current.
export function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}
