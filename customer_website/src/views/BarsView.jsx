import { useEffect, useState } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { useBars } from '../hooks/useBars';
import { imageUrl } from '../utils/imageUrl';
import { getBarTypes, getPrimaryBarType } from '../utils/barTypeLabel';
import { Search, Star, Filter, MapPin, Sparkles, Utensils, Martini, Mic, Music, Laugh, Beer } from 'lucide-react';
import { getBarOpenStatus } from '../utils/barOpenStatus';

const BAR_PLACEHOLDER = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80';

const NEAR_KM = 5;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Bar card cover photo with GIF hover ── */
function BarCardImage({ bar, badge, isNear, isFeatured }) {
  const [hovered, setHovered] = useState(false);
  const hasGif = Boolean(bar.video_path || bar.bar_gif);
  const staticSrc = imageUrl(bar.image_path) || BAR_PLACEHOLDER;
  const gifSrc = hasGif ? imageUrl(bar.video_path || bar.bar_gif) : null;
  const [hoverTimeout, setHoverTimeout] = useState(null);

  const handleMouseEnter = () => {
    if (!hasGif) return;
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const timeout = setTimeout(() => setHovered(true), 300);
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) { clearTimeout(hoverTimeout); setHoverTimeout(null); }
    setHovered(false);
  };

  return (
    <div
      className="grab-bar-img-wrap"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img
        src={hovered && gifSrc ? gifSrc : staticSrc}
        alt={bar.name}
        className="grab-bar-img"
        draggable={false}
        onError={e => { e.target.src = BAR_PLACEHOLDER; }}
      />
      {/* Category badge overlaid on the photo */}
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: '#CC0000',
            color: '#fff',
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '0.25rem 0.65rem',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {badge}
        </span>
      )}
      {/* Top Rated tag (uniform grid — overlay only) */}
      {isFeatured && (
        <span className="bars-featured-ribbon">
          <Star size={11} fill="#fff" stroke="#fff" /> Top Rated
        </span>
      )}
      {/* Near badge */}
      {isNear && (
        <span
          style={{
            position: 'absolute',
            ...(isFeatured ? { bottom: 8, right: 8 } : { top: 10, right: 10 }),
            background: '#10b981',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 800,
            padding: '0.2rem 0.55rem',
            borderRadius: 4,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          📍 Nearby
        </span>
      )}
      {/* GIF indicator */}
      {hasGif && !hovered && (
        <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(204,0,0,0.85)', borderRadius: 4, padding: '2px 7px', fontSize: '0.6rem', fontWeight: 700, color: '#fff', letterSpacing: '1px', backdropFilter: 'blur(4px)' }}>GIF</div>
      )}
    </div>
  );
}

