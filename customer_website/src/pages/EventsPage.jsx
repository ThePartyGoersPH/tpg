import { useEffect, useState } from 'react';
import UnifiedFeedCard from '../components/social/UnifiedFeedCard';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { socialService } from '../services/socialService';
import { eventService } from '../services/eventService';

function EventsPage() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadFeed() {
      try {
        setLoading(true);
        const data = await socialService.getUnifiedFeed(50);
        setFeed(data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load social feed.');
      } finally {
        setLoading(false);
      }
    }

    loadFeed();
  }, []);

  const handleLike = async (item) => {
    try {
      if (item.feed_type === 'event') {
        const response = await eventService.like(item.id);
        setFeed((prev) =>
          prev.map((feedItem) =>
            feedItem.id === item.id && feedItem.feed_type === 'event'
              ? { ...feedItem, like_count: response.likeCount, user_liked: response.liked }
              : feedItem
          )
        );
      } else {
        const response = await socialService.likePost(item.id);
        setFeed((prev) =>
          prev.map((feedItem) =>
            feedItem.id === item.id && feedItem.feed_type === 'post'
              ? { ...feedItem, like_count: response.likeCount, user_liked: response.liked }
              : feedItem
          )
        );
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to like this item.');
    }
  };

  const handleComment = async (item) => {
    const comment = prompt(`Comment on this ${item.feed_type}:`);
    if (!comment) return;

    try {
      if (item.feed_type === 'event') {
        await eventService.postComment(item.id, { comment });
      } else {
        await socialService.commentOnPost(item.id, comment);
      }
      
      setFeed((prev) =>
        prev.map((feedItem) =>
          feedItem.id === item.id && feedItem.feed_type === item.feed_type
            ? { ...feedItem, comment_count: feedItem.comment_count + 1 }
            : feedItem
        )
      );
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to comment.');
    }
  };

  if (loading) return <LoadingState label="Loading social feed..." />;

  return (
    <div className="grid">
      <section>
        <h1 className="section-title">Social Feed</h1>
        <p className="section-subtitle">Discover events and posts from bars in Cavite.</p>
      </section>

      {error && <p className="error">{error}</p>}

      {!feed.length ? (
        <EmptyState title="No posts or events yet" subtitle="Check back later for updates from bars." />
      ) : (
        <div className="feed-container">
          {feed.map((item) => (
            <UnifiedFeedCard
              key={`${item.feed_type}-${item.id}`}
              item={item}
              onLike={handleLike}
              onComment={handleComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default EventsPage;
