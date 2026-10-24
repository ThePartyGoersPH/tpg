import { useEffect, useState } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { useBars } from '../hooks/useBars';
import { imageUrl } from '../utils/imageUrl';
import { getBarTypes, getPrimaryBarType } from '../utils/barTypeLabel';
import { Search, MapPin, Star, ArrowRight, SlidersHorizontal } from 'lucide-react';

const BAR_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'%3E%3Crect width='400' height='220' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%23333333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`;

function BarCardImage({ bar }) {
  const [hovered, setHovered] = useState(false);
  const hasGif = Boolean(bar.video_path || bar.bar_gif);
  const staticSrc = imageUrl(bar.image_path) || BAR_PLACEHOLDER;
  const gifSrc = hasGif ? imageUrl(bar.video_path || bar.bar_gif) : null;
  const [hoverTimeout, setHoverTimeout] = useState(null);

  const handleMouseEnter = () => {
    if (!hasGif) return;
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const timeout = setTimeout(() => setHovered(true), 300); // 300ms delay
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setHovered(false);
  };

  return (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img
        src={hovered && gifSrc ? gifSrc : staticSrc}
        alt={bar.name}
        className="bcard-img"
        onError={e => { e.target.src = BAR_PLACEHOLDER; }}
        style={{ transition: 'opacity 0.25s ease' }}
      />
      {hasGif && !hovered && (
        <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(204,0,0,0.85)', borderRadius: 4, padding: '2px 7px', fontSize: '0.6rem', fontWeight: 700, color: '#fff', letterSpacing: '1px', backdropFilter: 'blur(4px)' }}>GIF</div>
      )}
    </div>
  );
}

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

