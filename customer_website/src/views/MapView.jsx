import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { barService } from '../services/barService';
import { imageUrl } from '../utils/imageUrl';
import { useView } from '../hooks/useView';
import { useTheme } from '../hooks/useTheme';
import { VIEWS } from '../contexts/ViewContext';
import { MapPin, Loader2, CheckCircle, Volume2, Star, Navigation, Ruler, Timer, ArrowRight, Sparkles, ChevronDown, ChevronUp, TrendingUp, Compass } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Cavite province bounds (approximate)
const CAVITE_BOUNDS = [
  [14.1, 120.6],  // Southwest corner
  [14.7, 121.2]   // Northeast corner
];

// iOS Maps-style blue pulsing circle with direction triangle for user location
const createUserLocationIcon = (heading = 0) => {
  // Ensure heading is a valid number between 0-360
  const rotation = (heading !== null && !isNaN(heading)) ? (heading % 360) : 0;
  return L.divIcon({
    html: `<div style="position:relative;width:40px;height:40px;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;background:rgba(59,130,246,0.2);border-radius:50%;animation:pulse 2s ease-out infinite;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.6),0 2px 4px rgba(0,0,0,0.3);"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(${rotation}deg);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid #fff;margin-top:-16px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));transition:transform 0.3s ease;"></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform:translate(-50%,-50%) scale(0.5); opacity:1; }
        100% { transform:translate(-50%,-50%) scale(1.5); opacity:0; }
      }
    </style>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

const NEAR_KM = 5;
const RECOMMENDATION_MAX_KM = 10;
const DEFAULT_RADIUS_KM = 10;

// Check if a bar is currently open based on its hours string
function isBarOpenNow(bar) {
  const now = new Date();
  const dayKeys = ['sunday_hours','monday_hours','tuesday_hours','wednesday_hours','thursday_hours','friday_hours','saturday_hours'];
  const hoursStr = bar[dayKeys[now.getDay()]];
  if (!hoursStr) return false;
  const normalized = String(hoursStr).replace(/\s+to\s+/gi, ' - ').trim();
  const match = normalized.match(/(.+?)\s*-\s*(.+)/);
  if (!match) return false;
  const parseMin = (t) => {
    const s = String(t).trim().toLowerCase();
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m) return null;
    let h = Number(m[1]); const mn = Number(m[2] || 0);
    if (m[3]) { if (m[3]==='am'&&h===12) h=0; if (m[3]==='pm'&&h!==12) h+=12; }
    return h*60+mn;
  };
  const start = parseMin(match[1]), end = parseMin(match[2]);
  if (start === null || end === null) return false;
  const cur = now.getHours()*60 + now.getMinutes();
  return end > start ? (cur >= start && cur < end) : (cur >= start || cur < end);
}

// Rank nearby venues by distance, rating, review count, and whether they are open.
function scoreBars(bars, userLocation) {
  if (!userLocation || !bars.length) return [];
  const scored = bars.reduce((acc, bar) => {
    const lat = Number(bar.latitude), lng = Number(bar.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return acc;
    const km = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
    if (km > RECOMMENDATION_MAX_KM) return acc;
    const distScore = Math.max(0, 40 * (1 - km / RECOMMENDATION_MAX_KM));
    const rating = Number(bar.rating || 0);
    const ratingScore = (rating / 5) * 35;
    const reviews = Math.min(Number(bar.review_count || 0), 100);
    const reviewScore = (reviews / 100) * 15;
    const openBonus = isBarOpenNow(bar) ? 10 : 0;
    const total = distScore + ratingScore + reviewScore + openBonus;
    acc.push({ ...bar, _km: km, _score: total, _open: isBarOpenNow(bar) });
    return acc;
  }, []);
  return scored.sort((a, b) => b._score - a._score).slice(0, 5);
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-US'; utt.rate = 1; utt.pitch = 1;
  window.speechSynthesis.speak(utt);
}

// ── Live turn-by-turn navigation (direct OSRM, no API key) ────────────────
// OSRM public demo server, "driving" profile = fastest path by design speeds.
// NOTE: OSRM has no live-traffic feed (neither does ORS free tier); true
// traffic-aware routing needs a paid key (TomTom/Mapbox). No .env key needed.
const OSRM_URL = 'https://router.project-osrm.org/route/v1';
const OFF_ROUTE_M = 45;          // lateral deviation that triggers a reroute
const OFF_ROUTE_FIXES = 2;       // consecutive off-route fixes before rerouting
const REROUTE_COOLDOWN_MS = 8000;
const ARRIVE_M = 40;             // within this of destination = arrived
const STEP_ADVANCE_M = 30;       // closeness to a step end before advancing
const LIVE_REPORT_M = 5;         // min movement (m) before reporting live pos
const HEADING_REPORT_DEG = 15;
const FIX_MIN_ACCURACY_M = 80;   // ignore noisy fixes (desktop WiFi geo) for routing decisions

// Point-to-segment projection in meters (equirectangular, fine for nav scales).
// Returns { lateral, along, t } where along is meters from A toward B.
function projectPoint(lat, lng, ax, ay, bx, by) {
  const kx = 111320 * Math.cos(((ax + bx) / 2 * Math.PI) / 180);
  const ky = 110540;
  const px = (lng - ay) * kx, py = (lat - ax) * ky;
  const dx = (by - ay) * kx, dy = (bx - ax) * ky;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? (px * dx + py * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = px - t * dx, cy = py - t * dy;
  return { lateral: Math.sqrt(cx * cx + cy * cy), along: t * Math.sqrt(len2), t };
}

// Project a position onto the whole route. coords = [[lat,lng]...].
// Returns { distAlong, lateral, index }.
function projectOntoRoute(lat, lng, coords, cum) {
  let best = { distAlong: 0, lateral: Infinity, index: 0 };
  let acc = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const segLen = (cum[i + 1] ?? acc) - acc;
    const p = projectPoint(lat, lng, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    if (p.lateral < best.lateral) {
      best = { distAlong: acc + p.along, lateral: p.lateral, index: p.t >= 1 ? i + 1 : i };
    }
    acc += segLen > 0 ? segLen : haversineKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]) * 1000;
  }
  return best;
}

function capFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Turn an OSRM route step into a "Head north"-style instruction string.
function formatOsrmStep(step) {
  const m = step.maneuver || {};
  const name = (step.name || '').trim();
  const on = name ? ` on ${name}` : '';
  const onto = name ? ` onto ${name}` : '';
  const mod = (m.modifier || '').replace(/_/g, ' ');
  switch (m.type) {
    case 'depart': return capFirst(`head ${mod || 'out'}${on}`.trim());
    case 'arrive': return 'Arrive at your destination';
    case 'turn': return capFirst(`turn ${mod || 'ahead'}${onto}`.trim());
    case 'new name': return capFirst(`continue${onto}`);
    case 'continue': return capFirst(`continue${on}`);
    case 'merge': return capFirst(`merge${onto}`);
    case 'on ramp': return capFirst(`take the ramp${onto}`);
    case 'off ramp': return capFirst(`take the exit${onto}`);
    case 'fork': return capFirst(`keep ${mod || 'straight'}${onto}`);
    case 'end of road': return capFirst(`at the end of the road, turn ${mod || 'ahead'}${onto}`.trim());
    case 'roundabout':
    case 'rotary': return m.exits ? `At the roundabout, take exit ${m.exits}` : 'Enter the roundabout';
    case 'roundabout turn': return capFirst(`at the roundabout, turn ${mod || 'ahead'}`);
    case 'notification': return name ? `Continue on ${name}` : 'Continue';
    default: return name ? `Follow ${name}` : 'Continue';
  }
}

async function fetchOsrmRoute(fromLat, fromLng, toLat, toLng, signal) {
  const url = `${OSRM_URL}/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Routing request failed (${res.status})`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(data.message || 'No route found');
  return data.routes[0];
}

// Optional TomTom key (free tier at https://developer.tomtom.com) for live
// traffic flow tiles + traffic-aware ETAs. Empty = traffic features off.
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';
const TOMTOM_TRAFFIC_TILES = TOMTOM_KEY
  ? `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`
  : null;

// Traffic-aware ETA via TomTom Routing API (returns null on any failure →
// caller keeps the OSRM ETA). Fire-and-forget side call, never blocks render.
async function fetchTrafficEta(fromLat, fromLng, toLat, toLng, signal) {
  if (!TOMTOM_KEY) return null;
  try {
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${fromLng},${fromLat}:${toLng},${toLat}/json?key=${TOMTOM_KEY}&traffic=true&travelMode=car`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const s = data?.routes?.[0]?.summary;
    if (!s || !Number.isFinite(s.travelTimeInSeconds)) return null;
    return {
      timeMin: Math.max(1, Math.round(s.travelTimeInSeconds / 60)),
      delayMin: Math.max(0, Math.round(((s.trafficDelayInSeconds || 0)) / 60)),
    };
  } catch (_) {
    return null;
  }
}

// In-memory route cache: same origin→destination (∼1m rounding) reuses the
// last result for 10 min instead of refetching (e.g. switching back to a
// previous target, or repeated identical reroute triggers). Capped at 20.
const ROUTE_CACHE_TTL_MS = 10 * 60 * 1000;
const routeCache = new Map();
function routeCacheKey(fromLat, fromLng, toLat, toLng) {
  return `${fromLat.toFixed(5)},${fromLng.toFixed(5)}>${toLat.toFixed(5)},${toLng.toFixed(5)}`;
}
function routeCacheGet(key) {
  const hit = routeCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ROUTE_CACHE_TTL_MS) { routeCache.delete(key); return null; }
  return hit.route;
}
function routeCachePut(key, route) {
  if (routeCache.size >= 20) {
    const oldest = routeCache.keys().next().value;
    routeCache.delete(oldest);
  }
  routeCache.set(key, { route, ts: Date.now() });
}

