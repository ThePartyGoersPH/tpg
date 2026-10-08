import { formatDate, formatTime } from '../../utils/dateHelpers';
import EmptyState from '../ui/EmptyState';

function ReservationList({ reservations, onCancel }) {
  if (!reservations.length) {
    return <EmptyState title="No reservations yet" subtitle="Book your first table from a bar detail page." />;
  }

  const canCancel = (reservation) => {
    if (reservation.payment_status === 'paid') return false;
    return reservation.status === 'pending' || reservation.status === 'approved';
  };

  return (
    <div className="grid">
      {reservations.map((reservation) => (
        <article className="card" key={reservation.id}>
          <div className="bar-meta">
            <h4 style={{ margin: 0 }}>
              {reservation.bar_name}
              {reservation.payment_status && (
                <span className={`reservation-payment-status ${reservation.payment_status}`}>
                  {reservation.payment_status === 'paid' ? '💳 Paid' :
                   reservation.payment_status === 'pending' ? '⏳ Payment Pending' :
                   reservation.payment_status === 'cancelled' ? '✕ Payment Cancelled' :
                   reservation.payment_status === 'failed' ? '✕ Payment Cancelled' :
                   reservation.payment_status}
                </span>
              )}
            </h4>
            <span className={`status ${reservation.status}`}>{reservation.status}</span>
          </div>
          <p>Table {reservation.table_number} · Party of {reservation.party_size}</p>
          <p className="section-subtitle">
            {formatDate(reservation.reservation_date)} at {formatTime(reservation.reservation_time)}
          </p>
          {reservation.payment_method && (
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>
              Payment: {reservation.payment_method === 'gcash' ? 'GCash' :
                        reservation.payment_method === 'paymaya' ? 'PayMaya' :
                        reservation.payment_method === 'cash' ? 'Cash (on arrival)' :
                        reservation.payment_method}
              {reservation.deposit_amount ? ` · ₱${Number(reservation.deposit_amount).toFixed(2)}` : ''}
            </p>
          )}
          {canCancel(reservation) ? (
            <button className="button ghost" type="button" onClick={() => onCancel(reservation.id)}>
              Cancel Reservation
            </button>
          ) : null}
          {reservation.payment_status === 'paid' && (reservation.status === 'pending' || reservation.status === 'approved') && (
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Cannot cancel paid reservation (non-refundable policy)
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

export default ReservationList;
