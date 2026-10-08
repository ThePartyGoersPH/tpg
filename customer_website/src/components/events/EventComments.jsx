import { useState } from 'react';
import EmptyState from '../ui/EmptyState';

function EventComments({ comments, onSubmit }) {
  const [comment, setComment] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    await onSubmit(comment.trim());
    setComment('');
  };

  return (
    <div className="card">
      <h4>Comments</h4>
      {!comments.length ? (
        <EmptyState title="No comments yet" subtitle="Be the first to leave a comment." />
      ) : (
        <div className="comment-list">
          {comments.map((item) => (
            <div className="comment-item" key={item.id}>
              <strong>{item.first_name} {item.last_name}</strong>
              <p>{item.comment}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="inline-form">
        <input className="input" placeholder="Write a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        <button className="button" type="submit">Post</button>
      </form>
    </div>
  );
}

export default EventComments;
