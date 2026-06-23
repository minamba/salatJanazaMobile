// Search mosques worldwide by name using Nominatim
function mapNominatimItem(item) {
  const addr = item.address ?? {};
  const city = addr.city || addr.town || addr.village || addr.suburb;
  const postcode = addr.postcode;
  const cityPart = postcode && city ? `${postcode} ${city}` : (postcode ?? city);
  const parts = [addr.house_number, addr.road, cityPart].filter(Boolean);
  const nom = item.namedetails?.name || item.display_name?.split(',')[0]?.trim() || 'Mosquée';
  const adresse = parts.length > 0
    ? parts.join(', ')
    : (item.display_name?.split(',').slice(1, 3).join(',').trim() ?? '');
  return {
    id: `osm_${item.osm_type}_${item.osm_id}`,
    osmType: item.osm_type === 'node' ? 'N' : 'W',
    osmId: String(item.osm_id),
    nom,
    adresse,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    source: 'osm',
  };
}

export async function searchMosquesByNameOSM(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&namedetails=1&limit=20`,
      { headers: { 'User-Agent': 'QabrApp/1.0 (contact@myjanaza.fr)' } }
    );
    const data = await res.json();
    return data
      .filter((item) => item.type === 'place_of_worship')
      .slice(0, 15)
      .map(mapNominatimItem);
  } catch {
    return [];
  }
}

// Removes diacritics and lowercases — "Évry" → "evry", "Mosquée" → "mosquee"
export function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function filterMosques(mosques, query) {
  const q = normalize(query.trim());
  if (!q) return mosques;
  return mosques
    .filter((m) => normalize(m.nom).includes(q) || normalize(m.adresse).includes(q))
    .slice(0, 15);
}

// Fetches all mosques near a position without a name filter.
// Results are then filtered client-side so accent normalization works.
export async function fetchNearbyMosques(lat, lon, radiusKm = 50) {
  const radiusM = Math.max(Math.min(radiusKm, 100), 5) * 1000; // cap Overpass at 100 km — DB handles larger radii
  const q = `[out:json][timeout:25];(node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lon});way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lon}););out body center;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: q,
    headers: { 'Content-Type': 'text/plain' },
  });
  const data = await res.json();
  return data.elements
    .map((el) => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!elLat || !elLon) return null;
      const tags = el.tags ?? {};
      const nom = tags.name ?? tags['name:fr'] ?? 'Mosquée';
      const city = tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'];
      const postcode = tags['addr:postcode'];
      const cityPart = postcode && city ? `${postcode} ${city}` : (postcode ?? city);
      const parts = [
        tags['addr:housenumber'],
        tags['addr:street'],
        cityPart,
      ].filter(Boolean);
      const adresse = parts.length > 0 ? parts.join(', ') : (tags['addr:full'] ?? '');
      return {
        id: `osm_${el.type}_${el.id}`,
        osmType: el.type === 'node' ? 'N' : 'W',
        osmId: String(el.id),
        nom,
        adresse,
        latitude: elLat,
        longitude: elLon,
        source: 'osm',
      };
    })
    .filter(Boolean);
}

// Nominatim batch address enrichment for mosques missing an address
// Processes all missing in batches of 50 (Nominatim limit per request)
export async function enrichAddresses(mosques) {
  const missing = mosques.filter((m) => !m.adresse && m.osmType && m.osmId);
  if (missing.length === 0) return mosques;

  const addressMap = {};
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const ids = batch.map((m) => `${m.osmType}${m.osmId}`).join(',');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/lookup?osm_ids=${ids}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'QabrApp/1.0 (contact@myjanaza.fr)' } }
      );
      const data = await res.json();
      data.forEach((item) => {
        const addr = item.address ?? {};
        const city = addr.city || addr.town || addr.village || addr.suburb;
        const postcode = addr.postcode;
        const cityPart = postcode && city ? `${postcode} ${city}` : (postcode ?? city);
        const parts = [
          addr.house_number,
          addr.road,
          cityPart,
        ].filter(Boolean);
        addressMap[item.osm_id] =
          parts.length > 0
            ? parts.join(', ')
            : (item.display_name?.split(',').slice(0, 2).join(',').trim() ?? '');
      });
    } catch {}
  }

  return mosques.map((m) => ({
    ...m,
    adresse: m.adresse || (m.osmId ? (addressMap[m.osmId] ?? '') : ''),
  }));
}
