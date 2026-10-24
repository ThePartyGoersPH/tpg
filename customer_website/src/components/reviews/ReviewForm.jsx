import { useEffect, useState } from 'react';

function ReviewForm({ myReview, eligible, onSubmit, onDelete, submitting }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    setRating(myReview?.rating || 5);
    setComment(myReview?.comment || '');
  }, [myReview]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ rating: Number(rating), comment: comment.trim() });
  };

  if (!eligible && !myReview) {
    return (
      <div className="card card-muted">
        You can review this bar after completing or getting an approved reservation.
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h4>{myReview ? 'Update your review' : 'Write a review'}</h4>
      <div className="inline-form">
        <select className="select" value={rating} onChange={(e) => setRating(e.target.value)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} Star{value > 1 ? 's' : ''}
            </option>
          ))}
        </select>
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : myReview ? 'Update Review' : 'Submit Review'}
        </button>
      </div>

      <textarea
        className="textarea"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience"
      />

      {myReview ? (
        <button className="button ghost" type="button" onClick={onDelete} disabled={submitting}>
          Delete Review
        </button>
      ) : null}
    </form>
  );
}

export default ReviewForm;
