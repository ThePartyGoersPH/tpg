import { useEffect, useState } from 'react';
import { barService } from '../services/barService';
import { authService } from '../services/authService';
import BarCard from '../components/bars/BarCard';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

function HomePage() {
  const [trendingBars, setTrendingBars] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [maintenance, setMaintenance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHome() {
      try {
        const [trending, bulletin, maintenanceStatus] = await Promise.all([
          barService.trending(6),
          authService.getAnnouncements(5),
          authService.getMaintenanceStatus(),
        ]);
        setTrendingBars(trending);
        setAnnouncements(bulletin);
        setMaintenance(maintenanceStatus);
      } finally {
        setLoading(false);
      }
    }

    loadHome();
  }, []);

  if (loading) {
    return <LoadingState label="Loading home feed..." />;
  }

  return (
    <div className="grid">
      <section className="hero">
        <p className="badge">Explore Tonight</p>
        <h1 className="section-title" style={{ marginTop: '0.8rem' }}>Discover Cavite's top bars and events</h1>
        <p>Follow your favorite bars, check events, and reserve your table in one place.</p>
      </section>

      {maintenance?.maintenance_mode ? (
        <section className="card">
          <h3>Platform Notice</h3>
          <p>{maintenance.maintenance_message || 'Maintenance mode is currently active.'}</p>
        </section>
      ) : null}

      <section>
        <h2 className="section-title">Trending Bars</h2>
        <p className="section-subtitle">Ranked by followers, reviews, reservations, and event activity.</p>
        {!trendingBars.length ? (
          <EmptyState title="No trending bars available" />
        ) : (
          <div className="grid bars-grid" style={{ marginTop: '1rem' }}>
            {trendingBars.map((bar) => (
              <BarCard key={bar.id} bar={bar} />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Announcements</h3>
        {!announcements.length ? (
          <p className="section-subtitle">No active announcements.</p>
        ) : (
          <div className="grid">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="card card-muted">
                <h4 style={{ margin: 0 }}>{announcement.title}</h4>
                <p>{announcement.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default HomePage;
