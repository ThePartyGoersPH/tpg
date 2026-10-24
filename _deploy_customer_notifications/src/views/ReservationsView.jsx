import { useEffect, useRef, useState } from 'react';
import { useView } from '../hooks/useView';
import { useAuth } from '../hooks/useAuth';
import { VIEWS } from '../contexts/ViewContext';
import { reservationService } from '../services/reservationService';
import { paymentService } from '../services/paymentService';
import { formatDate, formatTime, fullName } from '../utils/dateHelpers';
import { CalendarDays, Clock, Utensils, BookMarked, Star, Download } from 'lucide-react';

function parseOrderItems(notes) {
  if (!notes) return [];
  const match = notes.match(/Order:\s*(.+)/i);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
}

function asMoney(value) {
  const n = Number(value || 0);
  return `PHP ${n.toFixed(2)}`;
}

function buildBookingReceiptData(reservation, customerName) {
  const paymentStatus = (reservation.payment_status || '').toLowerCase();
  const reservationStatus = (reservation.status || '').toLowerCase();
  const paidAmount = Number(reservation.payment_amount || reservation.deposit_amount || 0);
  const remainingBalance = Math.max(0, Number(reservation.remaining_balance || 0));

  return {
    title: 'Booking Confirmation Receipt',
    transactionNumber: reservation.transaction_number || reservation.reference_id || `RES-${reservation.id}`,
    customerName,
    barName: reservation.bar_name || '-',
    barAddress: reservation.bar_address || '-',
    tableNumber: reservation.table_number || reservation.table_id || '-',
    reservationDateTime: `${formatDate(reservation.reservation_date)} ${formatTime(reservation.reservation_time)}`,
    guestCount: reservation.party_size || '-',
    amountPaid: asMoney(paidAmount),
    remainingBalance: asMoney(remainingBalance),
    reservationStatus:
      paymentStatus === 'partial' ? 'PARTIALLY PAID' :
      paymentStatus === 'paid' ? 'PAID' :
      reservationStatus === 'confirmed' ? 'CONFIRMED' :
      (reservation.status || '-').toUpperCase(),
    generatedAt: new Date().toLocaleString(),
  };
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildSimplePdf(lines) {
  const content = [
    'BT',
    '/F1 16 Tf',
    '50 790 Td',
    `(${escapePdfText(lines[0] || 'Booking Confirmation Receipt')}) Tj`,
    '/F1 11 Tf',
  ];

  for (let i = 1; i < lines.length; i += 1) {
    content.push('0 -22 Td');
    content.push(`(${escapePdfText(lines[i])}) Tj`);
  }

  content.push('ET');
  const streamContent = `${content.join('\n')}\n`;
  const streamLength = streamContent.length;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}endstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function downloadReceiptPdf(receipt) {
  const lines = [
    receipt.title,
    `Generated: ${receipt.generatedAt}`,
    '',
    `Transaction Number: ${receipt.transactionNumber}`,
    `Customer Name: ${receipt.customerName}`,
    `Bar Name: ${receipt.barName}`,
    `Bar Address: ${receipt.barAddress}`,
    `Table Number: ${String(receipt.tableNumber)}`,
    `Reservation Date & Time: ${receipt.reservationDateTime}`,
    `Number of Guests: ${String(receipt.guestCount)}`,
    `Amount Paid: ${receipt.amountPaid}`,
    `Reservation Status: ${receipt.reservationStatus}`,
    ...(receipt.remainingBalance && receipt.remainingBalance !== asMoney(0)
      ? [`Remaining Balance to be Paid: ${receipt.remainingBalance}`]
      : []),
    '',
    'This is a system-generated booking receipt.',
  ];

  const pdfBlob = buildSimplePdf(lines);
  const objectUrl = URL.createObjectURL(pdfBlob);

  const txn = String(receipt.transactionNumber || 'booking').replace(/[^A-Za-z0-9-_]/g, '_');
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `booking-receipt-${txn}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function settleReservationPayment(referenceId, attempts = 5, delayMs = 1500) {
  let lastResult = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      lastResult = await paymentService.confirmPaymentByReference(referenceId);
      const status = String(lastResult?.status || '').toLowerCase();
      if (status === 'paid' || status === 'cancelled') return lastResult;
    } catch (_) {}
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return lastResult;
}

function ReservationModal({ reservation, onClose, onCancel, onDownloadReceipt }) {
  if (!reservation) return null;
  const items = parseOrderItems(reservation.notes || '');
  const isPaid = (reservation.payment_status || '').toLowerCase() === 'paid';
  const isPartialPaid = (reservation.payment_status || '').toLowerCase() === 'partial';
  const isConfirmed = (reservation.status || '').toLowerCase() === 'confirmed';
  const isApproved = (reservation.status || '').toLowerCase() === 'approved';
  const isCancelled = (reservation.status || '').toLowerCase().includes('cancel');
  const isRejected = (reservation.status || '').toLowerCase() === 'rejected';
  const isNoShow = (reservation.status || '').toLowerCase() === 'no_show';

  const badgeClass = (isPaid || isConfirmed) ? 'paid'
    : isPartialPaid ? 'approved'
    : isCancelled || isRejected || isNoShow ? 'cancelled'
    : isApproved ? 'approved'
    : 'pending';

  const badgeLabel = isPaid ? 'Paid'
    : isPartialPaid ? 'Partially Paid'
    : isConfirmed ? 'Confirmed'
    : isCancelled ? 'Cancelled'
    : isRejected ? 'Rejected'
    : isNoShow ? 'No Show'
    : isApproved ? 'Approved'
    : 'Pending';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-h3">Reservation Details</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body flex flex-col gap-md">
          {/* Transaction Number */}
          {reservation.transaction_number && (
            <div style={{ background: 'rgba(232,0,30,0.08)', border: '1px solid var(--red-primary)', borderRadius: '8px', padding: '0.6rem 1rem' }}>
              <p className="text-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>TRANSACTION NUMBER</p>
              <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--red-primary)' }}>{reservation.transaction_number}</p>
              <p className="text-dim" style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>Share this with the bar to confirm your reservation</p>
            </div>
          )}
          {/* Status */}
          <div className="flex gap-sm items-center">
            <span className={`payment-status ${badgeClass}`}>
              {badgeLabel}
            </span>
            {reservation.bar_name && <span className="badge-glass">{reservation.bar_name}</span>}
          </div>

          {/* Table info */}
          <div className="res-detail-section">
            <p className="text-label mb-sm">Table</p>
            <p className="text-body">Table #{reservation.table_number || reservation.table_id} &nbsp;·&nbsp; Party of {reservation.party_size}</p>
          </div>

          {/* Date & Time */}
          <div className="res-detail-section">
            <p className="text-label mb-sm">Date & Time</p>
            <p className="text-body" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}><CalendarDays size={14} /> {formatDate(reservation.reservation_date)} &nbsp;·&nbsp; <Clock size={14} /> {formatTime(reservation.reservation_time)}</p>
          </div>

          {/* Menu items */}
          {items.length > 0 && (
            <div className="res-detail-section">
              <p className="text-label mb-sm">Menu Items Ordered</p>
              <div className="flex flex-col gap-sm">
                {items.map((item, i) => (
                  <div key={i} className="phc-item">
                    <Utensils size={14} style={{ flexShrink: 0 }} />
                    <span className="text-body">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          {reservation.payment_amount && (
            <div className="res-detail-section">
              <p className="text-label mb-sm">Total Payment</p>
              <p className="phc-amount">₱{Number(reservation.payment_amount).toFixed(2)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
            {reservation.bar_id && (
              <button className="btn btn-glass btn-sm" onClick={() => { onClose(); }}>
                Close
              </button>
            )}
            {(reservation.status || '').toLowerCase() === 'confirmed' && (
              <button className="btn btn-glass btn-sm" onClick={() => onDownloadReceipt(reservation)}>
                <Download size={13} /> Download Receipt
              </button>
            )}
            {!isCancelled && !isPaid && (
              <button className="btn btn-ghost btn-sm" onClick={() => onCancel(reservation.id)}>
                Cancel Reservation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReservationsView() {
  const { navigate, viewParams } = useView();
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(null);
  const [recheckingId, setRecheckingId] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [reviewModalReservation, setReviewModalReservation] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const autoOpenedReservationRef = useRef(null);

  const load = async () => {
    try {
      setLoading(true); setErr('');
      const data = await reservationService.myReservations();
      const list = Array.isArray(data) ? data : [];
      setReservations(list);

      // Auto-check reservations with pending payment that are NOT already confirmed
      const pendingRefs = list
        .filter(r =>
          (r.payment_status || '').toLowerCase() === 'pending' &&
          !['confirmed', 'cancelled'].includes((r.status || '').toLowerCase()) &&
          r.reference_id
        )
        .map(r => r.reference_id);
      if (pendingRefs.length) {
        await Promise.allSettled(pendingRefs.map(ref => settleReservationPayment(ref)));
        const refreshed = await reservationService.myReservations();
        setReservations(Array.isArray(refreshed) ? refreshed : list);
      }
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load reservations.');
    } finally { setLoading(false); }
  };

  const handleOpenReview = (reservation) => {
    setReviewModalReservation(reservation);
    setReviewRating(5);
    setReviewComment('');
    setErr('');
    setMsg('');
  };

  const handleSubmitReview = async () => {
    if (!reviewModalReservation) return;

    setReviewSubmitting(true);
    setErr('');
    setMsg('');

    try {
      await reservationService.submitReview(reviewModalReservation.id, {
        rating: Number(reviewRating),
        comment: reviewComment.trim() || null,
      });
      setMsg('Review submitted. Thank you for your feedback!');
      setReviewModalReservation(null);
      await load();
    } catch (e) {
      const apiMessage = e?.response?.data?.message;
      if (apiMessage === 'You have already reviewed this booking.') {
        setErr('You have already reviewed this booking.');
      } else {
        setErr(apiMessage || 'Failed to submit review.');
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDownloadReceipt = (reservation) => {
    const receipt = buildBookingReceiptData(reservation, fullName(user));
    downloadReceiptPdf(receipt);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const targetReservationId = Number(
      viewParams?.reservationId ||
      viewParams?.notificationTarget?.reservation_id ||
      0
    );

    if (!targetReservationId || !Array.isArray(reservations) || reservations.length === 0) {
      return;
    }

    if (autoOpenedReservationRef.current === targetReservationId) return;

    const targetReservation = reservations.find((item) => Number(item?.id || 0) === targetReservationId);
    if (!targetReservation) return;

    autoOpenedReservationRef.current = targetReservationId;
    setSelected(targetReservation);
  }, [viewParams, reservations]);

  const handleCancel = async (id) => {
    if (!confirm('Cancel this reservation?')) return;
    setErr(''); setMsg('');
    try {
      await reservationService.cancel(id);
      setMsg('Reservation cancelled.');
      setSelected(null);
      load();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to cancel.');
    }
  };

  const handleRecheck = async (id) => {
    setRecheckingId(id);
    setErr(''); setMsg('');
    try {
      const result = await reservationService.recheckPayment(id);
      setMsg(result.message || 'Status rechecked.');
      load();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to recheck status.');
    } finally {
      setRecheckingId(null);
    }
  };

  const handleCheckIn = async (id) => {
    setErr(''); setMsg('');
    try {
      const result = await reservationService.checkIn(id);
      setMsg(result.message || 'Checked in successfully.');
      load();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to check in.');
    }
  };

  if (loading) return <div className="loading-state" style={{ minHeight: '50vh' }}><div className="spinner" /><span>Loading reservations...</span></div>;

  return (
    <div className="flex flex-col gap-xl">
      <div className="flex justify-between items-center flex-wrap gap-md">
        <div>
          <span className="home-eyebrow">RESERVATIONS</span>
          <h1 className="home-section-title" style={{ marginTop: '0.5rem' }}>MY <span className="home-accent">RESERVATIONS</span></h1>
          <p className="home-section-sub">Click any reservation to view full details.</p>
        </div>
        <button className="btn btn-red btn-red-pulse" onClick={() => navigate(VIEWS.BARS)}>+ New Reservation</button>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}
      {err && <div className="alert alert-err">{err}</div>}

      {reservations.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-icon"><BookMarked size={32} /></div>
          <h3 className="text-h3">No reservations yet</h3>
          <p className="text-muted mt-sm">Browse bars and reserve a table to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {reservations.map(r => {
            const isPaid = (r.payment_status || '').toLowerCase() === 'paid';
            const isPartialPaid = (r.payment_status || '').toLowerCase() === 'partial';
            const isConfirmed = (r.status || '').toLowerCase() === 'confirmed';
            const isCheckedIn = (r.status || '').toLowerCase() === 'checked_in';
            const isNoShow = (r.status || '').toLowerCase() === 'no_show';
            const isApproved = (r.status || '').toLowerCase() === 'approved';
            const isCancelled = (r.status || '').toLowerCase().includes('cancel');
            const isRejected = (r.status || '').toLowerCase() === 'rejected';
            const isCompleted = (r.status || '').toLowerCase() === 'completed';
            const isReviewSubmitted = Number(r.has_review) === 1;

            const badgeClass = (isPaid || isConfirmed || isCheckedIn) ? 'paid'
              : isPartialPaid ? 'approved'
              : isCancelled || isRejected ? 'cancelled'
              : isNoShow ? 'cancelled'
              : isApproved ? 'approved'
              : 'pending';

            const badgeLabel = isPaid ? 'Paid'
              : isPartialPaid ? 'Partially Paid'
              : (isConfirmed || isCheckedIn) ? 'Confirmed'
              : isCancelled ? 'Cancelled'
              : isRejected ? 'Rejected'
              : isNoShow ? 'No Show'
              : isApproved ? 'Approved'
              : 'Pending';

            const startDt = new Date(`${r.reservation_date}T${r.reservation_time}`);
            const graceEnd = new Date(startDt.getTime() + 30 * 60 * 1000);
            const inGraceWindow = isConfirmed && !r.checked_in_at && nowTs >= startDt.getTime() && nowTs < graceEnd.getTime();
            const remainingMs = inGraceWindow ? Math.max(0, graceEnd.getTime() - nowTs) : 0;
            const remMin = Math.floor(remainingMs / 60000);
            const remSec = Math.floor((remainingMs % 60000) / 1000);

            return (
              <div
                className="glass-card res-card"
                key={r.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(r)}
              >
                <div className="res-header">
                  <div>
                    <h3 className="text-h3">{r.bar_name || `Bar #${r.bar_id}`}</h3>
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                      Table #{r.table_number || r.table_id} · Party of {r.party_size}
                    </p>
                  </div>
                  <span className={`payment-status ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                </div>
                <div className="flex gap-lg mt-sm flex-wrap">
                  <span className="text-body" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><CalendarDays size={13} /> {formatDate(r.reservation_date)}</span>
                  <span className="text-body" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Clock size={13} /> {formatTime(r.reservation_time)}</span>
                </div>
                {inGraceWindow && (
                  <div className="alert alert-info mt-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>
                      Grace period: <strong>{String(remMin).padStart(2, '0')}:{String(remSec).padStart(2, '0')}</strong> remaining
                    </span>
                    <button
                      className="btn btn-red btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleCheckIn(r.id); }}
                    >
                      Check In
                    </button>
                  </div>
                )}
                {r.transaction_number && (
                  <p className="text-muted mt-sm" style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>#{r.transaction_number}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                  <p className="text-dim" style={{ fontSize: '0.75rem', margin: 0 }}>Tap to view full details →</p>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isCompleted && !isReviewSubmitted && (
                      <button
                        className="btn btn-red btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: 6 }}
                        onClick={(e) => { e.stopPropagation(); handleOpenReview(r); }}
                      >
                        Leave a Review
                      </button>
                    )}
                    {isCompleted && isReviewSubmitted && (
                      <span className="badge-glass" style={{ fontSize: '0.72rem' }}>
                        Review submitted
                      </span>
                    )}
                    {isConfirmed && (
                      <button
                        className="btn btn-glass btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: 6 }}
                        onClick={(e) => { e.stopPropagation(); handleDownloadReceipt(r); }}
                      >
                        Download Receipt
                      </button>
                    )}
                    {isCancelled && (
                      <button
                        className="btn btn-glass"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: 6, opacity: recheckingId === r.id ? 0.6 : 1 }}
                        disabled={recheckingId === r.id}
                        onClick={(e) => { e.stopPropagation(); handleRecheck(r.id); }}
                      >
                        {recheckingId === r.id ? 'Checking…' : 'Recheck Status'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <ReservationModal
          reservation={selected}
          onClose={() => setSelected(null)}
          onCancel={handleCancel}
          onDownloadReceipt={handleDownloadReceipt}
        />
      )}

      {reviewModalReservation && (
        <div className="modal-backdrop" onClick={() => setReviewModalReservation(null)}>
          <div className="modal-panel" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-h3">Leave a Review</h3>
              <button className="modal-close" onClick={() => setReviewModalReservation(null)}>✕</button>
            </div>

            <div className="modal-body flex flex-col gap-md">
              <div className="res-detail-section">
                <p className="text-label mb-sm">Booking</p>
                <p className="text-body">{reviewModalReservation.bar_name} · Table #{reviewModalReservation.table_number || reviewModalReservation.table_id}</p>
                <p className="text-dim" style={{ fontSize: '0.78rem' }}>{formatDate(reviewModalReservation.reservation_date)} · {formatTime(reviewModalReservation.reservation_time)}</p>
              </div>

              <div>
                <p className="text-label mb-sm">Star Rating</p>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="btn btn-glass btn-sm"
                      onClick={() => setReviewRating(star)}
                      style={{
                        borderColor: reviewRating === star ? 'var(--red-primary)' : undefined,
                        color: reviewRating >= star ? '#fbbf24' : undefined,
                        minWidth: 48,
                      }}
                    >
                      <Star size={13} fill={reviewRating >= star ? 'currentColor' : 'none'} /> {star}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-label mb-sm">Comment (Optional)</p>
                <textarea
                  className="textarea"
                  rows={4}
                  maxLength={1000}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience..."
                />
              </div>

              <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-glass btn-sm" onClick={() => setReviewModalReservation(null)} disabled={reviewSubmitting}>
                  Cancel
                </button>
                <button className="btn btn-red btn-sm" onClick={handleSubmitReview} disabled={reviewSubmitting}>
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReservationsView;
