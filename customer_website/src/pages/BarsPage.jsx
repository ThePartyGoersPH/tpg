import { useState } from 'react';
import BarCard from '../components/bars/BarCard';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { useBars } from '../hooks/useBars';
import { socialService } from '../services/socialService';

function BarsPage() {
  const { bars, loading, error, params, updateFilters, refetch } = useBars();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const handleFilterChange = (key, value) => {
    setSearchResults(null);
    updateFilters({ [key]: value || undefined });
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!search.trim()) {
      setSearchResults(null);
      refetch();
      return;
    }

    setSearching(true);
    try {
      const result = await socialService.searchBars(search.trim());
      setSearchResults(result);
    } finally {
      setSearching(false);
    }
  };

  const renderedBars = Array.isArray(searchResults) ? searchResults : bars;

  return (
    <div className="grid">
      <section className="card">
        <h1 className="section-title">Find Bars in Cavite</h1>
        <p className="section-subtitle">Browse active bars by category.</p>

        <div className="grid two-col" style={{ marginTop: '1rem' }}>
          <input
            className="input"
            placeholder="Category (e.g. nightclub, sports bar)"
            value={params.category || ''}
            onChange={(event) => handleFilterChange('category', event.target.value)}
          />
          <button className="button ghost" type="button" onClick={() => refetch(params)}>
            Apply Filter
          </button>
        </div>

        <form className="inline-form" onSubmit={handleSearch}>
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by bar name, city, address"
          />
          <button className="button" type="submit" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </section>

      {loading ? <LoadingState label="Loading bars..." /> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading ? (
        renderedBars.length ? (
          <div className="grid bars-grid">
            {renderedBars.map((bar) => (
              <BarCard key={bar.id} bar={bar} />
            ))}
          </div>
        ) : (
          <EmptyState title="No bars found" subtitle="Try changing filters or search terms." />
        )
      ) : null}
    </div>
  );
}

export default BarsPage;
