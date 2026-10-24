// City-boundary pin validation shared by bar/branch location saves.
// No DB schema involved: boundaries are fetched from Nominatim
// (polygon_geojson) and cached in memory with a TTL.
//
// Preferred chain: boundary polygon (+150 m edge tolerance) -> caller
// falls back to reverse-geocode city compare -> caller falls back to bbox.

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const NOMINATIM_UA = 'ThePartyGoers-BarOps/1.0 (contact: thepartygoersph@gmail.com)';
// Cavite area as Nominatim viewbox (left,top,right,bottom in lon/lat).
const CAVITE_VIEWBOX = '120.50,13.90,121.25,14.65';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEG_CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_INTERVAL_MS = 1100;
const FETCH_TIMEOUT_MS = 15000;

const cache = new Map(); // normCity -> { at, data|null }
let lastCallAt = 0;

// Lowercase, collapse whitespace. Used for cache keys.
function normalizeCityName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Loose city equality: "City of Dasmarinas" == "Dasmarinas",
// "Cavite City" == "Cavite". Diacritics are NOT stripped here on purpose
// (Nominatim usually returns the ASCII variant, which matches anyway).
function citiesMatch(a, b) {
  const norm = (s) =>
    normalizeCityName(s)
      .replace(/^city of\s+/, '')
      .replace(/\s+city$/, '');
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && x === y;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function nominatimGet(path) {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${NOMINATIM_BASE}${path}`, {
      headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`Nominatim ${res.status}`);
      err.code = `NOMINATIM_${res.status}`;
      throw err;
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// GeoJSON Polygon/MultiPolygon -> array of outer rings [[[lng,lat],...]].
function outerRings(geojson) {
  if (!geojson) return [];
  if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
    return geojson.coordinates.length ? [geojson.coordinates[0]] : [];
  }
  if (geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates)) {
    return geojson.coordinates.map((p) => p[0]).filter(Boolean);
  }
  return [];
}

function computeBbox(rings) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  if (!Number.isFinite(minLat)) return null;
  return { minLat, maxLat, minLng, maxLng };
}

// Fetch (and cache) the administrative boundary for a city/municipality.
async function getCityBoundary(city) {
  const key = normalizeCityName(city);
  if (!key) return null;
  const hit = cache.get(key);
  const ttl = hit && hit.data ? CACHE_TTL_MS : NEG_CACHE_TTL_MS;
  if (hit && Date.now() - hit.at < ttl) return hit.data;

  const q = encodeURIComponent(`${String(city).trim()}, Cavite, Philippines`);
  const results = await nominatimGet(
    `/search?format=jsonv2&q=${q}&polygon_geojson=1&addressdetails=1&limit=5&viewbox=${CAVITE_VIEWBOX}&bounded=1`
  );
  const list = Array.isArray(results) ? results : [];
  const inCavite = (r) => /cavite/i.test(
    [r.address && r.address.state, r.address && r.address.county, r.display_name].filter(Boolean).join(' ')
  );
  const withPoly = list.filter((r) => outerRings(r.geojson).length > 0);
  const pick =
    withPoly.find((r) => r.class === 'boundary' && inCavite(r)) ||
    withPoly.find((r) => inCavite(r)) ||
    null;
  const data = pick
    ? { rings: outerRings(pick.geojson), bbox: null, label: pick.display_name ? pick.display_name.split(',')[0] : String(city).trim() }
    : null;
  if (data) data.bbox = computeBbox(data.rings);
  cache.set(key, { at: Date.now(), data });
  return data;
}

function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [ring[i][0], ring[i][1]];
    const [xj, yj] = [ring[j][0], ring[j][1]];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygons(lat, lng, rings) {
  return rings.some((ring) => pointInRing(lat, lng, ring));
}

// Approx distance (meters) from point to polygon edges (equirectangular).
function distToPolygonsMeters(lat, lng, rings) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const px = lng * kx;
  const py = lat * ky;
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ring[j][0] * kx - px;
      const ay = ring[j][1] * ky - py;
      const bx = ring[i][0] * kx - px;
      const by = ring[i][1] * ky - py;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx;
      const ey = ay + t * dy;
      const d = Math.sqrt(ex * ex + ey * ey);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Validate a map pin against a registered city.
 * Returns { ok:true } or { ok:false, reason, message } where reason is
 * 'no-city' | 'lookup-failed' | 'outside'. Never throws for expected cases.
 */
async function validatePinInCity(lat, lng, city, opts = {}) {
  const toleranceM = Number.isFinite(opts.toleranceM) ? opts.toleranceM : 150;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'invalid', message: 'Invalid coordinates.' };
  }
  const cityLabel = String(city || '').trim();
  if (!cityLabel) {
    return {
      ok: false,
      reason: 'no-city',
      message: 'Please complete the bar address (city/municipality) before setting the map location.',
    };
  }
  let boundary = null;
  try {
    boundary = await getCityBoundary(cityLabel);
  } catch (err) {
    return {
      ok: false,
      reason: 'lookup-failed',
      message: 'Could not verify the location boundary right now. Please try again.',
    };
  }
  if (!boundary || !boundary.rings.length) {
    return {
      ok: false,
      reason: 'lookup-failed',
      message: 'Could not verify the location boundary right now. Please try again.',
    };
  }
  if (pointInPolygons(lat, lng, boundary.rings)) return { ok: true };
  if (distToPolygonsMeters(lat, lng, boundary.rings) <= toleranceM) return { ok: true };
  return {
    ok: false,
    reason: 'outside',
    message: `Your pin must be inside ${cityLabel}. Your registered address is in ${cityLabel}.`,
  };
}

module.exports = {
  normalizeCityName,
  citiesMatch,
  getCityBoundary,
  pointInPolygons,
  distToPolygonsMeters,
  validatePinInCity,
};
