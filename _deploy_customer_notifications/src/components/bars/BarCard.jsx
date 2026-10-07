import { useState } from 'react';
import { Link } from 'react-router-dom';
import { imageUrl } from '../../utils/imageUrl';
import { getPrimaryBarType } from '../../utils/barTypeLabel';

const BAR_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='420' viewBox='0 0 720 420'%3E%3Crect width='720' height='420' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='72' fill='%23333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`;

function BarCard({ bar }) {
  const [hovered, setHovered] = useState(false);
  const hasGif = Boolean(bar.video_path || bar.bar_gif);
  const staticSrc = imageUrl(bar.image_path) || BAR_PLACEHOLDER;
  const gifSrc = hasGif ? imageUrl(bar.video_path || bar.bar_gif) : null;
  const primaryBarType = getPrimaryBarType(bar);

  // Debug logging - log ALL bars to see what data we're getting
  console.log('BarCard Data:', {
    id: bar.id,
    name: bar.name,
    video_path: bar.video_path,
    bar_gif: bar.bar_gif,
    hasGif: hasGif,
    gifSrc: gifSrc,
    staticSrc: staticSrc,
    hovered: hovered
  });

  return (
    <article className="card bar-card">
      <div
        style={{ position: 'relative', overflow: 'hidden' }}
        onMouseEnter={() => hasGif && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img 
          className="bar-thumb" 
          src={hovered && gifSrc ? gifSrc : staticSrc} 
          alt={bar.name}
          onError={e => { e.target.src = BAR_PLACEHOLDER; }}
          style={{ transition: 'opacity 0.25s ease' }}
        />
        {hasGif && !hovered && (
          <div style={{ 
            position: 'absolute', 
            bottom: 8, 
            right: 8, 
            background: 'rgba(204,0,0,0.85)', 
            borderRadius: 4, 
            padding: '2px 7px', 
            fontSize: '0.6rem', 
            fontWeight: 700, 
            color: '#fff', 
            letterSpacing: '1px', 
            backdropFilter: 'blur(4px)' 
          }}>
            GIF
          </div>
        )}
      </div>
      <div className="bar-content">
        <p className="badge">{primaryBarType}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 0 0 2px rgba(232,0,30,0.35), 0 8px 18px rgba(0,0,0,0.45)',
              background: 'rgba(10,10,10,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {imageUrl(bar.logo_path || bar.image_path) ? (
              <img
                src={imageUrl(bar.logo_path || bar.image_path)}
                alt={`${bar.name} logo`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🍸</span>
            )}
          </div>
          <h3 style={{ margin: 0 }}>{bar.name}</h3>
        </div>
        <p className="section-subtitle">{bar.city} · {bar.price_range || '$$'}</p>
        <p style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          fontSize: '0.85rem',
          lineHeight: '1.4'
        }}>{bar.description || 'Discover this bar and upcoming events.'}</p>
        <div className="bar-meta">
          <span>⭐ {bar.rating || '0.0'} ({bar.review_count || 0})</span>
          <span>{bar.follower_count || 0} followers</span>
        </div>
        <Link className="button" to={`/dashboard/bars/${bar.id}`}>View Details</Link>
      </div>
    </article>
  );
}

export default BarCard;
