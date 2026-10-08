import { useEffect, useState, useRef } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { barService } from '../services/barService';
import { statsService } from '../services/statsService';
import { imageUrl } from '../utils/imageUrl';
import { getPrimaryBarType } from '../utils/barTypeLabel';
import { Wine, CalendarDays, MapPin, Star, Heart, Sparkles, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react';

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEAR_KM = 5;
const BAR_PLACEHOLDER = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=80';

const HERO_SLIDES = [
  {
    img: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=1600&auto=format&fit=crop&q=85',
    label: 'Rooftop Bars',
    headline: "Sip Above the City",
    sub: "Cavite's best rooftop bars with skyline views",
  },
  {
    img: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1600&auto=format&fit=crop&q=85',
    label: 'Craft Cocktails',
    headline: 'Shake Up Your Night',
    sub: 'Artisan cocktail bars and mixology hotspots',
  },
  {
    img: 'https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?w=1600&auto=format&fit=crop&q=85',
    label: 'Live Music',
    headline: 'Feel the Beat',
    sub: 'Live bands, DJs and electric nights out',
  },
  {
    img: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1600&auto=format&fit=crop&q=85',
    label: 'Restobar Dining',
    headline: 'Dine, Drink & Dance',
    sub: 'Great food meets great nightlife in Cavite',
  },
];

function isOpenToday(bar) {
  if (!bar) return false;
  const days = ['sunday_hours','monday_hours','tuesday_hours','wednesday_hours','thursday_hours','friday_hours','saturday_hours'];
  const todayCol = days[new Date().getDay()];
  const hrs = bar[todayCol];
  if (!hrs || hrs.toLowerCase().includes('closed') || hrs.toLowerCase().includes('unavailable')) return false;
  return true;
}

function HeroSlideshow({ onSearch }) {
  const [slide, setSlide] = useState(0);
  const [search, setSearch] = useState('');
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);

  const goTo = (rawIdx) => {
    setFading(true);
    setTimeout(() => {
      setSlide(((rawIdx % HERO_SLIDES.length) + HERO_SLIDES.length) % HERO_SLIDES.length);
      setFading(false);
    }, 300);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSlide(prev => {
        const next = (prev + 1) % HERO_SLIDES.length;
        return next;
      });
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(search.trim());
  };

  const cur = HERO_SLIDES[slide];

  return (
    <section style={{ position: 'relative', height: 'clamp(440px, 78vh, 820px)', width: '100%', margin: 0, overflow: 'hidden', borderRadius: 0 }}>
      {HERO_SLIDES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${s.img})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: i === slide ? 1 : 0,
            transform: i === slide ? 'scale(1.06)' : 'scale(1)',
            transition: 'opacity 0.6s ease, transform 8s ease', zIndex: 0,
          }}
        />
      ))}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.7) 75%, rgba(0,0,0,0.92) 100%)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, height: '100%', width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 'clamp(1.5rem, 5vw, 3.5rem)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#C9762F', color: '#fff', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', padding: '0.3rem 0.9rem', borderRadius: 50, marginBottom: '0.75rem', width: 'fit-content' }}>
          ✦ {cur.label}
        </span>
        <h1 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem', lineHeight: 1.1, letterSpacing: '-0.5px', textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>
          {cur.headline}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: '1.05rem', margin: '0 0 1.5rem', maxWidth: 560, textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}>
          {cur.sub}
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', maxWidth: 680, width: '100%', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(15,15,15,0.25)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 16, padding: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 14px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.96)', borderRadius: 12 }}>
            <Search size={18} color="#8A8079" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search bars, restobars, events in Cavite..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '1rem 1.1rem 1rem 2.9rem', borderRadius: 12, border: 'none', background: 'transparent', fontSize: '0.95rem', fontFamily: "'Inter', sans-serif", color: '#171412', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" style={{ background: '#C9762F', color: '#fff', border: 'none', borderRadius: 12, padding: '1rem 1.8rem', fontWeight: 700, fontSize: '0.95rem', fontFamily: "'Inter', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 8px 22px rgba(201,118,47,0.45)' }}>
            Search
          </button>
        </form>
      </div>

      <button onClick={() => goTo(slide - 1)} style={{ position: 'absolute', top: '50%', left: '1.25rem', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 3, padding: 0, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}>
        <ChevronLeft size={32} strokeWidth={2.5} />
      </button>
      <button onClick={() => goTo(slide + 1)} style={{ position: 'absolute', top: '50%', right: '1.25rem', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 3, padding: 0, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}>
        <ChevronRight size={32} strokeWidth={2.5} />
      </button>

      <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.75rem', display: 'flex', gap: '0.55rem', zIndex: 3 }}>
        {HERO_SLIDES.map((_, i) => (
          <button key={i} aria-label={`Go to slide ${i + 1}`} onClick={() => goTo(i)} style={{ width: i === slide ? 26 : 10, height: 10, borderRadius: 50, background: i === slide ? '#C9762F' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />
        ))}
      </div>
    </section>
  );
}

function HomeView() {
  const { navigate } = useView();
  const [bars, setBars] = useState([]);
  const [trending, setTrending] = useState([]);
  const [platformStats, setPlatformStats] = useState({ active_bars: 0, featured_events: 0, reservations_this_month: 0, total_customers: 0 });
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {}, { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [t, stats, allBars] = await Promise.all([
          barService.trending(6).catch(() => []),
          statsService.getPlatformStats().catch(() => ({ active_bars: 0, featured_events: 0, reservations_this_month: 0, total_customers: 0 })),
          barService.list({ limit: 20 }).catch(() => []),
        ]);
        setTrending(t || []);
        setPlatformStats(stats || {});
        setBars(allBars || []);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const CATEGORIES = ['All', 'Restobar', 'Cocktail Bar', 'Rooftop', 'Sports Bar', 'Wine Bar', 'Live Music', 'Beer Garden', 'KTV Lounge'];

  const filteredBars = bars.filter((b) => {
    const matchCat = selectedCategory === 'All' || (b.category || b.bar_types || '').toString().toLowerCase().includes(selectedCategory.toLowerCase());
    const matchQ = !searchQuery || b.name?.toLowerCase().includes(searchQuery.toLowerCase()) || (b.city || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQ;
  });

  const handleHeroSearch = (q) => {
    const trimmed = (q || '').trim();
    navigate(VIEWS.BARS, { search: trimmed });
    const url = trimmed ? `/bars?search=${encodeURIComponent(trimmed)}` : '/bars';
    window.history.pushState({ view: 'bars' }, '', url);
  };

  if (loading) return (
    <div className="loading-state" style={{ minHeight: '50vh' }}>
      <div className="spinner" /><span>Loading Cavite Nightlife...</span>
    </div>
  );

  return (
    <>
      {/* 1. HERO SLIDESHOW — full-width, breaks out of the centered container */}
      <HeroSlideshow onSearch={handleHeroSearch} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem 3rem' }} className="flex flex-col gap-xl animate-in">

      {/* 2. LIVE STATS TICKER */}
      <section style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '1.25rem 1.5rem', boxShadow: '0 4px 20px rgba(23,20,18,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#2E7D4F' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2E7D4F', display: 'inline-block' }} />
              LIVE NIGHTLIFE TICKER · CAVITE
            </span>
            <h2 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 700, margin: '0.2rem 0 0', color: 'var(--color-text-primary)' }}>
              Discover Cavite's Finest Bars &amp; Restobars
            </h2>
          </div>
          <button className="btn" style={{ background: '#C9762F', color: '#ffffff', fontWeight: 700, borderRadius: 10, padding: '0.65rem 1.25rem' }} onClick={() => navigate(VIEWS.BARS)}>
            Explore All Bars →
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'thin' }}>
          {[
            { label: 'Open Tonight', value: `${platformStats.active_bars || bars.length} Venues`, sub: 'Verified & active in Cavite', icon: <Wine size={18} color="#C9762F" /> },
            { label: 'Featured Events', value: `${platformStats.featured_events || 8} Parties`, sub: 'Live music & DJs this week', icon: <Sparkles size={18} color="#C9762F" /> },
            { label: 'Bookings Made', value: `${platformStats.reservations_this_month || 120}+ Reserved`, sub: 'Happy partygoers this month', icon: <CalendarDays size={18} color="#C9762F" /> },
            { label: 'Community', value: `${platformStats.total_customers || 1500}+ Goers`, sub: 'Discovering local nightlife', icon: <Heart size={18} color="#C9762F" /> },
          ].map((item, idx) => (
            <div key={idx} style={{ flex: '0 0 220px', background: 'var(--color-bg-elevated, #F3EFEA)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{item.label}</span>
                {item.icon}
              </div>
              <div style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. DEALS & PROMOS */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#C9762F' }}>FEATURED</span>
            <h2 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.5rem', fontWeight: 700, margin: '0.1rem 0 0', color: 'var(--color-text-primary)' }}>Trending Bars</h2>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color: '#C9762F', fontWeight: 700 }} onClick={() => navigate(VIEWS.BARS)}>View All Bars →</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {(trending.length > 0 ? trending.slice(0, 3) : bars.slice(0, 3)).map((bar) => {
            const open = isOpenToday(bar);
            const primaryType = getPrimaryBarType(bar);
            const lat = Number(bar.latitude), lng = Number(bar.longitude);
            const isNear = userLoc && Number.isFinite(lat) && Number.isFinite(lng) && haversineKm(userLoc.lat, userLoc.lng, lat, lng) <= NEAR_KM;
            return (
              <div key={bar.id} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', boxShadow: '0 4px 16px rgba(23,20,18,0.04)' }}
                className="hover:-translate-y-1 hover:shadow-lg" onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: bar.id })}>
                <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                  <img src={imageUrl(bar.image_path) || BAR_PLACEHOLDER} alt={bar.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = BAR_PLACEHOLDER; }} />
                  {isNear && <span style={{ position: 'absolute', top: 10, right: 10, background: '#2E7D4F', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: 4 }}>📍 Nearby</span>}
                </div>
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <h3 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{bar.name}</h3>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 50, background: open ? 'rgba(46,125,79,0.12)' : 'rgba(122,36,48,0.12)', color: open ? '#2E7D4F' : '#7A2430', border: `1px solid ${open ? 'rgba(46,125,79,0.3)' : 'rgba(122,36,48,0.3)'}` }}>
                      {open ? '• OPEN' : '• CLOSED'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0.3rem 0 0.5rem' }}>{bar.city || 'Cavite'} &bull; {primaryType}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.6rem' }}>
                    <span style={{ color: '#C9762F', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Star size={13} fill="#C9762F" stroke="#C9762F" /> {bar.rating || '4.8'} ({bar.review_count || 0})</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>{bar.follower_count || 0} followers</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. CATEGORY STRIP */}
      <section style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <Filter size={16} color="#C9762F" />
          <h2 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>Filter by Vibe &amp; Category</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button key={cat} type="button" onClick={() => setSelectedCategory(cat)} style={{ background: isSelected ? '#C9762F' : 'var(--color-bg-elevated, #F3EFEA)', border: isSelected ? '1px solid #C9762F' : '1px solid var(--color-border)', color: isSelected ? '#ffffff' : 'var(--color-ink-soft)', fontWeight: isSelected ? 700 : 500, fontSize: '0.82rem', fontFamily: "'Inter', sans-serif", padding: '0.45rem 1rem', borderRadius: 50, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: isSelected ? '0 4px 12px rgba(201,118,47,0.25)' : 'none' }}>
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. BARS GRID */}
      <section id="bars-grid-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#2E7D4F' }}>OPEN NEAR YOU</span>
            <h2 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.5rem', fontWeight: 700, margin: '0.1rem 0 0', color: 'var(--color-text-primary)' }}>Cavite Bars &amp; Restobars</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {searchQuery && (
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                "<strong style={{ color: 'var(--color-text-primary)' }}>{searchQuery}</strong>"
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C9762F', fontWeight: 700 }} onClick={() => setSearchQuery('')}>✕</button>
              </span>
            )}
            <button className="btn btn-ghost btn-sm" style={{ color: '#C9762F', fontWeight: 700 }} onClick={() => navigate(VIEWS.BARS)}>View All ({filteredBars.length}) →</button>
          </div>
        </div>

        {filteredBars.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 14 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🍸</div>
            <h3 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", color: 'var(--color-text-primary)', margin: '0 0 0.5rem' }}>No bars found</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0 0 1rem' }}>Try a different category or clear your search.</p>
            <button className="btn" style={{ background: '#C9762F', color: '#fff', borderRadius: 10, fontWeight: 700 }} onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}>Show All Bars</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {filteredBars.slice(0, 8).map((bar) => {
              const open = isOpenToday(bar);
              const primaryType = getPrimaryBarType(bar);
              const logoSrc = imageUrl(bar.logo_path || bar.bar_icon);
              return (
                <div key={bar.id} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 16px rgba(23,20,18,0.04)' }}
                  className="hover:-translate-y-1 hover:shadow-md" onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: bar.id })}>
                  <div style={{ position: 'relative', height: 150, overflow: 'hidden' }}>
                    <img src={imageUrl(bar.image_path) || BAR_PLACEHOLDER} alt={bar.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = BAR_PLACEHOLDER; }} />
                    <span style={{ position: 'absolute', top: 10, left: 10, background: '#C9762F', color: '#FFFFFF', fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 4, textTransform: 'uppercase' }}>{primaryType}</span>
                    <span style={{ position: 'absolute', top: 10, right: 10, background: open ? '#2E7D4F' : '#7A2430', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 4 }}>{open ? 'OPEN' : 'CLOSED'}</span>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {logoSrc ? (
                        <img src={logoSrc} alt={bar.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border)', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#C9762F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{bar.name ? bar.name[0].toUpperCase() : 'B'}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bar.name}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}><MapPin size={12} style={{ display: 'inline', marginRight: 2 }} />{bar.city || 'Cavite'} &bull; {primaryType}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                      <span style={{ color: '#C9762F', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Star size={13} fill="#C9762F" stroke="#C9762F" /> {bar.rating || '4.8'}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>{bar.review_count || 0} reviews</span>
                    </div>
                    <button className="btn w-full" style={{ marginTop: '0.75rem', background: '#C9762F', color: '#ffffff', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem' }}
                      onClick={(e) => { e.stopPropagation(); navigate(VIEWS.BAR_DETAIL, { barId: bar.id }); }}>
                      View Details &amp; Menu →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </div>
    </>
  );
}

export default HomeView;
