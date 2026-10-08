import { useEffect, useMemo, useState, useRef } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { barService } from '../services/barService';
import { imageUrl } from '../utils/imageUrl';
import { getBarTypes, getPrimaryBarType } from '../utils/barTypeLabel';
const bgHome = '/bg-home.jpg';
import { Wine, CalendarCheck, Sparkles, Heart, MapPin, Zap, CheckCircle, ArrowRight, Star, Users, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

function LandingView() {
  const { navigate } = useView();
  const [trending, setTrending] = useState([]);
  const [allVenues, setAllVenues] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const sliderRef = useRef(null);

  // Background images for slideshow
  const heroImages = [
    bgHome,
    bgHome,
    bgHome,
  ];

  useEffect(() => {
    let cancelled = false;

    Promise.all([barService.trending(6), barService.list()])
      .then(([trendingData, venueData]) => {
        if (cancelled) return;
        setTrending(Array.isArray(trendingData) ? trendingData : []);
        setAllVenues(Array.isArray(venueData) ? venueData : []);
      })
      .catch(() => {
        if (cancelled) return;
        setTrending([]);
        setAllVenues([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const venueTypeStats = useMemo(() => {
    const fallback = {
      barsPubs: 18,
      restoBars: 12,
      ktvLounges: 9,
      liveMusic: 7,
    };

    if (!Array.isArray(allVenues) || allVenues.length === 0) {
      return fallback;
    }

    const counts = {
      barsPubs: 0,
      restoBars: 0,
      ktvLounges: 0,
      liveMusic: 0,
    };

    allVenues.forEach((venue) => {
      const normalizedTypeText = [
        ...getBarTypes(venue).map((item) => String(item || '').toLowerCase()),
        String(venue?.category || '').toLowerCase(),
      ].join(' ');

      if (
        normalizedTypeText.includes('bar') ||
        normalizedTypeText.includes('pub') ||
        normalizedTypeText.includes('club')
      ) {
        counts.barsPubs += 1;
      }
      if (normalizedTypeText.includes('resto')) {
        counts.restoBars += 1;
      }
      if (normalizedTypeText.includes('ktv')) {
        counts.ktvLounges += 1;
      }
      if (
        normalizedTypeText.includes('live music') ||
        normalizedTypeText.includes('music') ||
        normalizedTypeText.includes('concert')
      ) {
        counts.liveMusic += 1;
      }
    });

    return counts;
  }, [allVenues]);

  // Auto-rotate slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000); // Change every 5 seconds
    return () => clearInterval(interval);
  }, [heroImages.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
  };

  const scrollSlider = (dir) => {
    const el = sliderRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('.ts-card')?.offsetWidth || 380;
    el.scrollBy({ left: dir * (cardWidth + 24), behavior: 'smooth' });
  };

  return (
    <div className="landing-shell">
      {/* ── HERO ── */}
      <section className="land-hero-v2">
        {/* Background Slideshow */}
        <div className="hero-slideshow">
          {heroImages.map((img, index) => (
            <div
              key={index}
              className={`hero-slide ${index === currentSlide ? 'active' : ''}`}
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(10,10,10,0.3) 0%, rgba(10,10,10,0.8) 60%, rgba(10,10,10,0.95) 100%), url("${img}")`,
              }}
            />
          ))}
        </div>

        {/* Mobile-only: compact header area with logo + theme toggle */}
        <div className="land-hero-mobile-header">
          <div className="land-hero-mobile-brand">
            <div className="land-hero-mobile-logo" />
            <span className="land-hero-mobile-wordmark">Party Goers</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Side Navigation - Left (desktop only, hidden on mobile via CSS) */}
        <nav className="land-side-nav">
          <a href="#platform" className="land-side-link">Work</a>
          <a href="#features" className="land-side-link">About</a>
          <a href="#trending" className="land-side-link">Bars</a>
          <a href="#cta" className="land-side-link">Contact</a>
        </nav>

        {/* Top Right CTA — desktop only */}
        <div className="land-top-cta">
          <button 
            className="land-email-btn" 
            onClick={() => navigate(VIEWS.LOGIN)}
          >
            HI@THEPARTYGOERS.PH
          </button>
        </div>

        {/* Main Hero Content */}
        <div className="land-hero-v2-content">
          {/* Badge */}
          <div className="land-hero-v2-badge">
            <span className="land-hero-v2-dot" />
            <span>Now Live — Nightlife Platform</span>
          </div>

          {/* Main Title - Large Typography */}
<h1 className="land-hero-v2-title" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', letterSpacing: '-0.3px', marginBottom: '0.3rem' }}>
  Every<br />
  <span className="land-hero-v2-accent">Night Out</span><br />
  <span style={{ position: 'relative', background: 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}>Starts Here.</span>
</h1>

          {/* Subtitle */}
          <p className="land-hero-v2-sub">
            Discover bars, resto bars, KTVs, and nightlife spots near you.
            Reserve a table, check events, and own your night — all in one place.
          </p>

          <div className="land-hero-v2-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="land-hero-v2-tag" style={{ flex: '1 1 120px', fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: 9999, background: 'rgba(255,255,255,0.1)', color: '#fff', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              🍺 Bars
            </span>
            <span className="land-hero-v2-tag" style={{ flex: '1 1 120px', fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: 9999, background: 'rgba(255,255,255,0.1)', color: '#fff', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              🍽️ Resto Bars
            </span>
            <span className="land-hero-v2-tag" style={{ flex: '1 1 120px', fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: 9999, background: 'rgba(255,255,255,0.1)', color: '#fff', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              🎤 KTV
            </span>
            <span className="land-hero-v2-tag" style={{ flex: '1 1 120px', fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: 9999, background: 'rgba(255,255,255,0.1)', color: '#fff', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              🎶 Live Music
            </span>
            <span className="land-hero-v2-tag" style={{ flex: '1 1 120px', fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: 9999, background: 'rgba(255,255,255,0.1)', color: '#fff', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              🎉 Event Venues
            </span>
          </div>

          <div className="land-hero-v2-cta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              className="btn btn-red btn-lg btn-pill btn-red-pulse"
              style={{ width: '100%', minHeight: '44px' }}
              onClick={() => navigate(VIEWS.BARS)}
            >
              Explore Venues
            </button>
            <button
              className="btn btn-ghost btn-lg btn-pill"
              style={{ width: '100%', minHeight: '44px' }}
              onClick={() => navigate(VIEWS.EVENTS)}
            >
              View Events
            </button>
          </div>
        </div>

        <div className="land-hero-v2-panel">
          {/* Dashboard Preview Card - Bottom Right */}
          <div className="land-hero-v2-card">
            <div className="land-dash-header">
              <div className="flex items-center gap-sm">
                <div className="land-dash-logo" />
                <span className="land-dash-brand">THE PARTY GOERS</span>
              </div>
              <div className="land-dash-live"><span className="land-live-dot" /> Live</div>
            </div>
            <div className="land-dash-grid">
              <div className="land-dash-stat">
                <span className="land-dash-stat-label">Tonight's Venues</span>
                <span className="land-dash-stat-value">{trending.length || 12}</span>
                <span className="land-dash-stat-sub land-dash-stat-green">Active tonight</span>
              </div>
              <div className="land-dash-stat">
                <span className="land-dash-stat-label">Featured Events</span>
                <span className="land-dash-stat-value">8</span>
                <span className="land-dash-stat-sub land-dash-stat-yellow">This week</span>
              </div>
              <div className="land-dash-stat">
                <span className="land-dash-stat-label">Reservations</span>
                <span className="land-dash-stat-value">150+</span>
                <span className="land-dash-stat-sub">This month</span>
              </div>
              <div className="land-dash-stat">
                <span className="land-dash-stat-label">Happy Customers</span>
                <span className="land-dash-stat-value">2.5K</span>
                <span className="land-dash-stat-sub land-dash-stat-green">And growing</span>
              </div>
            </div>
          </div>

          <div className="land-hero-v2-breakdown">
            <span className="land-vtype-title">Venue Types</span>
            <div className="land-vtype-row">
              <span>Bars &amp; Pubs</span>
              <span>+{venueTypeStats.barsPubs} venues</span>
            </div>
            <div className="land-vtype-row">
              <span>Resto Bars</span>
              <span>+{venueTypeStats.restoBars} venues</span>
            </div>
            <div className="land-vtype-row">
              <span>KTV Lounges</span>
              <span>+{venueTypeStats.ktvLounges} venues</span>
            </div>
            <div className="land-vtype-row">
              <span>Live Music</span>
              <span>+{venueTypeStats.liveMusic} venues</span>
            </div>
          </div>
        </div>

        {/* Scroll Down Indicator */}
        <div className="land-scroll-down" onClick={() => document.getElementById('platform').scrollIntoView({ behavior: 'smooth' })}>
          <span>Scroll Down</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>

        {/* Background Glow Effects */}
        <div className="land-hero-v2-glow" />
        <div className="land-hero-v2-glow-2" />
      </section>

      {/* ── PLATFORM SECTION ── */}
      <section id="platform" className="land-platform">
        <div className="container">
          <div className="land-platform-inner">
            <div className="land-platform-text animate-in">
              <span className="land-section-label">THE PLATFORM</span>
              <h2 className="land-section-title">
                EVERYTHING YOU NEED.<br />
                <span className="land-hero-accent">ONE</span> PLATFORM.
              </h2>
              <p className="land-section-desc">
                Party Goers PH is a complete nightlife discovery platform built exclusively for the Philippine bar scene. Discover bars, reserve tables, track events, and explore nightlife — all from a single, powerful app.
              </p>
              <div className="land-check-list">
                <div className="land-check-item">
                  <CheckCircle size={18} color="#CC0000" />
                  <span>Discover bars with menus, photos, and real reviews</span>
                </div>
                <div className="land-check-item">
                  <CheckCircle size={18} color="#CC0000" />
                  <span>Reserve tables with real-time availability</span>
                </div>
                <div className="land-check-item">
                  <CheckCircle size={18} color="#CC0000" />
                  <span>Follow bars and get event notifications</span>
                </div>
                <div className="land-check-item">
                  <CheckCircle size={18} color="#CC0000" />
                  <span>Interactive maps with directions to venues</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="land-features">
        <div className="container">
          <div className="text-center animate-in">
            <span className="land-section-label">FEATURES</span>
            <h2 className="land-section-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginTop: '0.75rem' }}>
              WHY CHOOSE <span className="land-hero-accent">PARTY GOERS</span>?
            </h2>
            <p className="land-section-desc" style={{ maxWidth: 560, margin: '0.75rem auto 0' }}>
              Everything you need to plan your perfect night out
            </p>
          </div>
          <div className="land-feature-grid">
            {[
              { Icon: Wine, title: 'Discover Bars', desc: 'Browse bars with detailed info, menus, photos, and real reviews from customers.' },
              { Icon: CalendarCheck, title: 'Table Reservations', desc: 'Reserve tables in advance with real-time availability and online payment.' },
              { Icon: Sparkles, title: 'Events & Nightlife', desc: 'Stay updated with upcoming events, live music, DJ nights, and promotions.' },
              { Icon: Heart, title: 'Follow Favorites', desc: 'Follow bars you love and get notified about new events and announcements.' },
              { Icon: MapPin, title: 'Interactive Maps', desc: 'Find bars near you with navigation, directions, and distance info.' },
              { Icon: Zap, title: 'Real-time Updates', desc: 'Live availability, instant booking confirmations, and payment tracking.' },
            ].map((f) => (
              <div className="land-feature-card animate-in" key={f.title}>
                <div className="land-feature-icon"><f.Icon size={22} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="land-how">
        <div className="container">
          <div className="text-center animate-in">
            <span className="land-section-label">HOW IT WORKS</span>
            <h2 className="land-section-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginTop: '0.75rem' }}>
              THREE SIMPLE <span className="land-hero-accent">STEPS</span>
            </h2>
          </div>
          <div className="land-steps">
            <div className="land-step animate-in">
              <div className="land-step-num">01</div>
              <h3>Create Account</h3>
              <p>Sign up for free in seconds. No credit card required.</p>
            </div>
            <div className="land-step-arrow"><ArrowRight size={24} /></div>
            <div className="land-step animate-in" style={{ animationDelay: '0.1s' }}>
              <div className="land-step-num">02</div>
              <h3>Discover & Reserve</h3>
              <p>Browse bars, check menus, and reserve your table online.</p>
            </div>
            <div className="land-step-arrow"><ArrowRight size={24} /></div>
            <div className="land-step animate-in" style={{ animationDelay: '0.2s' }}>
              <div className="land-step-num">03</div>
              <h3>Enjoy Your Night</h3>
              <p>Show up, have fun, and rate your experience.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRENDING SLIDER ── */}
      {trending.length > 0 && (
        <section id="trending" className="land-trending">
          <div className="container">
            <div className="text-center animate-in">
              <span className="land-section-label">TRENDING NOW</span>
              <h2 className="land-section-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginTop: '0.75rem' }}>
                TONIGHT'S <span className="land-hero-accent">TOP PICKS</span>
              </h2>
              <p className="land-section-desc" style={{ maxWidth: 520, margin: '0.75rem auto 0' }}>
                Most popular bars based on followers, reviews, and reservations
              </p>
            </div>
          </div>
          <div className="ts-accordion">
            {trending.map((bar, i) => {
              const primaryBarType = getPrimaryBarType(bar);
              return (
              <div className="ts-acc-card" key={bar.id} onClick={() => navigate(VIEWS.LOGIN)}>
                <img
                  src={imageUrl(bar.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='500' viewBox='0 0 600 500'%3E%3Crect width='600' height='500' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='52' fill='%23333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`}
                  alt={bar.name}
                  className="ts-acc-img"
                  onError={e => { e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='500' viewBox='0 0 600 500'%3E%3Crect width='600' height='500' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='52' fill='%23333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`; }}
                />
                <div className="ts-acc-overlay" />
                <span className="ts-acc-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="ts-acc-content">
                  <div className="ts-acc-header">
                    {bar.logo_path ? (
                      <img
                        src={imageUrl(bar.logo_path)}
                        alt={bar.name}
                        className="ts-acc-logo"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="ts-acc-logo-placeholder">
                        {(bar.name?.[0] || 'B').toUpperCase()}
                      </div>
                    )}
                    <h3 className="ts-acc-name">{bar.name}</h3>
                  </div>
                  <p className="ts-acc-sub">{primaryBarType}</p>
                  <button className="ts-acc-explore" onClick={(e) => { e.stopPropagation(); navigate(VIEWS.LOGIN); }}>
                    EXPLORE
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section id="cta" className="land-cta">
        <div className="container">
          <div className="land-cta-box animate-in">
            <div className="land-cta-glow" />
            <span className="land-section-label">JOIN THE COMMUNITY</span>
            <h2 className="land-section-title" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', marginTop: '0.75rem' }}>
              READY TO <span className="land-hero-accent">EXPLORE</span>?
            </h2>
            <p className="land-section-desc" style={{ maxWidth: 460, margin: '0.75rem auto 0' }}>
              Join thousands of party-goers discovering the best bars and events in the Philippines.
            </p>
            <div className="land-hero-cta" style={{ marginTop: '2rem' }}>
              <button className="btn btn-red btn-lg btn-pill btn-red-pulse" onClick={() => navigate(VIEWS.REGISTER)}>
                Create Free Account
              </button>
              <button className="btn btn-ghost btn-lg btn-pill" onClick={() => navigate(VIEWS.LOGIN)}>
                Sign In
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="land-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <img src="/party-logo-v2.png" alt="Logo" className="footer-logo" onError={(e) => { e.target.style.display = 'none'; }} />
              <p>Your ultimate guide to the Philippine bar and nightlife scene.</p>
            </div>
            <div className="footer-col">
              <h4>Platform</h4>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(VIEWS.LOGIN); }}>Explore Bars</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(VIEWS.LOGIN); }}>Events</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(VIEWS.MAP); }}>Bars Map</a>
            </div>
            <div className="footer-col">
              <h4>Account</h4>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(VIEWS.LOGIN); }}>Login</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(VIEWS.REGISTER); }}>Register</a>
            </div>
            <div className="footer-col">
              <h4>Contact</h4>
              <p>info@thepartygoersph.com</p>
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

export default LandingView;