function LiveNavigation({ initialPos, destination, barName, voiceEnabled, isLightMode, onRouteUpdate, onLivePosition, onArrived, onRouteError }) {
  const map = useMap();
  const [remaining, setRemaining] = useState([]);
  const [traveled, setTraveled] = useState([]);
  const S = useRef(null);
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;
  if (!S.current) {
    S.current = {
      coords: [], cum: [], totalDist: 0, totalDur: 0,
      steps: [], stepIdx: 0, offCount: 0, arriveCount: 0,
      lastReroute: 0, errorSent: false, lastReported: null, announced: -1,
    };
  }

  const applyRoute = useCallback((route, fromLabel) => {
    const st = S.current;
    const coords = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    if (coords.length < 2) throw new Error('No route found');
    const cum = [0];
    for (let i = 1; i < coords.length; i++) {
      cum.push(cum[i - 1] + haversineKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]) * 1000);
    }
    // Map each OSRM step start to a route index (monotonic forward search)
    const rawSteps = route.legs?.[0]?.steps || [];
    const steps = [];
    let searchFrom = 0;
    rawSteps.forEach((s) => {
      const [slng, slat] = s.maneuver?.location || [null, null];
      if (slat === null) return;
      let bestI = searchFrom, bestD = Infinity;
      for (let i = searchFrom; i < coords.length; i++) {
        const d = haversineKm(slat, slng, coords[i][0], coords[i][1]);
        if (d < bestD) { bestD = d; bestI = i; }
        if (i - searchFrom > 60 && d > bestD) break;
      }
      searchFrom = bestI;
      steps.push({ text: formatOsrmStep(s), startIdx: bestI, dist: s.distance, dur: s.duration });
    });
    // Step end distances (next step start, last step ends at route end)
    steps.forEach((s, i) => {
      s.endDist = i + 1 < steps.length ? cum[steps[i + 1].startIdx] : cum[cum.length - 1];
    });
    st.coords = coords; st.cum = cum;
    st.totalDist = route.distance; st.totalDur = route.duration;
    st.steps = steps.length ? steps : [{ text: `Head to ${barName}`, startIdx: 0, endDist: cum[cum.length - 1], dist: route.distance, dur: route.duration }];
    st.stepIdx = 0; st.offCount = 0; st.arriveCount = 0; st.announced = -1; st.lastPanelRd = null;
    st.trafficTimeMin = null; st.trafficBaseM = 0; st.trafficDelayMin = 0;
    setTraveled([]);
    setRemaining(coords);
    const instructions = st.steps.map((s) => ({ text: s.text }));
    onRouteUpdate({
      distance: (route.distance / 1000).toFixed(2),
      time: Math.max(1, Math.round(route.duration / 60)),
      instructions, steps: st.steps, currentStep: 0,
    });
    if (voiceRef.current && instructions.length) {
      speak(`${fromLabel} ${instructions[0].text}`);
    }
  }, [barName, onRouteUpdate]);

  useEffect(() => {
    if (!initialPos || !destination || !map) return;
    const st = S.current;
    let mounted = true, watchId = null;
    const aborter = { current: null };

    map.setView([initialPos.lat, initialPos.lng], 17, { animate: true });

    const loadRoute = async (from, label, isReroute) => {
      if (!mounted) return;
      aborter.current?.abort();
      const ac = new AbortController();
      aborter.current = ac;
      const cacheKey = routeCacheKey(from.lat, from.lng, destination.lat, destination.lng);
      try {
        // Serve repeat origin→destination pairs from memory (10-min TTL).
        const cached = !isReroute ? routeCacheGet(cacheKey) : null;
        const route = cached || await fetchOsrmRoute(from.lat, from.lng, destination.lat, destination.lng, ac.signal);
        if (!mounted) return;
        if (!cached) routeCachePut(cacheKey, route);
        if (isReroute) st.lastReroute = Date.now();
        applyRoute(route, label);
        // Traffic-aware ETA refinement (no-op without a TomTom key; never blocks).
        if (TOMTOM_KEY) {
          fetchTrafficEta(from.lat, from.lng, destination.lat, destination.lng, ac.signal).then((t) => {
            if (!mounted || !t) return;
            st.trafficTimeMin = t.timeMin;
            st.trafficBaseM = st.totalDist;
            st.trafficDelayMin = t.delayMin;
            onRouteUpdate({
              distance: (st.totalDist / 1000).toFixed(2),
              time: t.timeMin,
              trafficDelayMin: t.delayMin || undefined,
              instructions: st.steps.map((s) => ({ text: s.text })),
              steps: st.steps,
              currentStep: st.stepIdx,
            });
          });
        }
      } catch (e) {
        if (!mounted || e.name === 'AbortError') return;
        if (!st.errorSent) {
          st.errorSent = true;
          onRouteError('Could not find a driving route. Please check your connection and try again.');
        }
      }
    };

    const pushPanel = (userDistAlong) => {
      const remainingM = Math.max(0, st.totalDist - userDistAlong);
      // Prefer traffic-aware ETA when available (scaled by remaining distance),
      // otherwise fall back to OSRM duration proportional to remaining distance.
      let timeMin;
      if (st.trafficTimeMin != null && st.trafficBaseM > 0) {
        timeMin = Math.max(1, Math.round(st.trafficTimeMin * (remainingM / st.trafficBaseM)));
      } else {
        const frac = st.totalDist > 0 ? remainingM / st.totalDist : 0;
        timeMin = Math.max(1, Math.round((st.totalDur * frac) / 60));
      }
      onRouteUpdate({
        distance: (remainingM / 1000).toFixed(2),
        time: timeMin,
        trafficDelayMin: st.trafficDelayMin || undefined,
        instructions: st.steps.map((s) => ({ text: s.text })),
        steps: st.steps,
        currentStep: st.stepIdx,
      });
    };

    const handleFix = (position) => {
      if (!mounted || !st.coords.length) return;
      const lat = position.coords.latitude, lng = position.coords.longitude;
      const heading = position.coords.heading;
      const accuracy = position.coords.accuracy;
      // Noisy fix (e.g. desktop WiFi geolocation, hundreds of meters off)?
      // Still follow the dot, but don't let it drive routing decisions —
      // otherwise deviation counting + step/split updates storm and the line flickers.
      const fixReliable = accuracy === undefined || accuracy === null || accuracy <= FIX_MIN_ACCURACY_M;

      // Waze-style follow + heading rotation (no-op on stock Leaflet)
      if (heading !== null && !isNaN(heading)) {
        map.setBearing ? map.setBearing(heading) : null;
      }
      map.panTo([lat, lng], { animate: true, duration: 0.5 });

      // Report live position to parent (throttled by movement)
      const last = st.lastReported;
      const moved = !last ? Infinity : haversineKm(last.lat, last.lng, lat, lng) * 1000;
      const hdg = (heading !== null && !isNaN(heading)) ? heading : (last?.heading ?? 0);
      if (moved > LIVE_REPORT_M || Math.abs(hdg - (last?.heading ?? 0)) > HEADING_REPORT_DEG) {
        st.lastReported = { lat, lng, heading: hdg };
        onLivePosition({ lat, lng }, hdg);
      }

      // Arrival check (reliable fixes only)
      const destD = haversineKm(lat, lng, destination.lat, destination.lng) * 1000;
      if (fixReliable && destD < ARRIVE_M) {
        st.arriveCount += 1;
        if (st.arriveCount >= 2) {
          if (voiceRef.current) speak(`You have arrived at ${barName}. Enjoy!`);
          onArrived();
          return;
        }
      } else {
        st.arriveCount = 0;
      }

      const proj = projectOntoRoute(lat, lng, st.coords, st.cum);

      // Off-route? → count consecutive, then auto-reroute (reliable fixes only)
      if (fixReliable && proj.lateral > OFF_ROUTE_M) {
        st.offCount += 1;
        if (st.offCount >= OFF_ROUTE_FIXES && Date.now() - st.lastReroute > REROUTE_COOLDOWN_MS) {
          st.offCount = 0;
          if (voiceRef.current) speak('Rerouting to the fastest route.');
          loadRoute({ lat, lng }, 'New route.', true);
        }
        return;
      }
      st.offCount = 0;

      // Advance current step as the user passes step boundaries (reliable fixes only)
      let advanced = false;
      if (fixReliable) {
        while (st.stepIdx < st.steps.length - 1 && proj.distAlong > st.steps[st.stepIdx].endDist - STEP_ADVANCE_M) {
          st.stepIdx += 1;
          advanced = true;
        }
      }
      if (advanced && voiceRef.current) {
        speak(st.steps[st.stepIdx].text);
      }

      // Split polyline into traveled / remaining (reliable fixes only — keeps the line stable)
      if (fixReliable) {
        const cut = Math.max(0, Math.min(st.coords.length - 1, proj.index));
        const projPt = st.coords[cut];
        setTraveled(st.coords.slice(0, cut + 1).concat([projPt]));
        setRemaining([projPt].concat(st.coords.slice(cut + 1)));
      }
      if (advanced) pushPanel(proj.distAlong);
      else {
        // Refresh ETA/distance only when the rounded values actually change
        const rd = (Math.max(0, st.totalDist - proj.distAlong) / 1000).toFixed(2);
        if (rd !== st.lastPanelRd) { st.lastPanelRd = rd; pushPanel(proj.distAlong); }
      }
    };

    if (navigator.geolocation && 'watchPosition' in navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(handleFix, () => {}, {
        enableHighAccuracy: true, maximumAge: 1000, timeout: 20000,
      });
    }
    loadRoute(initialPos, 'Navigation started.', false);

    return () => {
      mounted = false;
      aborter.current?.abort();
      if (watchId !== null && navigator.geolocation) {
        try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, destination?.lat, destination?.lng]);

  return (
    <>
      {traveled.length > 1 && (
        <Polyline positions={traveled} smoothFactor={0} pathOptions={{ color: '#9aa0a6', weight: 5, opacity: 0.55, lineJoin: 'round', lineCap: 'round' }} />
      )}
      {remaining.length > 1 && (
        <Polyline
          positions={remaining}
          smoothFactor={0}
          pathOptions={{ color: isLightMode ? '#ffffff' : '#0d0d0d', weight: 10, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }}
        />
      )}
      {remaining.length > 1 && (
        <Polyline positions={remaining} smoothFactor={0} pathOptions={{ color: '#e8001e', weight: 6, opacity: 0.95, lineJoin: 'round', lineCap: 'round' }} />
      )}
    </>
  );
}

function MapCenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView([center.lat, center.lng], center.zoom ?? 15); }, [map, center]);
  return null;
}

