export function getUtcOffsetMinutes(ianaTimezone, refDate) {
  try {
    const d = refDate ?? new Date();
    const formatter = new Intl.DateTimeFormat('en', { timeZone: ianaTimezone, timeZoneName: 'shortOffset' });
    const parts = formatter.formatToParts(d);
    const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC';
    const m = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return 0;
    const sign = m[1] === '+' ? 1 : -1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? '0', 10));
  } catch {
    return 0;
  }
}

export async function fetchTimezoneFromCoords(lat, lon) {
  try {
    const res = await fetch(
      `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`,
      { headers: { 'User-Agent': 'QabrApp/1.0' } }
    );
    const data = await res.json();
    return data.timeZone ?? null;
  } catch {
    return null;
  }
}
