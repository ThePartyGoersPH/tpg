import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { barService } from '../services/barService';
import { imageUrl } from '../utils/imageUrl';

function LandingPage() {
  const [trendingBars, setTrendingBars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrending() {
      try {
        const bars = await barService.trending(6);
        setTrendingBars(bars);
      } catch (error) {
        console.error('Failed to load trending bars:', error);
        setTrendingBars([]);
      } finally {
        setLoading(false);
      }
    }
    loadTrending();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="container">
          <div className="hero-content">
            <img src="/logo192.png" alt="The Party Goers PH" className="landing-logo" />
            <h1 className="landing-title">Discover Cavite's Best Bars & Nightlife</h1>
            <p className="landing-subtitle">
              Find trending bars, reserve tables, follow events, and explore the nightlife scene in one platform.
            </p>
            <div className="landing-cta">
              <Link to="/explore" className="button button-large">
                Explore Bars
              </Link>
              <Link to="/login" className="button ghost button-large">
                Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="container">
          <h2 className="section-title text-center">Why Choose The Party Goers PH?</h2>
          <p className="section-subtitle text-center">Everything you need to plan your perfect night out</p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🍸</div>
              <h3>Discover Bars</h3>
              <p>Browse hundreds of bars with detailed info, menus, photos, and real customer reviews.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📅</div>
              <h3>Table Reservations</h3>
              <p>Reserve your table in advance. Check real-time availability and get instant confirmation.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎉</div>
              <h3>Events & Nightlife</h3>
              <p>Stay updated with upcoming events, live music, DJ nights, and special promotions.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">❤️</div>
              <h3>Follow Your Favorites</h3>
              <p>Follow bars you love and get notified about new events, menu updates, and exclusive offers.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📍</div>
              <h3>Interactive Maps</h3>
              <p>Find bars near you with our interactive map. Get directions and navigate directly in-app.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Real-time Updates</h3>
              <p>See live table availability, current events, and instant booking confirmations.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-trending">
        <div className="container">
          <h2 className="section-title text-center">Trending Bars Right Now</h2>
          <p className="section-subtitle text-center">Most popular bars based on followers, reviews, and reservations</p>

          {loading ? (
            <p className="text-center">Loading trending bars...</p>
          ) : (
            <div className="trending-grid">
              {trendingBars.map((bar) => (
                <Link to={`/explore?bar=${bar.id}`} className="trending-card" key={bar.id}>
                  <img
                    src={imageUrl(bar.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240' viewBox='0 0 400 240'%3E%3Crect width='400' height='240' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='52' fill='%23333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`}
                    alt={bar.name}
                    className="trending-image"
                  />
                  <div className="trending-content">
                    <h3>{bar.name}</h3>
                    <p className="trending-location">{bar.city}</p>
                    <div className="trending-meta">
                      <span>⭐ {bar.rating || '0.0'}</span>
                      <span>{bar.follower_count || 0} followers</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="text-center" style={{ marginTop: '2rem' }}>
            <Link to="/explore" className="button button-large">
              View All Bars
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="container">
          <div className="cta-box">
            <h2>Ready to explore Cavite's nightlife?</h2>
            <p>Join thousands of party-goers discovering the best bars and events.</p>
            <div className="landing-cta">
              <Link to="/register" className="button button-large">
                Create Free Account
              </Link>
              <Link to="/explore" className="button ghost button-large">
                Browse as Guest
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <img src="/logo192.png" alt="The Party Goers PH" className="footer-logo" />
              <p>Your ultimate guide to Cavite's bar and nightlife scene.</p>
            </div>

            <div className="footer-col">
              <h4>Platform</h4>
              <ul>
                <li><Link to="/explore">Explore Bars</Link></li>
                <li><Link to="/map">Bars Map</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Account</h4>
              <ul>
                <li><Link to="/login">Login</Link></li>
                <li><Link to="/register">Register</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Contact</h4>
              <p>Email: thepartygoers3@gmail.com</p>
              <p>Cavite, Philippines</p>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2026 The Party Goers PH. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