function BarsView() {
  const { navigate } = useView();
  const { bars, loading, error, params, updateFilters, refetch } = useBars();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [categoryInput, setCategoryInput] = useState(params.category || '');
  const [selectedBarTypes, setSelectedBarTypes] = useState([]);

  const filterBarsByQuery = (items, query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return items;
    return (items || []).filter((bar) => {
      const haystack = [bar?.name, bar?.city, bar?.address, bar?.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  const handleFilterChange = (key, value) => {
    setSearchResults(null);
    updateFilters({ [key]: value || undefined });
  };

  const handleApplyFilters = () => {
    setSearchResults(null);
    // Normalize category input: treat 'bar', 'bars', 'all', empty as no filter
    const rawCat = String(categoryInput ?? '').trim();
    const normalizedCat = rawCat.toLowerCase();
    const shouldClearCat = !rawCat || normalizedCat === 'bar' || normalizedCat === 'bars' || normalizedCat === 'all';
    updateFilters({ category: shouldClearCat ? undefined : rawCat });
    refetch();
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      setSearchResults(filterBarsByQuery(bars, q));
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

  // Filter by bar types
  const filterByBarTypes = (items) => {
    if (selectedBarTypes.length === 0) return items;
    return items.filter(bar => {
      const barTypes = getBarTypes(bar);
      return selectedBarTypes.some(selectedType => barTypes.includes(selectedType));
    });
  };

  const displayedBars = filterByBarTypes(searchResults !== null ? searchResults : bars);

  return (
    <div className="flex flex-col gap-xl">
      {/* ── Search Header ── */}
      <section className="animate-in">
        <span className="home-eyebrow">BROWSE BARS</span>
        <h1 className="home-section-title" style={{ marginTop: '0.5rem' }}>FIND BARS IN <span className="home-accent">CAVITE</span></h1>
        <p className="home-section-sub">Browse active bars by category.</p>

        <div className="flex gap-sm mt-lg" style={{ flexWrap: 'wrap' }}>
          <input
            className="glass-input"
            style={{ flex: '1 1 200px' }}
            placeholder="Category (e.g. nightclub)"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
          />
          <button className="btn btn-glass" type="button" onClick={handleApplyFilters}><SlidersHorizontal size={14} /> Apply Filters</button>
        </div>

        <form className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap' }} onSubmit={handleSearch}>
          <input
            className="glass-input"
            style={{ flex: '1 1 250px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by bar name, city, address"
          />
          <button className="btn btn-red" type="submit" disabled={searching}>
            {searching ? 'Searching...' : <><Search size={14} /> Search</>}
          </button>
        </form>

        {/* Bar Type Filters */}
        <div className="flex gap-sm mt-md" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-sm font-semibold" style={{ color: '#888' }}>Bar Type:</span>
          {['All', 'Club', 'Restobar', 'Comedy Bar', 'KTV', 'Bar'].map((type) => {
            const isSelected = type === 'All' ? selectedBarTypes.length === 0 : selectedBarTypes.includes(type);
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
                className="btn btn-sm"
                style={{
                  background: isSelected ? 'rgba(204,0,0,0.15)' : 'rgba(255,255,255,0.05)',
                  border: isSelected ? '1px solid rgba(204,0,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  color: isSelected ? '#fff' : '#888',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.8rem'
                }}
              >
                {type}
              </button>
            );
          })}
        </div>

        {!loading && displayedBars.length > 0 && (
          <p className="text-muted mt-md" style={{ fontSize: '0.82rem' }}>Showing <strong style={{ color: '#fff' }}>{displayedBars.length}</strong> bar{displayedBars.length !== 1 ? 's' : ''}{params.category ? ` in ${params.category}` : ''}</p>
        )}
      </section>

      {/* ── Results ── */}
      {loading && <div className="loading-state"><div className="spinner" /><span>Loading bars...</span></div>}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        displayedBars.length ? (
          <div className="bars-grid">
            {displayedBars.map((bar) => {
              const lat = Number(bar.latitude);
              const lng = Number(bar.longitude);
              const logoSrc = imageUrl(bar.logo_path || bar.bar_icon || bar.image_path);
              const primaryBarType = getPrimaryBarType(bar);
              const isNear =
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                userLocation &&
                haversineKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_KM;

              return (
                <div
                  className="bcard"
                  key={bar.id}
                  onClick={() => navigate(VIEWS.BAR_DETAIL, { barId: bar.id })}
                >
                  <BarCardImage bar={bar} />
                  <div className="bcard-scrim" />
                  <div className="bcard-badges">
                    <span className="bcard-pill">{primaryBarType}</span>
                    {isNear && <span className="badge-success" style={{ fontSize: '0.6rem', padding: '0.15rem 0.5rem' }}><MapPin size={10} /> Near</span>}
                  </div>
                  <div className="bcard-info">
                    <div className="bcard-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '2px solid rgba(255,255,255,0.9)',
                            boxShadow: '0 0 0 2px rgba(232,0,30,0.35), 0 10px 22px rgba(0,0,0,0.5)',
                            background: 'rgba(10,10,10,0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={`${bar.name} logo`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>🍸</span>
                          )}
                        </div>
                        <h3 className="bcard-name" style={{ margin: 0 }}>{bar.name}</h3>
                      </div>
                      <span className="bcard-followers">{bar.follower_count || 0} followers</span>
                    </div>
                    <p className="bcard-loc">{bar.city} · {bar.price_range || '$$'}</p>
                    <div className="bcard-rating"><Star size={12} /> {bar.rating || '0.0'} ({bar.review_count || 0})</div>
                    <button className="btn btn-red w-full" style={{ marginTop: '0.75rem' }} onClick={(e) => { e.stopPropagation(); navigate(VIEWS.BAR_DETAIL, { barId: bar.id }); }}>
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card empty-state">
            <div className="empty-icon"><Search size={32} /></div>
            <h3 className="text-h3">No bars found</h3>
            <p className="text-muted mt-sm">Try changing filters or search terms.</p>
          </div>
        )
      )}
    </div>
  );
}

export default BarsView;
