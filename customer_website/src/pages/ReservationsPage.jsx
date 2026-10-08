import { useState } from 'react';
import ReservationList from '../components/reservations/ReservationList';
import LoadingState from '../components/ui/LoadingState';
import { useReservations } from '../hooks/useReservations';
import { reservationService } from '../services/reservationService';

function ReservationsPage() {
  const { reservations, loading, error, reload } = useReservations();
  const [message, setMessage] = useState('');

  const handleCancel = async (reservationId) => {
    setMessage('');
    await reservationService.cancel(reservationId);
    setMessage('Reservation cancelled.');
    reload();
  };

  return (
    <div className="grid">
      <section>
        <h1 className="section-title">My Reservations</h1>
        <p className="section-subtitle">Review your reservation history and active bookings.</p>
      </section>

      {loading ? <LoadingState label="Loading reservations..." /> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      {!loading ? <ReservationList reservations={reservations} onCancel={handleCancel} /> : null}
    </div>
  );
}

export default ReservationsPage;