/* ── Main View ── */
function BarsView() {
  const { navigate, viewParams } = useView();
  const { bars, loading, error } = useBars();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedBarTypes, setSelectedBarTypes] = useState([]);

  const filterBarsByQuery = (items, query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return items;
    return (items || []).filter((bar) => {
      const typeStr = Array.isArray(bar?.bar_types)
        ? bar.bar_types.join(' ')
        : (bar?.bar_types || '');
      const haystack = [bar?.name, bar?.city, bar?.address, bar?.category, typeStr]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      window.history.pushState({}, '', '/bars');
      return;
    }
    setSearching(true);
    try {
      setSearchResults(filterBarsByQuery(bars, q));
      window.history.pushState({}, '', `/bars?search=${encodeURIComponent(q)}`);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (searchResults === null) return;
    const q = search.trim();
    if (!q) return;
    setSearchResults(filterBarsByQuery(bars, q));
  }, [bars]);

  // Seed search from the homepage hero or a /bars?search= URL param.
  // Uses the SAME filterBarsByQuery so both entry points stay in sync.
  useEffect(() => {
    const q = String(viewParams?.search || '').trim();
    if (!q) return;
    if (!bars || bars.length === 0) return; // wait until bars are loaded
    if (search.trim() === q && searchResults !== null) return; // already applied
    setSearch(q);
    setSearchResults(filterBarsByQuery(bars, q));
  }, [bars, viewParams]);

  const baseBars = searchResults !== null ? searchResults : bars;
  const hasSearch = searchResults !== null && search.trim() !== '';

  const displayedBars = (baseBars || []).filter((bar) => {
    if (selectedBarTypes.length === 0) return true;
    const types = getBarTypes(bar);
    return selectedBarTypes.some((t) => types.includes(t));
  });

  const featuredId = displayedBars.length
    ? [...displayedBars].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))[0].id
    : null;

  const CATEGORIES = ['All', 'Restobar', 'Cocktail Bar', 'KTV Lounge', 'Live Music', 'Comedy Bar', 'Beer Garden'];

  const CATEGORY_ICONS = {
    'All': Sparkles,
    'Restobar': Utensils,
    'Cocktail Bar': Martini,
    'KTV Lounge': Mic,
    'Live Music': Music,
    'Comedy Bar': Laugh,
    'Beer Garden': Beer,
  };

  return (
    <div className="flex flex-col gap-lg animate-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 0.5rem 3rem' }}>

      {/* ── PAGE HEADER ── */}
      <section className="bars-hero flex flex-col gap-md">
        <div>
          <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
            EXPLORE CAVITE NIGHTLIFE
          </span>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 800, margin: '0 0 0.3rem', color: 'var(--color-text-primary)' }}>
            Find Bars &amp; Restobars
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Browse top-rated nightlife spots, cocktail lounges, and restobars in Cavite.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div className="grab-search-box" style={{ flex: '1 0 260px', margin: 0 }}>
            <Search size={18} color="#CC0000" />
            <input
              type="text"
              className="grab-search-input"
              placeholder="Search by bar name, city, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-red"
            style={{ padding: '0.75rem 1.5rem', borderRadius: 10, fontWeight: 700 }}
            disabled={searching}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Category Pills */}
        <div className="flex gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={14} color="#CC0000" /> Category:
          </span>
          {CATEGORIES.map((type) => {
            const isSelected = type === 'All' ? selectedBarTypes.length === 0 : selectedBarTypes.includes(type);
            const Icon = CATEGORY_ICONS[type] || Sparkles;
            const handleClick = () => {
              if (type === 'All') {
                setSelectedBarTypes([]);
              } else {
                setSelectedBarTypes(prev =>
                  prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                );
              }
            };
            return (
              <button
                key={type}
                type="button"
                onClick={handleClick}
                className={`bars-pill ${isSelected ? 'active' : ''}`}
                aria-pressed={isSelected}
              >
                <Icon size={14} />
                {type}
              </button>
            );
          })}
        </div>

        {!loading && displayedBars.length > 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Showing <strong style={{ color: 'var(--color-text-primary)' }}>{displayedBars.length}</strong>{' '}
            bar{displayedBars.length !== 1 ? 's' : ''} in Cavite
          </p>
        )}
      </section>

      {/* ── BAR CARDS GRID ── */}
      {loading && (
        <div className="loading-state" style={{ minHeight: '40vh' }}>
          <div className="spinner" /><span>Loading bars...</span>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        displayedBars.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {displayedBars.map((bar) => {
              const lat = Number(bar.latitude);
              const lng = Number(bar.longitude);
              const logoSrc = imageUrl(bar.logo_path || bar.bar_icon);
              const primaryBarType = getPrimaryBarType(bar);
              const isFeatured = bar.id === featuredId;
              const hasReviews = (bar.review_count || 0) > 0;
              const isNear =
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                userLocation &&
                haversineKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_KM;
              const openStatus = getBarOpenStatus(bar);

              return (
                <div
                  className="grab-bar-card"
                  key={bar.id}
                  onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: bar.id })}
                >
                  {/* Cover photo with badge inside */}
                  <BarCardImage bar={bar} badge={primaryBarType} isNear={isNear} isFeatured={isFeatured} />

                  {/* Card Body */}
                  <div className="grab-bar-body">
                    <div className="flex items-center gap-sm">
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt={bar.name}
                          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)', flexShrink: 0 }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#CC0000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
                          {bar.name ? bar.name[0].toUpperCase() : 'B'}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <h3 className="grab-bar-title">{bar.name}</h3>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: openStatus.isOpen ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.15)', color: openStatus.isOpen ? '#10b981' : '#9ca3af', whiteSpace: 'nowrap' }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: openStatus.isOpen ? '#10b981' : '#9ca3af' }} />
                            {openStatus.label}
                          </span>
                        </div>
                        <p className="grab-bar-meta" style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>
                          <MapPin size={12} style={{ marginRight: 3 }} />{bar.city || 'Cavite'} &bull; {primaryBarType}
                        </p>
                      </div>
                    </div>

                    <div className="grab-bar-stats">
                      <span className="grab-bar-rating">
                        <Star size={14} fill={hasReviews ? '#F5B544' : 'none'} stroke={hasReviews ? '#F5B544' : 'rgba(255,255,255,0.25)'} />
                        {hasReviews
                          ? <span style={{ color: '#F5B544', fontWeight: 700 }}>{bar.rating}</span>
                          : <span className="muted">New</span>}
                        {hasReviews && <span className="muted">({bar.review_count} reviews)</span>}
                      </span>
                      {hasReviews && <span className="divider" />}
                      <span className={hasReviews ? '' : 'muted'}>{bar.follower_count || 0} followers</span>
                    </div>

                    <button
                      className="btn btn-red w-full"
                      style={{ marginTop: '0.85rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={(e) => { e.stopPropagation(); navigate(VIEWS.BAR_DETAIL, { barId: bar.id }); }}
                    >
                      View Details &amp; Menu <span className="cta-arrow">→</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 16 }}>
            <Search size={36} color="#CC0000" />
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.25rem', fontWeight: 700, margin: '1rem 0 0.5rem', color: 'var(--color-text-primary)' }}>
              {hasSearch ? `No bars found for "${search.trim()}"` : 'No bars found'}
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
              {hasSearch
                ? `We couldn't find any bars matching "${search.trim()}". Try a different keyword or clear the category filters.`
                : 'Try changing your filters or searching another keyword.'}
            </p>
          </div>
        )
      )}
    </div>
  );
}

export default BarsView;