// Navigation Mode follow view: on activation zoom in close, then keep the
// live position centered. Inactive → renders nothing, map behaves as before.
function NavFollow({ active, pos }) {
  const map = useMap();
  const zoomed = useRef(false);
  useEffect(() => {
    if (!active || !pos) { zoomed.current = false; return; }
    if (!zoomed.current) {
      map.setView([pos.lat, pos.lng], 18, { animate: true });
      zoomed.current = true;
    } else {
      map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.6 });
    }
  }, [map, active, pos]);
  return null;
}

// Optional compass-driven map rotation. Stock Leaflet has no setBearing, so on
// most browsers this is a graceful no-op and the map stays north-up while the
// puck arrow rotates (fallback). Only rotates the canvas where supported.
function CompassRotate({ active, heading }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    if (typeof map.setBearing === 'function' && heading !== null && !isNaN(heading)) {
      try { map.setBearing(heading); } catch (_) {}
    }
  }, [map, active, heading]);
  return null;
}

// Directional puck for Navigation Mode (replaces the plain blue dot).
const createNavPuckIcon = (heading = 0) => {
  const rotation = (heading !== null && !isNaN(heading)) ? (heading % 360) : 0;
  return L.divIcon({
    html: `<div style="position:relative;width:48px;height:48px;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;background:rgba(201,118,47,0.25);border-radius:50%;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:34px;height:34px;background:#C9762F;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(201,118,47,0.7),0 2px 6px rgba(0,0,0,0.4);"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(${rotation}deg);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:15px solid #fff;margin-top:-19px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));"></div>
    </div>`,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });
};

