// Géocodage en cascade : Nominatim → api-adresse (FR gov) → Photon (Komoot)
// Retourne { lat, lon } ou null si aucune source ne trouve l'adresse.
export async function geocodeAddress(address) {
  // 1. Nominatim (OpenStreetMap)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'QabrApp/1.0' } }
    );
    const data = await res.json();
    if (data?.[0]?.lat) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {}

  // 2. API Adresse (gouvernement français) — meilleure couverture des adresses FR
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await res.json();
    const c = data?.features?.[0]?.geometry?.coordinates;
    if (c) return { lat: c[1], lon: c[0] };
  } catch {}

  // 3. Photon (Komoot) — fallback mondial
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await res.json();
    const c = data?.features?.[0]?.geometry?.coordinates;
    if (c) return { lat: c[1], lon: c[0] };
  } catch {}

  return null;
}
