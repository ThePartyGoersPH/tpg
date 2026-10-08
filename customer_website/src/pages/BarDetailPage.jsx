import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BarMenu from '../components/bars/BarMenu';
import BarMap from '../components/bars/BarMap';
import EventCard from '../components/events/EventCard';
import ReviewList from '../components/reviews/ReviewList';
import ReviewForm from '../components/reviews/ReviewForm';
import ReservationForm from '../components/reservations/ReservationForm';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { barService } from '../services/barService';
import { reservationService } from '../services/reservationService';
import { socialService } from '../services/socialService';
import { eventService } from '../services/eventService';
import { paymentService } from '../services/paymentService';
import { formatTime } from '../utils/dateHelpers';
import { imageUrl } from '../utils/imageUrl';

function BarDetailPage() {
  const { barId } = useParams();
  const navigate = useNavigate();
  const [bar, setBar] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [reviewData, setReviewData] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [reviewEligibility, setReviewEligibility] = useState(false);
  const [tables, setTables] = useState([]);
  const [following, setFollowing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittingReservation, setSubmittingReservation] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const openingHours = useMemo(() => {
    if (!bar) return [];
    return [
      ['Monday', bar.monday_hours],
      ['Tuesday', bar.tuesday_hours],
      ['Wednesday', bar.wednesday_hours],
      ['Thursday', bar.thursday_hours],
      ['Friday', bar.friday_hours],
      ['Saturday', bar.saturday_hours],
      ['Sunday', bar.sunday_hours],
    ];
  }, [bar]);

  const loadBarDetail = async () => {
    try {
      setLoading(true);
      setError('');
      const [
        detail,
        menu,
        eventList,
        reviews,
        mine,
        eligibility,
        tableList,
        followStatus,
      ] = await Promise.all([
        barService.detail(barId),
        barService.menu(barId),
        barService.events(barId),
        barService.reviews(barId),
        barService.myReview(barId),
        barService.reviewEligibility(barId),
        barService.tables(barId),
        socialService.followStatus(barId),
      ]);

      setBar(detail);
      setMenuItems(menu);
      setEvents(eventList);
      setReviewData(reviews);
      setMyReview(mine);
      setReviewEligibility(Boolean(eligibility?.eligible));
      setTables(tableList);
      setFollowing(Boolean(followStatus?.following));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load bar details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBarDetail();
  }, [barId]);

  const handleFollowToggle = async () => {
    setMessage('');
    setError('');
    try {
      if (following) {
        const response = await socialService.unfollow(barId);
        setFollowing(response?.following || false);
      } else {
        const response = await socialService.follow(barId);
        setFollowing(response?.following || true);
      }
      setMessage('Follow status updated.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update follow status.');
    }
  };

  const handleLikeEvent = async (event) => {
    try {
      const response = await eventService.like(event.id);
      setEvents((prev) => prev.map((item) => (item.id === event.id ? { ...item, like_count: response.likeCount ?? item.like_count + 1 } : item)));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to like event.');
    }
  };

  const handleCheckTables = async ({ date, time, party_size }) => {
    try {
      const available = await barService.availableTables(barId, { date, time, party_size });
      setTables(available);
      setMessage(`Found ${available.length} available table(s).`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to check available tables.');
    }
  };

  const handleReservation = async (payload) => {
    setSubmittingReservation(true);
    setError('');
    setMessage('');

    try {
      const { payment_method, ...reservationPayload } = payload;
      const result = await reservationService.create(reservationPayload);
      const reservationId = result?.data?.id;

      if (payment_method !== 'cash' && reservationId && bar) {
        const estimatedTotal = Number(payload?.estimated_total_amount || 0);
        const depositAmount = estimatedTotal > 0 ? Number((estimatedTotal * 0.5).toFixed(2)) : (Number(bar.minimum_reservation_deposit) || 0);
        if (depositAmount > 0) {
          try {
            const paymentResult = await paymentService.createPayment({
              payment_type: 'reservation',
              related_id: reservationId,
              amount: depositAmount,
              payment_method: payment_method,
              bar_id: Number(barId),
            });
            if (paymentResult?.data?.checkout_url) {
              window.location.href = paymentResult.data.checkout_url;
              return;
            }
          } catch (payErr) {
            setError(payErr?.response?.data?.message || 'Reservation created but payment failed. You can pay later.');
            return;
          }
        }
      }

      setMessage('Reservation submitted successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Reservation failed.');
    } finally {
      setSubmittingReservation(false);
    }
  };

  const handleReviewSubmit = async (payload) => {
    setSubmittingReview(true);
    setError('');
    setMessage('');

    try {
      await barService.submitReview(barId, payload);
      setMessage('Review saved.');
      await loadBarDetail();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    setSubmittingReview(true);
    setError('');
    setMessage('');

    try {
      await barService.deleteReview(barId);
      setMessage('Review removed.');
      await loadBarDetail();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <LoadingState label="Loading bar details..." />;
  if (error && !bar) return <p className="error">{error}</p>;
  if (!bar) return <EmptyState title="Bar not found" />;

  return (
    <div className="grid">
      <section className="card">
        <img className="detail-hero" src={imageUrl(bar.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='460' viewBox='0 0 1200 460'%3E%3Crect width='1200' height='460' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='80' fill='%23333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`} alt={bar.name} />
        <div className="bar-meta" style={{ marginTop: '0.8rem' }}>
          <div>
            <p className="badge">{bar.category || 'Bar'}</p>
            <h1 className="section-title">{bar.name}</h1>
            <p className="section-subtitle">{bar.address}, {bar.city}, {bar.state}</p>
          </div>
          <button className="button" type="button" onClick={handleFollowToggle}>
            {following ? 'Unfollow' : 'Follow'}
          </button>
        </div>

        <p>{bar.description || 'No description available.'}</p>
        <p>
          ⭐ {bar.rating || '0.0'} ({bar.review_count || 0} reviews) · {bar.follower_count || 0} followers
        </p>
      </section>

      {message ? <p>{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="grid two-col">
        <div className="card">
          <h3>Operating Hours</h3>
          <div className="grid">
            {openingHours.map(([day, hours]) => (
              <div className="bar-meta" key={day}>
                <span>{day}</span>
                <span>{hours || 'Unavailable'}</span>
              </div>
            ))}
          </div>
        </div>

        <BarMap latitude={bar.latitude} longitude={bar.longitude} name={bar.name} />
      </section>

      <section>
        <h2 className="section-title">Bar Menu</h2>
        <BarMenu menuItems={menuItems} />
      </section>

      <section>
        <h2 className="section-title">Upcoming Events</h2>
        {!events.length ? (
          <EmptyState title="No upcoming events" subtitle="Check back again soon." />
        ) : (
          <div className="grid two-col" style={{ marginTop: '1rem' }}>
            {events.map((event) => (
              <EventCard key={event.id} event={event} onLike={handleLikeEvent} />
            ))}
          </div>
        )}
      </section>

      <section className="grid two-col">
        <ReservationForm
          barId={barId}
          barDetail={bar}
          tables={tables}
          events={events}
          onCheckTables={handleCheckTables}
          onSubmit={handleReservation}
          submitting={submittingReservation}
        />

        <div className="card card-muted">
          <h4>Reservation Tips</h4>
          <ul>
            <li>Pending or approved bookings block a table for 1 hour around your chosen time.</li>
            <li>Choose a party size that does not exceed table capacity.</li>
            <li>Some bars auto-approve while others use manual approval.</li>
          </ul>
          <p className="section-subtitle">Current table slots use backend conflict validation.</p>
        </div>
      </section>

      <section className="grid two-col">
        <div>
          <h2 className="section-title">Reviews</h2>
          <p className="section-subtitle">Average rating: {reviewData?.average_rating || 0} ({reviewData?.review_count || 0} total)</p>
          <ReviewList reviewData={reviewData} />
        </div>

        <ReviewForm
          myReview={myReview}
          eligible={reviewEligibility}
          submitting={submittingReview}
          onSubmit={handleReviewSubmit}
          onDelete={handleDeleteReview}
        />
      </section>

      <section className="card card-muted">
        <h4>Contact</h4>
        <p>
          {bar.phone ? `Phone: ${bar.phone}` : 'No phone listed'}
          <br />
          {bar.email ? `Email: ${bar.email}` : 'No email listed'}
          <br />
          {bar.website ? `Website: ${bar.website}` : 'No website listed'}
        </p>
        <p className="section-subtitle">Hours shown in local format, event times use {formatTime('19:00:00')} style.</p>
      </section>
    </div>
  );
}

export default BarDetailPage;