function MapView() {
  const { navigate } = useView();
  const { theme } = useTheme();
  const isLightMode = theme === 'light';

  // Single tile source for BOTH modes: OpenStreetMap standard raster
  // (free, no API key, verified serving real tiles end-to-end).
  // Dark mode is achieved purely with a CSS filter on the tile pane below —
  // no Carto dark endpoint is requested at all, so no watermark can appear.
  const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBar, setSelectedBar] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userHeading, setUserHeading] = useState(0);
  const [navigatingTo, setNavigatingTo] = useState(null);
  const [pendingNav, setPendingNav] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [livePos, setLivePos] = useState(null);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [estimateLine, setEstimateLine] = useState(null);
  const [navMode, setNavMode] = useState(false);
  const [compassRotate, setCompassRotate] = useState(false);
  const [locErr, setLocErr] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [centerLoc, setCenterLoc] = useState(null);
  const [recommendationsOpen, setRecommendationsOpen] = useState(true);
  const [compassActive, setCompassActive] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [radiusAuto, setRadiusAuto] = useState(true);
  const defaultCenter = [14.5995, 120.9842];

  // Filter bars by radius. In auto mode, show all bars with coordinates by default.
  const filteredBars = bars.filter(bar => {
    const lat = Number(bar.latitude);
    const lng = Number(bar.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (!userLocation || radiusAuto) return true;
    return haversineKm(userLocation.lat, userLocation.lng, lat, lng) <= radiusKm;
  });

  const nearbyCount = bars.reduce((count, bar) => {
    if (!userLocation) return count;
    const lat = Number(bar.latitude);
    const lng = Number(bar.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return count;
    return haversineKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_KM ? count + 1 : count;
  }, 0);

  const barsWithinRadius = bars.reduce((count, bar) => {
    if (!userLocation) return count;
    const lat = Number(bar.latitude);
    const lng = Number(bar.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return count;
    return haversineKm(userLocation.lat, userLocation.lng, lat, lng) <= radiusKm ? count + 1 : count;
  }, 0);

  const recommendations = userLocation ? scoreBars(bars, userLocation) : [];

  useEffect(() => {
    barService.list({ has_coords: 1 })
      .then((list) => {
        const safeBars = Array.isArray(list)
          ? list.filter((bar) => Number.isFinite(Number(bar.latitude)) && Number.isFinite(Number(bar.longitude)))
          : [];
        setBars(safeBars);
      })
      .catch(() => setBars([]))
      .finally(() => setLoading(false));
  }, []);

  
  // Auto-request location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserLocation(loc);
        setCenterLoc({ lat: loc.lat, lng: loc.lng, zoom: 14 });
        setLocLoading(false);
      },
      () => { setLocLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Device orientation compass — works on both iOS and Android
  // iOS 13+ requires explicit permission from a user gesture (handled by the Compass button)
  // Android attaches automatically
  const handleOrientation = useCallback((e) => {
    let heading = null;
    if (e.webkitCompassHeading != null && !isNaN(e.webkitCompassHeading)) {
      // iOS: webkitCompassHeading is 0=North, clockwise — use directly
      heading = e.webkitCompassHeading;
    } else if (e.alpha != null && !isNaN(e.alpha)) {
      // Android: alpha is counterclockwise from North when flat
      heading = (360 - e.alpha) % 360;
    }
    if (heading !== null) setUserHeading(heading);
  }, []);

  const enableCompass = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ — must be called from a user gesture
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
          setCompassActive(true);
        }
      } catch (_) {}
    } else {
      // Android / desktop — no permission needed
      window.addEventListener('deviceorientation', handleOrientation, true);
      setCompassActive(true);
    }
  }, [handleOrientation]);

  // On Android, try to auto-attach on mount (no permission dialog needed)
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS && typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation, true);
      setCompassActive(true);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  const getLocation = useCallback((onSuccess) => {
    setLocErr(''); setLocLoading(true);
    if (!navigator.geolocation) {
      setLocErr('Geolocation is not supported by your browser.');
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserLocation(loc);
        setCenterLoc({ lat: loc.lat, lng: loc.lng, zoom: 14 });
        setLocLoading(false);
        setLocErr('');
        if (onSuccess) onSuccess(loc);
      },
      (err) => {
        let errorMsg = 'Unable to get your location.';
        if (err.code === 1) {
          errorMsg = 'Location access denied. Please enable location permissions in your browser settings.';
        } else if (err.code === 2) {
          errorMsg = 'Location unavailable. Please check your device settings.';
        } else if (err.code === 3) {
          errorMsg = 'Location request timed out. Please try again.';
        }
        setLocErr(errorMsg);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Instant straight-line estimate so the UI never sits on a blank loader
  // while OSRM (~2s) resolves. Replaced by the real route on arrival.
  const showEstimate = useCallback((from, to) => {
    const km = haversineKm(from.lat, from.lng, to.lat, to.lng);
    setEstimateLine([[from.lat, from.lng], [to.lat, to.lng]]);
    setRouteInfo({
      distance: km.toFixed(2),
      time: Math.max(1, Math.round((km / 30) * 60)), // ~30 km/h urban assumption
      instructions: [{ text: 'Finding best route…' }],
      currentStep: 0, steps: [], isEstimate: true,
    });
  }, []);

  const handleNav = useCallback((bar) => {
    const lat = parseFloat(bar.latitude), lng = parseFloat(bar.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      setLocErr(`${bar.name} doesn't have location coordinates.`);
      return;
    }
    setSelectedBar(bar);
    setNavMode(false); setCompassRotate(false);
    if (userLocation) {
      setNavigatingTo({ lat, lng });
      setLivePos(null);
      setShowAllSteps(false);
      showEstimate(userLocation, { lat, lng });
      setCenterLoc({ lat: userLocation.lat, lng: userLocation.lng, zoom: 14 });
      if (voiceEnabled) speak(`Getting directions to ${bar.name}`);
    } else {
      setPendingNav({ lat, lng, bar });
      getLocation((loc) => {
        setNavigatingTo({ lat, lng });
        setLivePos(null);
        setShowAllSteps(false);
        showEstimate(loc, { lat, lng });
        setCenterLoc({ lat: loc.lat, lng: loc.lng, zoom: 14 });
        if (voiceEnabled) speak(`Location found. Getting directions to ${bar.name}`);
      });
    }
  }, [userLocation, voiceEnabled, getLocation, showEstimate]);

  const handleRouteFound = useCallback((info) => {
    setRouteInfo(info);
    setPendingNav(null);
    if (info && !info.isEstimate) setEstimateLine(null);
  }, []);

  const handleLivePosition = useCallback((loc, heading) => {
    setLivePos(loc);
    if (heading !== null && !isNaN(heading)) setUserHeading(heading);
  }, []);

  const handleArrived = useCallback(() => {
    setNavigatingTo(null); setRouteInfo(null); setSelectedBar(null);
    setLivePos(null); setShowAllSteps(false); setEstimateLine(null);
    setNavMode(false); setCompassRotate(false);
  }, []);

  const handleRouteError = useCallback((msg) => {
    setLocErr(msg);
  }, []);

  const cancelNav = useCallback(() => {
    setNavigatingTo(null); setRouteInfo(null); setSelectedBar(null);
    setLivePos(null); setShowAllSteps(false); setEstimateLine(null);
    setNavMode(false); setCompassRotate(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    // Reset map view to default zoom and center
    if (userLocation) {
      setCenterLoc({ lat: userLocation.lat, lng: userLocation.lng, zoom: 13 });
    }
  }, [userLocation]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      {/* Dark mode: invert the (light) tile pane via CSS. Scoped to
          html[data-theme="dark"] which ThemeContext already toggles, and to
          .leaflet-tile-pane only — markers, popups, route lines and controls
          keep their normal colors. */}
      <style>{`
        html[data-theme="dark"] .leaflet-tile-pane {
          filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.8);
        }
      `}</style>
      {/* Floating controls overlay */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', zIndex: 1000, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Top row - title and controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', pointerEvents: 'auto' }}>
          <div className="glass-card" style={{ padding: '0.6rem 0.9rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>Bars Map</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-red btn-sm" onClick={() => getLocation()} disabled={locLoading}>
              {locLoading ? <><Loader2 size={14} className="animate-spin" />Locating...</> : <><MapPin size={14} />My Location</>}
            </button>
            {userLocation && <span className="badge-success" style={{ fontSize: '0.7rem', padding: '0.35rem 0.6rem' }}><CheckCircle size={12} /> Located</span>}
            <button
              className="btn btn-sm"
              onClick={enableCompass}
              title={compassActive ? 'Compass active' : 'Enable compass arrow'}
              style={{ background: compassActive ? 'rgba(74,222,128,0.15)' : 'var(--color-bg-card)', border: `1px solid ${compassActive ? 'rgba(74,222,128,0.4)' : 'var(--color-border)'}`, color: compassActive ? '#4ade80' : 'var(--color-text-primary)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}
            >
              <Compass size={13} style={{ animation: compassActive ? 'none' : undefined }} />
              {compassActive ? 'Compass On' : 'Compass'}
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-primary)', cursor: 'pointer', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', backdropFilter: 'blur(10px)', padding: '0.35rem 0.6rem', borderRadius: '6px' }}>
              <input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)} style={{ margin: 0 }} />
              <Volume2 size={12} />Voice
            </label>
          </div>
        </div>

        {/* Error message */}
        {locErr && <div className="alert alert-warn" style={{ pointerEvents: 'auto' }}>{locErr}</div>}

        {/* Radius Filter Slider */}
        {userLocation && (
          <div className="glass-card" style={{ maxWidth: '360px', pointerEvents: 'auto', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Ruler size={14} /> Distance Filter
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: radiusAuto ? '#4ade80' : '#d97706', background: radiusAuto ? 'rgba(74,222,128,0.12)' : 'rgba(217,119,6,0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: radiusAuto ? '1px solid rgba(74,222,128,0.28)' : '1px solid rgba(217,119,6,0.3)' }}>
                {radiusAuto ? 'All bars' : `Within ${radiusKm} km`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'inline-block', width: '18px', height: '0', borderTop: '2px dashed #ff1f35', boxShadow: '0 0 6px rgba(255,31,53,0.7)' }} />
                Search area on map
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setRadiusAuto((v) => !v)}
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.65rem', borderColor: radiusAuto ? 'rgba(74,222,128,0.45)' : 'var(--color-border)', color: radiusAuto ? '#4ade80' : 'var(--color-text-primary)' }}
              >
                {radiusAuto ? 'Choose distance' : 'Show all bars'}
              </button>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={radiusKm}
              onChange={(e) => {
                setRadiusAuto(false);
                setRadiusKm(Number(e.target.value));
              }}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(to right, #CC0000 0%, #CC0000 ${(radiusKm / 20) * 100}%, rgba(150,150,150,0.3) ${(radiusKm / 20) * 100}%, rgba(150,150,150,0.3) 100%)`,
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              <span>1 km</span>
              <span>{radiusAuto ? `${filteredBars.length} bars visible` : `${barsWithinRadius} bar${barsWithinRadius !== 1 ? 's' : ''} in range`}</span>
              <span>20 km</span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
              Nearby within {RECOMMENDATION_MAX_KM} km: {nearbyCount}
            </div>
          </div>
        )}

        {/* Recommended venues panel */}
        {userLocation && !navigatingTo && (
          <div className="glass-card" style={{ maxWidth: '360px', pointerEvents: 'auto', overflow: 'hidden' }}>
            <button
              onClick={() => setRecommendationsOpen(o => !o)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.9rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700 }}>
                <Sparkles size={14} style={{ color: '#fbbf24' }} />
                Recommended for you
                <span style={{ fontSize: '0.7rem', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '0.15rem 0.4rem', borderRadius: '999px', border: '1px solid rgba(251,191,36,0.3)' }}>
                  {recommendations.length} found
                </span>
              </span>
              {recommendationsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {recommendationsOpen && (
              <div style={{ borderTop: '1px solid var(--color-border)', padding: '0.5rem 0.75rem 0.75rem' }}>
                {recommendations.length === 0 ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, padding: '0.25rem 0' }}>No nearby bars found within {RECOMMENDATION_MAX_KM} km.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {recommendations.map((rec, idx) => (
                      <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.6rem', background: idx === 0 ? (isLightMode ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.08)') : 'var(--color-bg-card)', borderRadius: '8px', border: `1px solid ${idx === 0 ? 'rgba(251,191,36,0.25)' : 'var(--color-border)'}` }}>
                        <span style={{ minWidth: '18px', height: '18px', borderRadius: '50%', background: idx === 0 ? '#fbbf24' : 'var(--color-border)', color: idx === 0 ? '#000' : 'var(--color-text-primary)', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                            <span style={{ fontSize: '0.68rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.15rem' }}><Star size={9} fill="#d97706" stroke="#d97706" />{Number(rec.rating||0).toFixed(1)}</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{rec._km.toFixed(1)} km</span>
                            {rec._open && <span style={{ fontSize: '0.62rem', color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.25)' }}>Open</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                          <button
                            style={{ fontSize: '0.65rem', padding: '0.3rem 0.5rem', background: 'rgba(232,0,30,0.15)', border: '1px solid rgba(232,0,30,0.3)', borderRadius: '5px', color: '#f87171', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: rec.id })}
                          >View</button>
                          <button
                            style={{ fontSize: '0.65rem', padding: '0.3rem 0.5rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '5px', color: '#93c5fd', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                            onClick={() => handleNav(rec)}
                          ><Navigation size={9} />Go</button>
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <TrendingUp size={10} /> Based on distance, ratings, and whether the bar is open
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation card */}
        {navigatingTo && routeInfo && (
          <div className="glass-card" style={{ padding: '1rem 1.2rem', maxWidth: '420px', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Navigation size={18} style={{ flexShrink: 0 }} /> 
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedBar?.name}</span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Ruler size={13} /> {routeInfo.distance} km
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Timer size={13} /> {routeInfo.time} min
                  </span>
                  {(routeInfo.trafficDelayMin || 0) > 0 && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f87171', background: 'rgba(232,0,30,0.12)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(232,0,30,0.3)' }}>
                      +{routeInfo.trafficDelayMin} traffic
                    </span>
                  )}
                  {routeInfo.isEstimate && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#d97706', background: 'rgba(217,119,6,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(217,119,6,0.3)' }}>
                      ~ESTIMATED
                    </span>
                  )}
                </div>
                {/* Navigation Mode opt-in (off by default; default map behavior unchanged when off) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.55rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 600, color: navMode ? '#4ade80' : 'var(--color-text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={navMode} onChange={(e) => { setNavMode(e.target.checked); if (!e.target.checked) setCompassRotate(false); }} style={{ margin: 0, accentColor: '#4ade80' }} />
                    <Navigation size={12} />Navigation Mode
                  </label>
                  {navMode && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer' }} title="Rotate the map with your compass where supported; otherwise stays north-up with a rotating arrow">
                      <input type="checkbox" checked={compassRotate} onChange={(e) => { const on = e.target.checked; if (on && !compassActive) enableCompass(); setCompassRotate(on); }} style={{ margin: 0 }} />
                      <Compass size={12} />Compass rotate
                    </label>
                  )}
                </div>
                {navMode && (
                  <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', margin: '0.3rem 0 0' }}>
                    Follow view on — arrow shows travel direction.{compassRotate ? ' Map rotation attempted where supported; otherwise north-up.' : ''}
                  </p>
                )}
                {(() => {
                  const steps = routeInfo.instructions || [];
                  const cur = Math.min(routeInfo.currentStep || 0, Math.max(0, steps.length - 1));
                  const current = steps[cur];
                  return (<>
                    {current && (
                      <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.8rem', background: isLightMode ? 'rgba(204,0,0,0.08)' : 'rgba(232,0,30,0.15)', borderRadius: '6px', borderLeft: '3px solid #CC0000' }}>
                        <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--color-text-primary)', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                          <ArrowRight size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span>{cur + 1}. {current.text}</span>
                        </p>
                      </div>
                    )}
                    {steps.length > 1 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowAllSteps((v) => !v)}
                          style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          {showAllSteps ? <>Hide steps <ChevronUp size={12} /></> : <>All {steps.length} steps <ChevronDown size={12} /></>}
                        </button>
                        {showAllSteps && (
                          <ol style={{ margin: '0.5rem 0 0', padding: '0.5rem 0.5rem 0.5rem 1.6rem', fontSize: '0.78rem', color: 'var(--color-text-primary)', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', maxHeight: '180px', overflowY: 'auto', lineHeight: 1.7 }}>
                            {steps.map((s, i) => (
                              <li key={i} style={{ fontWeight: i === cur ? 700 : 400, color: i === cur ? '#e8001e' : undefined }}>{s.text}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </>);
                })()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
                {voiceEnabled && routeInfo.instructions?.length > 0 && (
                  <button className="btn btn-glass btn-sm" onClick={() => speak(routeInfo.instructions.map(i => i.text).filter(Boolean).join('. '))} title="Read directions">
                    <Volume2 size={13} />
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); cancelNav(); }} title="Cancel navigation">✕</button>
              </div>
            </div>
          </div>
        )}

        {/* Route loading message */}
        {navigatingTo && !routeInfo && (
          <div className="alert alert-info" style={{ fontSize: '0.8rem', padding: '0.6rem 0.9rem', pointerEvents: 'auto' }}><Loader2 size={13} className="animate-spin" /> Finding your route...</div>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {loading ? (
          <div className="loading-state" style={{ height: '100%' }}><div className="spinner" /><span>Loading map...</span></div>
        ) : (
          <MapContainer
            center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter}
            zoom={13}
            maxZoom={20}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
            zoomControl={false}
            maxBounds={CAVITE_BOUNDS}
            maxBoundsViscosity={1.0}
          >
                        <TileLayer
              attribution={TILE_ATTRIBUTION}
              url={TILE_URL}
              key={TILE_URL}
              maxZoom={20}
            />
            {/* Live traffic flow overlay (TomTom free tier, green/yellow/red).
                Only during navigation and only when a key is configured. */}
            {navigatingTo && TOMTOM_TRAFFIC_TILES && (
              <TileLayer
                attribution='&copy; <a href="https://www.tomtom.com/">TomTom</a>'
                url={TOMTOM_TRAFFIC_TILES}
                opacity={0.75}
                zIndex={2}
              />
            )}
            <ZoomControl position="bottomright" />
            {userLocation && (
              <Marker position={[(livePos || userLocation).lat, (livePos || userLocation).lng]} icon={(navMode && navigatingTo) ? createNavPuckIcon(userHeading) : createUserLocationIcon(userHeading)}>
                <Popup>
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '0.9rem 1.1rem', minWidth: '180px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#000', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 6px rgba(59,130,246,0.5)' }}></div>
                      Your Location
                    </h4>
                  </div>
                </Popup>
              </Marker>
            )}
            {userLocation && (
              <Circle
                center={[(livePos || userLocation).lat, (livePos || userLocation).lng]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#ff1f35',
                  weight: 2,
                  opacity: 0.95,
                  dashArray: '8 8',
                  fillColor: '#e8001e',
                  fillOpacity: 0.04,
                }}
              />
            )}
            {filteredBars.map((bar) => {
              const lat = parseFloat(bar.latitude), lng = parseFloat(bar.longitude);
              if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
              const isNear = userLocation && haversineKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_KM;
              const markerColor = isNear ? '#2E7D4F' : '#C9762F';
              const markerGlow = isNear ? 'rgba(46,125,79,0.5)' : 'rgba(201,118,47,0.5)';
              const markerLabelBg = isNear ? '#2E7D4F' : '#C9762F';
              const logoUrl = imageUrl(bar.logo_path || bar.image_path);
              const icon = L.divIcon({
                html: `<div style="position:relative;">
                  <div style="width:44px;height:44px;background:${markerColor};border-radius:50%;border:3px solid #fff;box-shadow:0 0 14px ${markerGlow}, 0 4px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;overflow:hidden;">
                    ${logoUrl ? `<img src="${logoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'" />` : `<div style="font-size:18px;color:#fff;">🍸</div>`}
                  </div>
                  <div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:${markerLabelBg};color:#fff;padding:2px 8px;border-radius:6px;white-space:nowrap;font-weight:700;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">${bar.name}</div>
                </div>`,
                className: '', iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -28],
              });
              return (
                <Marker 
                  key={bar.id} 
                  position={[lat, lng]} 
                  icon={icon}
                  eventHandlers={{
                    click: () => setSelectedBar(bar),
                  }}
                />
              );
            })}
            {centerLoc && <MapCenter center={centerLoc} />}
            {navigatingTo && userLocation && (
              <NavFollow active={navMode} pos={livePos || userLocation} />
            )}
            {navigatingTo && userLocation && (
              <CompassRotate active={navMode && compassRotate} heading={userHeading} />
            )}
            {estimateLine && (!routeInfo || routeInfo.isEstimate) && (
              <Polyline
                positions={estimateLine}
                smoothFactor={0}
                pathOptions={{ color: '#e8001e', weight: 4, opacity: 0.6, dashArray: '10 8', lineJoin: 'round', lineCap: 'round' }}
              />
            )}
            {navigatingTo && userLocation && (
              <LiveNavigation
                key={`${userLocation.lat},${userLocation.lng}->${navigatingTo.lat},${navigatingTo.lng}`}
                initialPos={userLocation}
                destination={navigatingTo}
                barName={selectedBar?.name || 'your destination'}
                voiceEnabled={voiceEnabled}
                isLightMode={isLightMode}
                onRouteUpdate={handleRouteFound}
                onLivePosition={handleLivePosition}
                onArrived={handleArrived}
                onRouteError={handleRouteError}
              />
            )}
          </MapContainer>
        )}
      </div>

      {/* Bottom Sheet Card Preview for Tapped Marker */}
      {selectedBar && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(92vw, 420px)',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
            zIndex: 1100,
          }}
          className="animate-in"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {selectedBar.logo_path || selectedBar.bar_icon ? (
                <img src={imageUrl(selectedBar.logo_path || selectedBar.bar_icon)} alt={selectedBar.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border)' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#C9762F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                  {selectedBar.name?.[0]?.toUpperCase() || 'B'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{selectedBar.name}</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                  {selectedBar.city || 'Cavite'} &bull; <Star size={12} fill="#C9762F" stroke="#C9762F" style={{ display: 'inline', verticalAlign: 'middle' }} /> {selectedBar.rating || '4.8'}
                </p>
              </div>
            </div>
            <button style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }} onClick={() => setSelectedBar(null)}>✕</button>
          </div>

          {selectedBar.address && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0.75rem 0 0.5rem' }}>📍 {selectedBar.address}</p>
          )}

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
            <button
              className="btn"
              style={{ flex: 1, background: '#C9762F', color: '#fff', fontWeight: 700, borderRadius: 8, fontSize: '0.88rem' }}
              onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: selectedBar.id })}
            >
              View Venue &amp; Menu →
            </button>
            <button
              style={{ padding: '0.55rem 1rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: '#93c5fd', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onClick={() => handleNav(selectedBar)}
              title={`Navigate to ${selectedBar.name}`}
            ><Navigation size={14} />Go</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapView;
