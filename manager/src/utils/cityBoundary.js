// City-boundary pin validation (browser mirror of backend
// utils/cityBoundary.js — same function names, messages, and 150 m
// edge tolerance). Boundaries come from Nominatim (polygon_geojson) and
// are cached in memory + localStorage. Pure geometry runs synchronously.

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const VIEWBOX = '120.50,13.90,121.25,14.65';
const LS_PREFIX = 'tpg_city_boundary_v1_';
const LS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const memCache = new Map();

export function normalizeCityName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function citiesMatch(a, b) {
  const norm = (s) =>
    normalizeCityName(s)
      .replace(/^city of\s+/, '')
      .replace(/\s+city$/, '');
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && x === y;
}

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
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
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

function readCache(key) {
  if (memCache.has(key)) return memCache.get(key);
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.at > LS_TTL_MS) return undefined;
    memCache.set(key, parsed.data);
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeCache(key, data) {
  memCache.set(key, data);
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Private mode / quota — memory cache still works for the session.
  }
}

export async function getCityBoundary(city) {
  const key = normalizeCityName(city);
  if (!key) return null;
  const hit = readCache(key);
  if (hit !== undefined) return hit;
  const q = encodeURIComponent(`${String(city).trim()}, Cavite, Philippines`);
  const res = await fetch(
    `${NOMINATIM_BASE}/search?format=jsonv2&q=${q}&polygon_geojson=1&addressdetails=1&limit=5&viewbox=${VIEWBOX}&bounded=1`
  );
  if (!res.ok) throw new Error(`Boundary lookup failed (${res.status})`);
  const list = await res.json();
  const inCavite = (r) =>
    /cavite/i.test(
      [r.address && r.address.state, r.address && r.address.county, r.display_name]
        .filter(Boolean)
        .join(' ')
    );
  const withPoly = (Array.isArray(list) ? list : []).filter((r) => outerRings(r.geojson).length > 0);
  const pick =
    withPoly.find((r) => r.class === 'boundary' && inCavite(r)) ||
    withPoly.find((r) => inCavite(r)) ||
    null;
  const data = pick
    ? {
        rings: outerRings(pick.geojson),
        bbox: null,
        label: pick.display_name ? pick.display_name.split(',')[0] : String(city).trim(),
      }
    : null;
  if (data) data.bbox = computeBbox(data.rings);
  writeCache(key, data);
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

export function pointInPolygons(lat, lng, rings) {
  return rings.some((ring) => pointInRing(lat, lng, ring));
}

export function distToPolygonsMeters(lat, lng, rings) {
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
 * Resolves { ok:true } or { ok:false, reason, message } with reason
 * 'no-city' | 'lookup-failed' | 'outside'. Network failure rejects so the
 * caller can distinguish "cannot verify" from "invalid".
 */
export async function validatePinInCity(lat, lng, city, opts = {}) {
  const toleranceM = Number.isFinite(opts.toleranceM) ? opts.toleranceM : 150;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'invalid', message: 'Invalid coordinates.' };
  }
  const cityLabel = String(city || '').trim();
  if (!cityLabel) {
    return {
      ok: false,
      reason: 'no-city',
      message: 'Please complete the address (city/municipality) before setting the map location.',
    };
  }
  const boundary = await getCityBoundary(cityLabel);
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
