import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { barService } from '../services/barService';
import { imageUrl } from '../utils/imageUrl';
import { useView } from '../hooks/useView';
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
const DSS_MAX_KM = 20; // DSS considers bars within 20 km

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

// DSS scoring: distance (40) + rating (35) + review credibility (15) + open now (10)
function scoreBars(bars, userLocation) {
  if (!userLocation || !bars.length) return [];
  const scored = bars.reduce((acc, bar) => {
    const lat = Number(bar.latitude), lng = Number(bar.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return acc;
    const km = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
    if (km > DSS_MAX_KM) return acc;
    const distScore = Math.max(0, 40 * (1 - km / DSS_MAX_KM));
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

function RoutingControl({ userLocation, destination, onRouteFound, voiceEnabled }) {
  const map = useMap();
  useEffect(() => {
    if (!userLocation || !destination || !map) return;
    let ctrl = null, mounted = true, watchId = null;
    
    // Waze-style: Zoom to user location and enable rotation
    map.setView([userLocation.lat, userLocation.lng], 17, { animate: true });
    
    // Watch user heading and rotate map (Waze-style)
    if (navigator.geolocation && 'watchPosition' in navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!mounted) return;
          const heading = position.coords.heading;
          if (heading !== null && !isNaN(heading)) {
            // Rotate map to match user's heading
            map.setBearing ? map.setBearing(heading) : null;
          }
          // Update map center to follow user
          map.panTo([position.coords.latitude, position.coords.longitude], { animate: true, duration: 0.5 });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }
    
    const timer = setTimeout(() => {
      if (!mounted) return;
      ctrl = L.Routing.control({
        waypoints: [
          L.latLng(userLocation.lat, userLocation.lng),
          L.latLng(destination.lat, destination.lng),
        ],
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'driving',
        }),
        silent: true,
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        showAlternatives: false,
        lineOptions: {
          styles: [{ color: '#e8001e', weight: 5, opacity: 0.9 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0,
        },
        createMarker: () => null,
        show: false,
      });
      ctrl.on('routesfound', (e) => {
        if (!mounted) return;
        const route = e.routes[0];
        const dist = (route.summary.totalDistance / 1000).toFixed(2);
        const time = Math.round(route.summary.totalTime / 60);
        onRouteFound({ distance: dist, time, instructions: route.instructions || [] });
        if (voiceEnabled && route.instructions?.length) {
          const first = route.instructions[0];
          speak(`Navigation started. ${first.text || ''}`);
        }
      });
      ctrl.on('routingerror', () => {
        if (mounted) onRouteFound(null);
      });
      ctrl.addTo(map);
    }, 150);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (ctrl && map) { try { map.removeControl(ctrl); } catch (_) {} }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [map, userLocation, destination, onRouteFound, voiceEnabled]);
  return null;
}

function MapCenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView([center.lat, center.lng], center.zoom ?? 15); }, [map, center]);
  return null;
}

function MapView() {
  const { navigate } = useView();
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBar, setSelectedBar] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userHeading, setUserHeading] = useState(0);
  const [navigatingTo, setNavigatingTo] = useState(null);
  const [pendingNav, setPendingNav] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [locErr, setLocErr] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [centerLoc, setCenterLoc] = useState(null);
  const [dssOpen, setDssOpen] = useState(true);
  const [compassActive, setCompassActive] = useState(false);
  const defaultCenter = [14.5995, 120.9842];

  const nearbyCount = bars.reduce((count, bar) => {
    if (!userLocation) return count;
    const lat = Number(bar.latitude);
    const lng = Number(bar.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return count;
    return haversineKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_KM ? count + 1 : count;
  }, 0);

  const dssRecs = userLocation ? scoreBars(bars, userLocation) : [];

  useEffect(() => {
    barService.list({ has_coords: 1 })
      .then(setBars).catch(() => setBars([])).finally(() => setLoading(false));
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

  const handleNav = useCallback((bar) => {
    const lat = parseFloat(bar.latitude), lng = parseFloat(bar.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      setLocErr(`${bar.name} doesn't have location coordinates.`);
      return;
    }
    setSelectedBar(bar);
    if (userLocation) {
      setNavigatingTo({ lat, lng });
      setRouteInfo(null);
      setCenterLoc({ lat: userLocation.lat, lng: userLocation.lng, zoom: 14 });
      if (voiceEnabled) speak(`Getting directions to ${bar.name}`);
    } else {
      setPendingNav({ lat, lng, bar });
      getLocation((loc) => {
        setNavigatingTo({ lat, lng });
        setRouteInfo(null);
        setCenterLoc({ lat: loc.lat, lng: loc.lng, zoom: 14 });
        if (voiceEnabled) speak(`Location found. Getting directions to ${bar.name}`);
      });
    }
  }, [userLocation, voiceEnabled, getLocation]);

  const handleRouteFound = useCallback((info) => {
    setRouteInfo(info);
    setPendingNav(null);
  }, []);

  const cancelNav = useCallback(() => {
    setNavigatingTo(null); setRouteInfo(null); setSelectedBar(null);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    // Reset map view to default zoom and center
    if (userLocation) {
      setCenterLoc({ lat: userLocation.lat, lng: userLocation.lng, zoom: 13 });
    }
  }, [userLocation]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      {/* Floating controls overlay */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', zIndex: 1000, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Top row - title and controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', pointerEvents: 'auto' }}>
          <div className="glass-card" style={{ padding: '0.6rem 0.9rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#fff' }}>Bars Map</h2>
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
              style={{ background: compassActive ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.1)', border: `1px solid ${compassActive ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.2)'}`, color: compassActive ? '#4ade80' : '#fff', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}
            >
              <Compass size={13} style={{ animation: compassActive ? 'none' : undefined }} />
              {compassActive ? 'Compass On' : 'Compass'}
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#fff', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '0.35rem 0.6rem', borderRadius: '6px' }}>
              <input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)} style={{ margin: 0 }} />
              <Volume2 size={12} />Voice
            </label>
          </div>
        </div>

        {/* Error message */}
        {locErr && <div className="alert alert-warn" style={{ pointerEvents: 'auto' }}>{locErr}</div>}

        {/* DSS Recommendation Panel */}
        {userLocation && !navigatingTo && (
          <div className="glass-card" style={{ maxWidth: '360px', pointerEvents: 'auto', overflow: 'hidden' }}>
            <button
              onClick={() => setDssOpen(o => !o)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.9rem', background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700 }}>
                <Sparkles size={14} style={{ color: '#fbbf24' }} />
                DSS Recommendations
                <span style={{ fontSize: '0.7rem', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '0.15rem 0.4rem', borderRadius: '999px', border: '1px solid rgba(251,191,36,0.3)' }}>
                  {dssRecs.length} found
                </span>
              </span>
              {dssOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {dssOpen && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '0.5rem 0.75rem 0.75rem' }}>
                {dssRecs.length === 0 ? (
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', margin: 0, padding: '0.25rem 0' }}>No bars found within {DSS_MAX_KM}km.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {dssRecs.map((rec, idx) => (
                      <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.6rem', background: idx === 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${idx === 0 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.07)'}` }}>
                        <span style={{ minWidth: '18px', height: '18px', borderRadius: '50%', background: idx === 0 ? '#fbbf24' : 'rgba(255,255,255,0.15)', color: idx === 0 ? '#000' : '#fff', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                            <span style={{ fontSize: '0.68rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.15rem' }}><Star size={9} fill="#fbbf24" stroke="#fbbf24" />{Number(rec.rating||0).toFixed(1)}</span>
                            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)' }}>{rec._km.toFixed(1)} km</span>
                            {rec._open && <span style={{ fontSize: '0.62rem', color: '#4ade80', background: 'rgba(74,222,128,0.12)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid rgba(74,222,128,0.25)' }}>Open</span>}
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
                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <TrendingUp size={10} /> Ranked by distance · rating · availability
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
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Navigation size={18} style={{ flexShrink: 0 }} /> 
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedBar?.name}</span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Ruler size={13} /> {routeInfo.distance} km
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Timer size={13} /> {routeInfo.time} min
                  </span>
                </div>
                {routeInfo.instructions?.[0] && (
                  <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.8rem', background: 'rgba(232,0,30,0.15)', borderRadius: '6px', borderLeft: '3px solid #e8001e' }}>
                    <p style={{ fontSize: '0.85rem', margin: 0, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <ArrowRight size={14} style={{ marginTop: '2px', flexShrink: 0 }} /> 
                      <span>{routeInfo.instructions[0].text}</span>
                    </p>
                  </div>
                )}
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

        {/* Calculating route message */}
        {navigatingTo && !routeInfo && (
          <div className="alert alert-info" style={{ fontSize: '0.8rem', padding: '0.6rem 0.9rem', pointerEvents: 'auto' }}><Loader2 size={13} className="animate-spin" /> Calculating route...</div>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {loading ? (
          <div className="loading-state" style={{ height: '100%' }}><div className="spinner" /><span>Loading map...</span></div>
        ) : (
          <MapContainer
            center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
            zoomControl={false}
            maxBounds={CAVITE_BOUNDS}
            maxBoundsViscosity={1.0}
          >
                        <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <ZoomControl position="bottomright" />
            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]} icon={createUserLocationIcon(userHeading)}>
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
            {bars.map((bar) => {
              const lat = parseFloat(bar.latitude), lng = parseFloat(bar.longitude);
              if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
              const isNear = userLocation && haversineKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_KM;
              const markerColor = isNear ? '#22c55e' : '#e8001e';
              const markerGlow = isNear ? 'rgba(34,197,94,0.65)' : 'rgba(232,0,30,0.6)';
              const markerLabelBg = isNear ? 'rgba(34,197,94,0.95)' : 'rgba(232,0,30,0.92)';
              const logoUrl = imageUrl(bar.logo_path || bar.image_path);
              const icon = L.divIcon({
                html: `<div style="position:relative;">
                  <div style="width:48px;height:48px;background:${markerColor};border-radius:50%;border:3px solid #fff;box-shadow:0 0 16px ${markerGlow}, 0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;overflow:hidden;">
                    ${logoUrl ? `<img src="${logoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'" />` : `<div style="font-size:20px;">🍸</div>`}
                  </div>
                  <div style="position:absolute;top:-30px;left:50%;transform:translateX(-50%);background:${markerLabelBg};color:#fff;padding:3px 10px;border-radius:6px;white-space:nowrap;font-weight:700;font-size:11px;box-shadow:0 2px 10px rgba(0,0,0,0.4);">${bar.name}</div>
                </div>`,
                className: '', iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -30],
              });
              return (
                <Marker key={bar.id} position={[lat, lng]} icon={icon}>
                  <Popup>
                    <div style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', minWidth: '260px', maxWidth: '320px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                      {bar.image_path && (
                        <div style={{ width: '100%', height: '140px', overflow: 'hidden', background: '#f0f0f0' }}>
                          <img src={imageUrl(bar.image_path)} alt={bar.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ padding: '1rem 1.1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#000' }}>{bar.name}</h4>
                        {isNear && (
                          <div style={{ marginTop: '0.4rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              <MapPin size={10} /> Near Your Area
                            </span>
                          </div>
                        )}
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Star size={12} fill="#fbbf24" stroke="#fbbf24" /> {bar.rating || '0.0'} ({bar.review_count || 0})
                        </p>
                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#888' }}>{bar.address}, {bar.city}</p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
                          <button 
                            style={{ flex: 1, background: '#e8001e', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: bar.id })}
                          >
                            Details
                          </button>
                          <button 
                            style={{ flex: 1, background: '#f0f0f0', color: '#000', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                            onClick={() => handleNav(bar)}
                          >
                            <Navigation size={12} /> Navigate
                          </button>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {centerLoc && <MapCenter center={centerLoc} />}
            {navigatingTo && userLocation && (
              <RoutingControl
                key={`${userLocation.lat},${userLocation.lng}->${navigatingTo.lat},${navigatingTo.lng}`}
                userLocation={userLocation}
                destination={navigatingTo}
                onRouteFound={handleRouteFound}
                voiceEnabled={voiceEnabled}
              />
            )}
          </MapContainer>
        )}
      </div>
    </div>
  );
}

export default MapView;
