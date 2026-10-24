import { useState, useEffect } from 'react';
import { feedWidgetsService } from '../../services/feedWidgetsService';
import { imageUrl } from '../../utils/imageUrl';
import { formatTime } from '../../utils/dateHelpers';
import { TrendingUp, Users, Calendar, Radio, Tag, MapPin, UserPlus } from 'lucide-react';

export function LeftSidebar({ activeFilter, onFilterChange }) {
  const [activeBars, setActiveBars] = useState([]);
  const [quickStats, setQuickStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [bars, stats] = await Promise.all([
          feedWidgetsService.getActiveBars(),
          feedWidgetsService.getQuickStats(),
        ]);
        setActiveBars(bars);
        setQuickStats(stats);
      } catch (err) {
        console.error('Left sidebar load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;

  return (
    <div className="feed-sidebar-left">
      {/* Feed Filter */}
      <div className="sidebar-widget">
        <h3 className="sidebar-widget-title">Feed Filter</h3>
        <div className="feed-filter-buttons">
          <button
            className={`feed-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange('all')}
          >
            All Posts
          </button>
          <button
            className={`feed-filter-btn ${activeFilter === 'events' ? 'active' : ''}`}
            onClick={() => onFilterChange('events')}
          >
            Events Only
          </button>
          <button
            className={`feed-filter-btn ${activeFilter === 'posts' ? 'active' : ''}`}
            onClick={() => onFilterChange('posts')}
          >
            Posts Only
          </button>
        </div>
      </div>

      {/* Active Bars */}
      {activeBars.length > 0 && (
        <div className="sidebar-widget">
          <h3 className="sidebar-widget-title">
            <Radio size={16} /> Active Bars
          </h3>
          <div className="active-bars-list">
            {activeBars.map((bar) => (
              <div key={bar.id} className="active-bar-item">
                <div className="active-bar-avatar">
                  {bar.logo_path ? (
                    <img src={imageUrl(bar.logo_path)} alt={bar.name} />
                  ) : (
                    <div className="active-bar-avatar-placeholder">{bar.name[0]}</div>
                  )}
                  {bar.is_live && <span className="live-badge">LIVE</span>}
                </div>
                <div className="active-bar-info">
                  <div className="active-bar-name">{bar.name}</div>
                  <div className="active-bar-meta">{bar.city}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {quickStats && (
        <div className="sidebar-widget">
          <h3 className="sidebar-widget-title">
            <TrendingUp size={16} /> Quick Stats
          </h3>
          <div className="quick-stats-grid">
            <div className="quick-stat-item">
              <div className="quick-stat-value">{quickStats.total_events || 0}</div>
              <div className="quick-stat-label">Total Events</div>
            </div>
            <div className="quick-stat-item">
              <div className="quick-stat-value">{quickStats.events_today || 0}</div>
              <div className="quick-stat-label">Today</div>
            </div>
            <div className="quick-stat-item">
              <div className="quick-stat-value">{quickStats.total_bars || 0}</div>
              <div className="quick-stat-label">Bars</div>
            </div>
            <div className="quick-stat-item">
              <div className="quick-stat-value accent">{quickStats.bars_live || 0}</div>
              <div className="quick-stat-label">Live Now</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RightSidebar() {
  const [hotTonight, setHotTonight] = useState([]);
  const [genreTags, setGenreTags] = useState([]);
  const [barCities, setBarCities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [events, tags, cities] = await Promise.all([
          feedWidgetsService.getHotTonight(),
          feedWidgetsService.getGenreTags(),
          feedWidgetsService.getBarCities(),
        ]);
        setHotTonight(events);
        setGenreTags(tags);
        setBarCities(cities);
      } catch (err) {
        console.error('Right sidebar load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;

  return (
    <div className="feed-sidebar-right">
      {/* Hot Tonight */}
      {hotTonight.length > 0 && (
        <div className="sidebar-widget">
          <h3 className="sidebar-widget-title">
            <Calendar size={16} /> Hot Tonight
          </h3>
          <div className="hot-tonight-list">
            {hotTonight.map((event) => (
              <div key={event.id} className="hot-tonight-item">
                <div className="hot-tonight-time">{formatTime(event.start_time)}</div>
                <div className="hot-tonight-content">
                  <div className="hot-tonight-title">{event.title}</div>
                  <div className="hot-tonight-bar">{event.bar_name}</div>
                  {event.entry_price > 0 && (
                    <div className="hot-tonight-price">₱{Number(event.entry_price).toFixed(0)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Browse by Vibe */}
      {genreTags.length > 0 && (
        <div className="sidebar-widget">
          <h3 className="sidebar-widget-title">
            <Tag size={16} /> Browse by Vibe
          </h3>
          <div className="genre-tags-list">
            {genreTags.map((tag, idx) => (
              <button key={idx} className="genre-tag-btn">
                {tag.tag} <span className="genre-tag-count">{tag.event_count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Party Weather */}
      {barCities.length > 0 && (
        <div className="sidebar-widget">
          <h3 className="sidebar-widget-title">
            <MapPin size={16} /> Party Weather
          </h3>
          <div className="party-weather-list">
            {barCities.slice(0, 5).map((city, idx) => (
              <div key={idx} className="party-weather-item">
                <div className="party-weather-city">{city.city}</div>
                <div className="party-weather-bars">{city.bar_count} bars</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Friends CTA */}
      <div className="sidebar-widget">
        <h3 className="sidebar-widget-title">
          <UserPlus size={16} /> Invite Friends
        </h3>
        <p className="invite-text">Share the party! Invite your squad to discover the best nightlife in Cavite.</p>
        <button className="btn btn-red btn-sm w-full">
          <UserPlus size={14} /> Invite Now
        </button>
      </div>
    </div>
  );
}
