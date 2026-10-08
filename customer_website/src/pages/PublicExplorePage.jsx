import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { barService } from '../services/barService';
import { socialService } from '../services/socialService';
import { imageUrl } from '../utils/imageUrl';
import { getPrimaryBarType } from '../utils/barTypeLabel';

function PublicExplorePage() {
  const [searchParams] = useSearchParams();
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ city: '', category: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadBars();
  }, []);

  useEffect(() => {
    const barId = searchParams.get('bar');
    if (barId) {
      const element = document.getElementById(`bar-${barId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [searchParams, bars]);

  const loadBars = async (params = {}) => {
    try {
      setLoading(true);
      const data = await barService.list(params);
      setBars(data);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    const params = {};
    if (filters.city) params.city = filters.city;
    if (filters.category) params.category = filters.category;
    loadBars(params);
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!search.trim()) {
      loadBars();
      return;
    }

    try {
      const results = await socialService.searchBars(search.trim());
      setBars(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  return (
    <div className="public-explore-page">
      <div className="explore-header">
        <div className="container">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1 className="section-title">Explore Bars</h1>
          <p className="section-subtitle">Discover the best bars in Cavite</p>
        </div>
      </div>

      <div className="container">
        <div className="explore-filters card">
          <div className="grid three-col">
            <input
              className="input"
              placeholder="City (e.g. Cavite)"
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
            />
            <input
              className="input"
              placeholder="Category (e.g. nightclub)"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            />
            <button className="button" type="button" onClick={handleApplyFilters}>
              Apply Filters
            </button>
          </div>

          <form className="inline-form" onSubmit={handleSearch}>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by bar name, city, address"
            />
            <button className="button" type="submit">
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <p className="text-center">Loading bars...</p>
        ) : !bars.length ? (
          <div className="card text-center">
            <p>No bars found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="explore-grid">
            {bars.map((bar) => {
              const primaryBarType = getPrimaryBarType(bar);
              return (
                <article className="explore-card card" key={bar.id} id={`bar-${bar.id}`}>
                  <img
                    className="explore-image"
                    src={imageUrl(bar.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='420' viewBox='0 0 720 420'%3E%3Crect width='720' height='420' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='72' fill='%23333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`}
                    alt={bar.name}
                  />
                  <div className="explore-content">
                    <span className="badge">{primaryBarType}</span>
                    <h3>{bar.name}</h3>
                    <p className="section-subtitle">
                      {bar.city} · {bar.price_range || '$$'}
                    </p>
                    <p>{bar.description || 'Discover this bar and upcoming events.'}</p>
                    <div className="bar-meta">
                      <span>⭐ {bar.rating || '0.0'} ({bar.review_count || 0})</span>
                      <span>{bar.follower_count || 0} followers</span>
                    </div>
                    <p className="section-subtitle" style={{ marginTop: '0.5rem' }}>
                      Sign in to view full details, reserve tables, and follow this bar.
                    </p>
                    <Link to="/login" className="button">
                      Login to View Details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicExplorePage;
