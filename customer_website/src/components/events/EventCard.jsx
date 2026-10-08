import { imageUrl } from '../../utils/imageUrl';
import { formatDate, formatTime } from '../../utils/dateHelpers';

function EventCard({ event, onLike }) {
  return (
    <article className="card event-card">
      <img className="event-thumb" src={imageUrl(event.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='380' viewBox='0 0 720 380'%3E%3Crect width='720' height='380' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='64' fill='%23333'%3E%F0%9F%8E%89%3C/text%3E%3C/svg%3E`} alt={event.title} />
      <h3>{event.title}</h3>
      <p className="section-subtitle">{formatDate(event.event_date)} · {formatTime(event.start_time)} - {formatTime(event.end_time)}</p>
      <div style={{ margin: '0.4rem 0' }}>
        {Number(event.entry_price || 0) > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(204,0,0,0.15)', color: '#f87171', borderRadius: '12px', border: '1px solid rgba(204,0,0,0.25)' }}>🎟 ₱{Number(event.entry_price).toLocaleString()} entrance</span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(74,222,128,0.1)', color: '#4ade80', borderRadius: '12px', border: '1px solid rgba(74,222,128,0.2)' }}>FREE</span>
        )}
      </div>
      <p>{event.description || 'No description available.'}</p>
      <div className="event-meta">
        <span>{event.like_count || 0} likes</span>
        <span>{event.comment_count || 0} comments</span>
      </div>
      <button className="button" type="button" onClick={() => onLike(event)}>
        Like Event
      </button>
    </article>
  );
}

export default EventCard;
