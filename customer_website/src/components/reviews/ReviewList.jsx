import { formatDate } from '../../utils/dateHelpers';
import { imageUrl } from '../../utils/imageUrl';
import EmptyState from '../ui/EmptyState';

function StarRating({ rating }) {
  return (
    <span className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? 'star filled' : 'star'}>★</span>
      ))}
    </span>
  );
}

function ReviewList({ reviewData }) {
  const reviews = reviewData?.reviews || [];

  if (!reviews.length) {
    return <EmptyState title="No reviews yet" subtitle="This bar has no customer reviews yet." />;
  }

  return (
    <div className="grid">
      {reviews.map((review) => (
        <article className="card review-card" key={review.id}>
          <div className="review-header">
            <div className="review-author">
              {review.profile_picture ? (
                <img
                  src={imageUrl(review.profile_picture)}
                  alt={`${review.first_name}`}
                  className="review-avatar"
                />
              ) : (
                <div className="review-avatar-placeholder">
                  {review.first_name?.[0]}{review.last_name?.[0]}
                </div>
              )}
              <div>
                <strong>{review.first_name} {review.last_name}</strong>
                <div><StarRating rating={review.rating} /></div>
              </div>
            </div>
            <small className="text-muted">{formatDate(review.created_at)}</small>
          </div>
          <p className="review-comment">{review.comment || 'No written comment.'}</p>
          {review.reply && (
            <div className="review-reply">
              <div className="review-reply-header">
                <span className="owner-badge">Bar Owner</span>
                <strong>{review.reply_author || 'Bar Owner'}</strong>
              </div>
              <p>{review.reply}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export default ReviewList;
