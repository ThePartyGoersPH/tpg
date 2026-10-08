import { useState } from 'react';
import PropTypes from 'prop-types';
import { imageUrl } from '../../utils/imageUrl';

function UnifiedFeedCard({ item, onLike, onComment }) {
  const [showComments, setShowComments] = useState(false);

  const isEvent = item.feed_type === 'event';
  const displayImage = item.image_path || item.post_image_path || item.image_url || item.bar_image;

  return (
    <div className="feed-card">
      <div className="feed-card-header">
        <div className="feed-bar-info">
          {item.bar_logo && (
            <img src={imageUrl(item.bar_logo)} alt={item.bar_name} className="feed-bar-logo" />
          )}
          <div>
            <h3 className="feed-bar-name">{item.bar_name}</h3>
            <p className="feed-time">{item.time_ago}</p>
          </div>
        </div>
        <span className="feed-type-badge">{isEvent ? 'Event' : 'Post'}</span>
      </div>

      <div className="feed-card-content">
        {isEvent && item.title && <h2 className="feed-title">{item.title}</h2>}
        {item.description && <p className="feed-description">{item.description}</p>}
        
        {isEvent && (
          <div className="feed-event-details">
            <div className="event-detail-item">
              <span className="detail-label">📅 Date:</span>
              <span>{new Date(item.event_date).toLocaleDateString()}</span>
            </div>
            {item.start_time && (
              <div className="event-detail-item">
                <span className="detail-label">🕐 Time:</span>
                <span>{item.start_time} - {item.end_time}</span>
              </div>
            )}
            {item.entry_price > 0 && (
              <div className="event-detail-item">
                <span className="detail-label">💰 Entry:</span>
                <span>₱{Number(item.entry_price).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {displayImage && (
          <img 
            src={imageUrl(displayImage)} 
            alt={isEvent ? item.title : 'Post'} 
            className="feed-image" 
          />
        )}
      </div>

      <div className="feed-card-stats">
        <span>{item.like_count} {item.like_count === 1 ? 'like' : 'likes'}</span>
        <span>{item.comment_count} {item.comment_count === 1 ? 'comment' : 'comments'}</span>
      </div>

      <div className="feed-card-actions">
        <button 
          className={`feed-action-btn ${item.user_liked ? 'liked' : ''}`}
          onClick={() => onLike(item)}
          type="button"
        >
          {item.user_liked ? '❤️' : '🤍'} Like
        </button>
        <button 
          className="feed-action-btn"
          onClick={() => setShowComments(!showComments)}
          type="button"
        >
          💬 Comment
        </button>
      </div>

      {showComments && (
        <div className="feed-comments-section">
          <button 
            className="button outline small"
            onClick={() => onComment(item)}
            type="button"
          >
            View All Comments
          </button>
        </div>
      )}
    </div>
  );
}

UnifiedFeedCard.propTypes = {
  item: PropTypes.object.isRequired,
  onLike: PropTypes.func.isRequired,
  onComment: PropTypes.func.isRequired,
};

export default UnifiedFeedCard;
