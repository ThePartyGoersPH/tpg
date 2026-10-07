import { useEffect, useState } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { barService } from '../services/barService';
import { reservationService } from '../services/reservationService';
import { paymentService } from '../services/paymentService';
import { statsService } from '../services/statsService';
import { imageUrl } from '../utils/imageUrl';
import { getPrimaryBarType } from '../utils/barTypeLabel';
import { formatDate, formatTime } from '../utils/dateHelpers';
import { Wine, CalendarDays, CreditCard, PartyPopper, MapPin, ArrowRight, Star, Heart, MessageCircle } from 'lucide-react';

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEAR_KM = 5;

const BAR_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'%3E%3Crect width='400' height='220' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%23333333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`;

function BarCardImage({ bar }) {
  const [hovered, setHovered] = useState(false);
  const hasGif = Boolean(bar.video_path);
  const staticSrc = imageUrl(bar.image_path) || BAR_PLACEHOLDER;
  const gifSrc = hasGif ? imageUrl(bar.video_path) : null;
  return (
    <div
      style={{ position: 'relative', overflow: 'hidden' }}
      onMouseEnter={() => hasGif && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={hovered && gifSrc ? gifSrc : staticSrc}
        alt={bar.name}
        className="bar-card-img"
        onError={e => { e.target.src = BAR_PLACEHOLDER; }}
        style={{ transition: 'opacity 0.25s ease' }}
      />
      {hasGif && !hovered && (
        <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(204,0,0,0.85)', borderRadius: 4, padding: '2px 7px', fontSize: '0.6rem', fontWeight: 700, color: '#fff', letterSpacing: '1px', backdropFilter: 'blur(4px)' }}>GIF</div>
      )}
    </div>
  );
}

function HomeView() {
  const { navigate } = useView();
  const [trending, setTrending] = useState([]);
  const [latestEvents, setLatestEvents] = useState([]);
  const [platformStats, setPlatformStats] = useState({
    active_bars: 0,
    featured_events: 0,
    reservations_this_month: 0,
    total_customers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [t, stats, bars] = await Promise.all([
          barService.trending(6),
          statsService.getPlatformStats(),
          barService.list({ limit: 12 }),
        ]);

        setTrending(t);
        setPlatformStats(stats);

        const eventLists = await Promise.all(
          bars.slice(0, 6).map(bar => barService.events(bar.id).then(ev => ev.map(e => ({ ...e, bar_name: bar.name }))).catch(() => []))
        );
        const allEvents = eventLists.flat().sort((a, b) => new Date(b.event_date) - new Date(a.event_date)).slice(0, 6);
        setLatestEvents(allEvents);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="loading-state" style={{ minHeight: '50vh' }}><div className="spinner" /><span>Loading dashboard...</span></div>;
  }

  return (
    <div className="home-shell">
      {/* ── HERO — Full Width Atmospheric ── */}
      <section className="home-hero animate-in">
        <div className="home-hero-orb home-hero-orb-1" />
        <div className="home-hero-orb home-hero-orb-2" />
        <div className="home-hero-orb home-hero-orb-3" />
        <div className="home-hero-glow" />
        <div className="home-hero-content">
          <span className="home-hero-badge">EXPLORE TONIGHT</span>
          <h1 className="home-hero-title">
            Discover Cavite's<br />
            <span className="home-hero-accent">top bars & events</span>
          </h1>
          <p className="home-hero-sub">
            Follow your favorite bars, check events and reserve your table in one place.
          </p>
          <div className="home-hero-cta">
            <button className="btn btn-red btn-lg" onClick={() => navigate(VIEWS.BARS)}>Browse Bars</button>
            <button className="btn btn-ghost btn-lg" onClick={() => navigate(VIEWS.MAP)}><MapPin size={16} /> Open Map</button>
          </div>
        </div>
      </section>

      {/* ── STAT ROW — Large Number Counters ── */}
      <section className="home-stats animate-in">
        {[
          { value: platformStats.active_bars, label: "Tonight's Bars", sublabel: 'Active tonight', view: VIEWS.BARS },
          { value: platformStats.featured_events, label: 'Featured Events', sublabel: 'This week', view: VIEWS.EVENTS },
          { value: `${platformStats.reservations_this_month}+`, label: 'Reservations', sublabel: 'This month', view: VIEWS.BARS },
          { value: platformStats.total_customers >= 1000 ? `${(platformStats.total_customers / 1000).toFixed(1)}K` : platformStats.total_customers, label: 'Happy Customers', sublabel: 'And growing', view: VIEWS.BARS },
        ].map((s, i) => (
          <div className="home-stat" key={i} onClick={() => navigate(s.view)}>
            <span className="home-stat-num">{s.value}</span>
            <span className="home-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── TRENDING BARS — Editorial Layout ── */}
      <section className="home-section stagger-section" style={{ animationDelay: '0.2s' }}>
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">TRENDING BARS</span>
            <h2 className="home-section-title">TONIGHT'S <span className="home-accent">TOP PICKS</span></h2>
            <p className="home-section-sub">Ranked by followers, reviews, and event activity.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(VIEWS.BARS)}>View all <ArrowRight size={14} /></button>
        </div>
        {trending.length === 0 ? (
          <div className="glass-card empty-state">
            <div className="empty-icon"><Wine size={32} /></div>
            <h3 className="text-h3">No trending bars</h3>
            <p className="text-muted mt-sm">Check back later.</p>
          </div>
        ) : (
          <div className="home-editorial">
            {/* Featured large card */}
            {(() => {
              const featuredBarType = getPrimaryBarType(trending[0]);
              return (
                <div className="home-featured-card" onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: trending[0].id })}>
                  <img
                    src={imageUrl(trending[0].image_path) || BAR_PLACEHOLDER}
                    alt={trending[0].name}
                    className="home-featured-img"
                    onError={e => { e.target.src = BAR_PLACEHOLDER; }}
                  />
                  <div className="home-featured-scrim" />
                  <div className="home-featured-info">
                    <span className="badge-glass" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>{featuredBarType}</span>
                    <h3 className="home-featured-name">
                      {trending[0].logo_path && (
                        <img 
                          src={imageUrl(trending[0].logo_path)} 
                          alt="" 
                          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      {trending[0].name}
                    </h3>
                    <p className="home-featured-meta">{trending[0].city} · {trending[0].price_range || '$$'}</p>
                    <p className="home-featured-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Star size={13} /> {trending[0].rating || '0.0'} · {trending[0].follower_count || 0} followers</p>
                    <button className="btn btn-red btn-sm" style={{ marginTop: '0.75rem' }} onClick={(e) => { e.stopPropagation(); navigate(VIEWS.BAR_DETAIL, { barId: trending[0].id }); }}>
                      View Details <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })()}
            {/* Smaller cards */}
            <div className="home-editorial-grid">
              {trending.slice(1).map((bar) => {
                const lat = parseFloat(bar.latitude);
                const lng = parseFloat(bar.longitude);
                const isNear = Boolean(userLoc && Number.isFinite(lat) && Number.isFinite(lng) && haversineKm(userLoc.lat, userLoc.lng, lat, lng) <= NEAR_KM);
                const primaryBarType = getPrimaryBarType(bar);
                return (
                  <div className="home-bar-card" key={bar.id} onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: bar.id })}>
                    <div className="home-bar-card-img-wrap">
                      <img src={imageUrl(bar.image_path) || BAR_PLACEHOLDER} alt={bar.name} className="home-bar-card-img" onError={e => { e.target.src = BAR_PLACEHOLDER; }} />
                      <div className="home-bar-card-scrim" />
                      <div className="home-bar-card-overlay">
                        <span className="badge-glass" style={{ fontSize: '0.62rem', padding: '0.15rem 0.5rem', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.08)' }}>{primaryBarType}</span>
                        {isNear && <span className="badge-success" style={{ fontSize: '0.6rem', padding: '0.15rem 0.5rem' }}><MapPin size={10} /> Near</span>}
                      </div>
                    </div>
                    <div className="home-bar-card-body">
                      <h4 className="home-bar-card-name">
                        {bar.logo_path && (
                          <img 
                            src={imageUrl(bar.logo_path)} 
                            alt="" 
                            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        {bar.name}
                      </h4>
                      <p className="home-bar-card-loc">{bar.city} · {bar.price_range || '$$'}</p>
                      <div className="home-bar-card-foot">
                        <span><Star size={12} /> {bar.rating || '0.0'} ({bar.review_count || 0})</span>
                        <span>{bar.follower_count || 0} followers</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── LATEST EVENTS ── */}
      <section className="home-section stagger-section" style={{ animationDelay: '0.35s' }}>
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">LATEST EVENTS</span>
            <h2 className="home-section-title">WHAT'S <span className="home-accent">HAPPENING</span></h2>
            <p className="home-section-sub">Upcoming events from bars near you.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(VIEWS.EVENTS)}>See all <ArrowRight size={14} /></button>
        </div>
        {latestEvents.length === 0 ? (
          <div className="glass-card empty-state">
            <div className="empty-icon"><PartyPopper size={32} /></div>
            <h3 className="text-h3">No upcoming events</h3>
            <p className="text-muted mt-sm">Check back soon.</p>
          </div>
        ) : (
          <div className="g g-3">
            {latestEvents.map(ev => (
              <div className="glass-card home-event-card" key={ev.id} onClick={() => navigate(VIEWS.EVENTS)}>
                {ev.image_path && <img src={imageUrl(ev.image_path)} alt={ev.title} className="event-card-img" onError={e => { e.target.style.display = 'none'; }} />}
                <div className="event-card-body">
                  <p className="event-date"><CalendarDays size={13} /> {formatDate(ev.event_date)} · {formatTime(ev.start_time)}</p>
                  <h3 className="text-h3">{ev.title}</h3>
                  {ev.bar_name && <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={12} /> {ev.bar_name}</p>}
                  <div className="flex gap-md items-center mt-sm" style={{ flexWrap: 'wrap' }}>
                    <span className="text-dim" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Heart size={13} /> {ev.like_count || 0}</span>
                    <span className="text-dim" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><MessageCircle size={13} /> {ev.comment_count || 0}</span>
                    {Number(ev.entry_price || 0) > 0 ? (
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, background: 'rgba(204,0,0,0.15)', color: '#f87171', padding: '0.1rem 0.4rem', borderRadius: '10px', border: '1px solid rgba(204,0,0,0.25)' }}>🎟 ₱{Number(ev.entry_price).toLocaleString()}</span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, background: 'rgba(74,222,128,0.1)', color: '#4ade80', padding: '0.1rem 0.4rem', borderRadius: '10px', border: '1px solid rgba(74,222,128,0.2)' }}>FREE</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default HomeView;
