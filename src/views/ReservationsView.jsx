import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useView } from '../hooks/useView';
import { useAuth } from '../hooks/useAuth';
import { VIEWS } from '../contexts/ViewContext';
import { reservationService } from '../services/reservationService';
import { paymentService } from '../services/paymentService';
import { formatDate, formatTime, fullName } from '../utils/dateHelpers';
import { CalendarDays, Clock, Utensils, BookMarked, Star, Download, Printer, CheckCircle2, MapPin, Users, CreditCard } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

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

function normalizeReservationStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'no-show' || normalized === 'no show') return 'no_show';
  if (normalized === 'checked-in' || normalized === 'checked in') return 'checked_in';
  return normalized;
}

function getReservationBadge(status, paymentStatus) {
  const normalizedStatus = normalizeReservationStatus(status);
  const normalizedPaymentStatus = String(paymentStatus || '').toLowerCase();

  const isPaid = normalizedPaymentStatus === 'paid';
  const isPartialPaid = normalizedPaymentStatus === 'partial';
  const isConfirmed = normalizedStatus === 'confirmed';
  const isApproved = normalizedStatus === 'approved';
  const isCancelled = normalizedStatus.includes('cancel');
  const isRejected = normalizedStatus === 'rejected';
  const isNoShow = normalizedStatus === 'no_show';
  const isDone = normalizedStatus === 'checked_in' || normalizedStatus === 'completed' || normalizedStatus === 'done';

  let badgeBg = '#C98A2F'; // Pending amber
  let badgeColor = '#FFFFFF';
  let badgeLabel = 'Pending';
  let badgeClass = 'pending';

  if (isNoShow) {
    badgeBg = '#52161E'; badgeLabel = 'No Show'; badgeClass = 'failed';
  } else if (isCancelled) {
    badgeBg = '#7A2430'; badgeLabel = 'Cancelled'; badgeClass = 'cancelled';
  } else if (isRejected) {
    badgeBg = '#7A2430'; badgeLabel = 'Rejected'; badgeClass = 'rejected';
  } else if (isDone) {
    badgeBg = '#2E7D4F'; badgeLabel = 'Completed'; badgeClass = 'confirmed';
  } else if (isPaid || isConfirmed) {
    badgeBg = '#2E7D4F'; badgeLabel = 'Confirmed'; badgeClass = 'confirmed';
  } else if (isApproved) {
    badgeBg = '#2563EB'; badgeLabel = 'Approved'; badgeClass = 'approved';
  } else if (isPartialPaid) {
    badgeBg = '#C98A2F'; badgeLabel = 'Partial Paid'; badgeClass = 'pending';
  }

  return {
    normalizedStatus,
    isPaid,
    isPartialPaid,
    isConfirmed,
    isApproved,
    isCancelled,
    isRejected,
    isNoShow,
    isDone,
    badgeBg,
    badgeColor,
    badgeLabel,
    badgeClass,
  };
}

function buildBookingReceiptData(reservation, customerName) {
  const { badgeLabel } = getReservationBadge(reservation.status, reservation.payment_status);
  const paidAmount = Number(reservation.payment_amount || reservation.deposit_amount || 0);
  const totalAmount = Number(reservation.total_amount || reservation.payment_amount || 0);
  const remainingBalance = Number(reservation.remaining_balance || Math.max(0, totalAmount - paidAmount));
  const items = parseOrderItems(reservation.notes || '');

  return {
    transactionNumber: reservation.transaction_number || reservation.reference_id || `RES-${reservation.id}`,
    customerName,
    barName: reservation.bar_name || '-',
    tableNumber: reservation.table_number || reservation.table_id || '-',
    floorAssignment: reservation.floor_assignment || '',
    reservationDate: formatDate(reservation.reservation_date),
    reservationTime: formatTime(reservation.reservation_time),
    guestCount: reservation.party_size || '-',
    menuItems: items,
    totalAmount,
    paidAmount,
    remainingBalance,
    reservationStatus: badgeLabel.toUpperCase(),
    bookedAt: reservation.created_at ? new Date(reservation.created_at) : null,
  };
}

async function buildReceiptPdf(receipt) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const accent = [201, 118, 47];   // #C9762F
  const dark = [26, 26, 26];
  const muted = [120, 120, 120];
  const lightGray = [200, 200, 200];
  let y = margin;

  // Helper: add text and return new y
  const text = (str, x, opts = {}) => {
    const { size = 10, color = dark, style = 'normal', maxWidth } = opts;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    if (maxWidth) {
      const lines = doc.splitTextToSize(String(str || ''), maxWidth);
      lines.forEach(line => { doc.text(line, x, y); y += size * 0.4; });
    } else {
      doc.text(String(str || ''), x, y);
      y += size * 0.4;
    }
  };

  const line = () => { y += 1; };

  // ── Header: Bar name ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...accent);
  doc.text(receipt.barName || 'ThePartyGoers', margin, y + 7);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text('RESERVATION CONFIRMATION', margin, y + 2);
  y += 6;

  // ── Dashed separator ──
  doc.setDrawColor(...lightGray);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 6;

  // ── QR Code + Transaction Number ──
  let qrY = y;
  try {
    const qrDataUrl = await QRCode.toDataURL(receipt.transactionNumber, {
      width: 200, margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', margin, qrY, 24, 24);
  } catch (_) { /* QR generation failed, continue without it */ }

  const txnX = margin + 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('TRANSACTION NUMBER', txnX, qrY + 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...accent);
  doc.text(receipt.transactionNumber, txnX, qrY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(receipt.reservationStatus, txnX, qrY + 15);

  y = qrY + 28;

  // ── Dashed separator ──
  doc.setDrawColor(...lightGray);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 6;

  // ── Section helper ──
  const section = (icon, label) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`${icon}  ${label}`, margin, y + 1);
    y += 5;
  };

  const field = (label, value, opts = {}) => {
    const { bold = false, color = dark, size = 10 } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(value || '-'), margin + 2, y + 1);
    y += 5;
  };

  // ── Table ──
  section('TABLE', 'TABLE');
  const tableLabel = `Table #${receipt.tableNumber}` + (receipt.floorAssignment ? ` · ${receipt.floorAssignment}` : '');
  field('', tableLabel, { size: 10 });
  field('', `Party of ${receipt.guestCount} guests`, { color: muted, size: 9 });
  y += 1;

  // ── Date & Time ──
  section('DATE & TIME', 'DATE & TIME');
  field('', `${receipt.reservationDate}  ·  ${receipt.reservationTime}`, { size: 10 });
  y += 1;

  // ── Guest ──
  section('GUEST', 'GUEST');
  field('', receipt.customerName, { size: 10 });
  y += 1;

  // ── Menu Items ──
  if (receipt.menuItems.length > 0) {
    section('MENU ITEMS', 'MENU ITEMS');
    receipt.menuItems.forEach(item => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...dark);
      doc.text(`•  ${item}`, margin + 2, y + 1);
      y += 4.5;
    });
    y += 1;
  }

  // ── Dashed separator ──
  doc.setDrawColor(...lightGray);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 6;

  // ── Payment Summary Box ──
  const boxH = 34;
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(margin, y, contentW, boxH, 3, 3, 'FD');

  const bx = margin + 4;
  let by = y + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text('PAYMENT SUMMARY', bx, by);
  by += 7;

  // Total Bill
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text('Total Bill', bx, by);
  doc.setFont('helvetica', 'bold');
  doc.text(`\u20B1${receipt.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - margin - 4, by, { align: 'right' });
  by += 7;

  // Paid
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  const paidLabel = receipt.remainingBalance > 0 ? 'Paid (Deposit)' : 'Paid';
  doc.text(paidLabel, bx, by);
  doc.setTextColor(34, 160, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(`\u20B1${receipt.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - margin - 4, by, { align: 'right' });
  by += 7;

  // Remaining
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (receipt.remainingBalance > 0) {
    doc.setTextColor(200, 140, 30);
    doc.text('Remaining Balance', bx, by);
    doc.setFont('helvetica', 'bold');
    doc.text(`\u20B1${receipt.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - margin - 4, by, { align: 'right' });
  } else {
    doc.setTextColor(34, 160, 94);
    doc.text('\u2714  Fully Paid', bx, by);
  }

  y += boxH + 6;

  // ── Dashed separator ──
  doc.setDrawColor(...lightGray);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 6;

  // ── Footer ──
  if (receipt.bookedAt) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    const bookedStr = `Booked on ${receipt.bookedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${receipt.bookedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    doc.text(bookedStr, margin, y + 1);
    y += 5;
  }

  if (receipt.remainingBalance > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(200, 140, 30);
    doc.text(`Please pay \u20B1${receipt.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} balance at the door`, margin, y + 1);
  }

  return doc;
}

async function downloadReceiptPdf(receipt) {
  const doc = await buildReceiptPdf(receipt);
  const txn = String(receipt.transactionNumber || 'booking').replace(/[^A-Za-z0-9-_]/g, '_');
  doc.save(`booking-receipt-${txn}.pdf`);
}

function ViewportModal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

const viewportBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(8px)',
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  overflowY: 'auto',
};

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
  const [qrDataUrl, setQrDataUrl] = useState('');
  const printRef = useRef(null);

  useEffect(() => {
    if (reservation?.transaction_number) {
      QRCode.toDataURL(reservation.transaction_number, {
        width: 120,
        margin: 1,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [reservation?.transaction_number]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!reservation) return null;
  const items = parseOrderItems(reservation.notes || '');
  const {
    isCancelled,
    isPaid,
    badgeClass,
    badgeLabel,
  } = getReservationBadge(reservation.status, reservation.payment_status);

  const total = Number(reservation.total_amount || reservation.payment_amount || 0);
  const paid = Number(reservation.payment_amount || reservation.deposit_amount || 0);
  const remaining = Number(reservation.remaining_balance || Math.max(0, total - paid));
  const hasPaymentInfo = total > 0 || paid > 0;

  return (
    <ViewportModal>
      <div className="modal-backdrop" style={viewportBackdropStyle} onClick={onClose}>
        <div className="modal-panel receipt-modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
          {/* Print-only header */}
          <div className="print-only-header" style={{ display: 'none' }}>
            <p style={{ fontSize: '0.7rem', color: '#999', marginBottom: '0.5rem' }}>Printed from ThePartyGoers</p>
          </div>

          {/* Screen header with actions */}
          <div className="modal-header no-print" style={{ borderBottom: '1px dashed rgba(255,255,255,0.12)' }}>
            <h3 className="text-h3" style={{ fontSize: '1rem' }}>Reservation Receipt</h3>
            <div className="flex gap-xs">
              <button onClick={handlePrint} className="modal-close" title="Print" style={{ fontSize: '1.1rem' }}>
                <Printer size={18} />
              </button>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
          </div>

          <div ref={printRef} className="receipt-content" style={{ padding: '1.5rem' }}>
            {/* Bar Branding */}
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--red-primary)', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em', margin: 0 }}>
                {reservation.bar_name || 'ThePartyGoers'}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Reservation Confirmation
              </p>
            </div>

            {/* Status Badge */}
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span className={`receipt-status-badge ${badgeClass}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 1rem', borderRadius: '50px',
                fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <CheckCircle2 size={15} /> {badgeLabel}
              </span>
            </div>

            {/* Dashed separator */}
            <div className="receipt-dashed-line" />

            {/* Transaction + QR */}
            {reservation.transaction_number && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1rem 0', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Code" style={{ width: '120px', height: '120px', borderRadius: '8px', flexShrink: 0, background: '#fff', padding: '6px' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
                    Transaction Number
                  </p>
                  <p style={{ fontFamily: "'Sora', monospace", fontWeight: 800, fontSize: '1.05rem', color: 'var(--red-primary)', letterSpacing: '0.04em', wordBreak: 'break-all', margin: 0 }}>
                    {reservation.transaction_number}
                  </p>
                </div>
              </div>
            )}

            {/* Dashed separator */}
            <div className="receipt-dashed-line" />

            {/* Table Info */}
            <div className="receipt-row">
              <span className="receipt-row-icon"><MapPin size={14} /></span>
              <div>
                <p className="receipt-row-label">Table</p>
                <p className="receipt-row-value">{reservation.table_number || reservation.table_id ? `Table #${reservation.table_number || reservation.table_id}` : 'Menu-only order'}</p>
                <p className="receipt-row-sub">Party of {reservation.party_size} guests</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="receipt-row">
              <span className="receipt-row-icon"><CalendarDays size={14} /></span>
              <div>
                <p className="receipt-row-label">Date & Time</p>
                <p className="receipt-row-value">{formatDate(reservation.reservation_date)}</p>
                <p className="receipt-row-sub"><Clock size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {formatTime(reservation.reservation_time)}</p>
              </div>
            </div>

            {/* Guest Name */}
            <div className="receipt-row">
              <span className="receipt-row-icon"><Users size={14} /></span>
              <div>
                <p className="receipt-row-label">Guest</p>
                <p className="receipt-row-value">{reservation.first_name} {reservation.last_name}</p>
              </div>
            </div>

            {/* Menu Items */}
            {items.length > 0 && (
              <div className="receipt-row">
                <span className="receipt-row-icon"><Utensils size={14} /></span>
                <div>
                  <p className="receipt-row-label">Menu Items</p>
                  {items.map((item, i) => (
                    <p key={i} className="receipt-row-sub" style={{ margin: '0.1rem 0' }}>• {item}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Dashed separator */}
            {hasPaymentInfo && <div className="receipt-dashed-line" />}

            {/* Payment Summary */}
            {hasPaymentInfo && (
              <div className="receipt-payment-box">
                <div className="receipt-payment-header">
                  <CreditCard size={13} /> Payment Summary
                </div>
                <div className="receipt-payment-row">
                  <span>Total Bill</span>
                  <span className="receipt-payment-amount">₱{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="receipt-payment-row paid">
                  <span>Paid{remaining > 0 ? ' (Deposit)' : ''}</span>
                  <span className="receipt-payment-amount" style={{ color: '#4ade80' }}>₱{paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {remaining > 0 && (
                  <div className="receipt-payment-row due">
                    <span>Remaining Balance (collect at door)</span>
                    <span className="receipt-payment-amount" style={{ color: '#fbbf24' }}>₱{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {remaining === 0 && (
                  <div className="receipt-payment-row due">
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>✓ Fully Paid</span>
                  </div>
                )}
              </div>
            )}

            {/* Dashed separator */}
            <div className="receipt-dashed-line" />

            {/* Footer info */}
            <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: '0.75rem 0 0' }}>
              Booked on {new Date(reservation.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' '}at {new Date(reservation.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>

            {remaining > 0 && (
              <p style={{ fontSize: '0.72rem', color: '#fbbf24', textAlign: 'center', fontWeight: 600, margin: '0.5rem 0 0' }}>
                Please pay ₱{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} balance at the door
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="receipt-actions no-print" style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-glass" style={{ flex: '1 1 0', minWidth: '100px', justifyContent: 'center' }} onClick={onClose}>
              Close
            </button>
            <button className="btn btn-red" style={{ flex: '1 1 0', minWidth: '100px', justifyContent: 'center' }} onClick={handlePrint}>
              <Printer size={14} /> Print
            </button>
            {(reservation.status || '').toLowerCase() === 'confirmed' && (
              <button className="btn btn-glass" style={{ flex: '1 1 0', minWidth: '100px', justifyContent: 'center' }} onClick={() => onDownloadReceipt(reservation)}>
                <Download size={14} /> PDF
              </button>
            )}
          </div>

          {!isCancelled && !isPaid && (
            <div className="no-print" style={{ padding: '0 1.5rem 1.5rem' }}>
              <button className="btn btn-ghost btn-sm w-full" onClick={() => onCancel(reservation.id)}>
                Cancel Reservation
              </button>
            </div>
          )}
        </div>
      </div>
    </ViewportModal>
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
  const [statusFilter, setStatusFilter] = useState('all');
  const autoOpenedReservationRef = useRef(null);
  const attemptedTargetFetchRef = useRef(new Set());

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

  const handleDownloadReceipt = async (reservation) => {
    const receipt = buildBookingReceiptData(reservation, fullName(user));
    await downloadReceiptPdf(receipt);
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

    if (!targetReservationId || !Array.isArray(reservations)) {
      return;
    }

    if (autoOpenedReservationRef.current === targetReservationId) return;

    const targetReservation = reservations.find((item) => Number(item?.id || 0) === targetReservationId);
    if (targetReservation) {
      autoOpenedReservationRef.current = targetReservationId;
      setSelected(targetReservation);
      return;
    }

    if (loading) return;
    if (attemptedTargetFetchRef.current.has(targetReservationId)) return;

    attemptedTargetFetchRef.current.add(targetReservationId);

    (async () => {
      try {
        const reservation = await reservationService.myReservationById(targetReservationId);
        if (!reservation) return;

        autoOpenedReservationRef.current = targetReservationId;
        setReservations((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          if (list.some((item) => Number(item?.id || 0) === targetReservationId)) {
            return list;
          }
          return [reservation, ...list];
        });
        setSelected(reservation);
      } catch (_) {
        // Keep current list view when target reservation cannot be retrieved.
      }
    })();
  }, [viewParams, reservations, loading]);

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

  const getFilterCategory = (reservation) => {
    const {
      isNoShow,
      isDone,
      isCancelled,
      isRejected,
    } = getReservationBadge(reservation.status, reservation.payment_status);

    if (isNoShow) return 'no_show';
    if (isDone) return 'done';
    if (isCancelled || isRejected) return 'other';

    const startTs = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`).getTime();
    if (Number.isNaN(startTs)) return 'upcoming';
    return startTs >= nowTs ? 'upcoming' : 'other';
  };

  const filterCounts = reservations.reduce((acc, reservation) => {
    const category = getFilterCategory(reservation);
    if (category === 'upcoming') acc.upcoming += 1;
    if (category === 'done') acc.done += 1;
    if (category === 'no_show') acc.no_show += 1;
    return acc;
  }, {
    all: reservations.length,
    upcoming: 0,
    done: 0,
    no_show: 0,
  });

  const filteredReservations = reservations.filter((reservation) => {
    if (statusFilter === 'all') return true;
    return getFilterCategory(reservation) === statusFilter;
  });

  const activeFilterLabel =
    statusFilter === 'upcoming' ? 'Upcoming' :
    statusFilter === 'done' ? 'Done' :
    statusFilter === 'no_show' ? 'No Show' :
    'All';

  if (loading) return <div className="loading-state" style={{ minHeight: '50vh' }}><div className="spinner" /><span>Loading reservations...</span></div>;

  return (
    <div className="flex flex-col gap-xl">
      <div className="flex justify-between items-center flex-wrap gap-md">
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#C9762F' }}>RESERVATIONS</span>
          <h1 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.8rem', fontWeight: 700, margin: '0.2rem 0 0', color: 'var(--color-text-primary)' }}>
            My Reservations
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>View, manage, and check status for your table bookings.</p>
        </div>
        <button className="btn" style={{ background: '#C9762F', color: '#fff', fontWeight: 700, borderRadius: 10 }} onClick={() => navigate(VIEWS.BARS)}>+ New Reservation</button>
      </div>

      {msg && (
        <div style={{ background: 'rgba(46,125,79,0.1)', border: '1px solid #2E7D4F', color: '#2E7D4F', padding: '0.8rem 1rem', borderRadius: 10, fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✓ {msg}</span>
          <button style={{ background: 'none', border: 'none', color: '#2E7D4F', cursor: 'pointer' }} onClick={() => setMsg('')}>✕</button>
        </div>
      )}

      {err && (
        <div style={{ background: '#7A2430', color: '#FFFFFF', padding: '0.85rem 1.1rem', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.25rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
            <span>⚠️</span>
            <span>{err}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.75rem', borderRadius: 6 }} onClick={() => { setErr(''); load(); }}>Retry</button>
            <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer' }} onClick={() => setErr('')}>✕</button>
          </div>
        </div>
      )}

      {(
        <div className="glass-card" style={{ padding: '0.9rem 1rem' }}>
          <div className="flex gap-sm flex-wrap items-center">
            <span className="text-label" style={{ marginRight: '0.35rem' }}>Filter:</span>
            {[
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'done', label: 'Done' },
              { key: 'no_show', label: 'No Show' },
              { key: 'all', label: 'All' },
            ].map(({ key, label }) => {
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  className={`btn btn-sm ${isActive ? 'btn-red' : 'btn-glass'}`}
                  style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem', borderRadius: 999 }}
                  onClick={() => setStatusFilter(key)}
                >
                  {label} ({filterCounts[key]})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {reservations.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-icon"><BookMarked size={32} /></div>
          <h3 className="text-h3">No reservations yet</h3>
          <p className="text-muted mt-sm">Browse bars and reserve a table to get started.</p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-icon"><BookMarked size={32} /></div>
          <h3 className="text-h3">No {activeFilterLabel} reservations</h3>
          <p className="text-muted mt-sm">Try another filter to view your other reservations.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {filteredReservations.map(r => {
            const {
              normalizedStatus,
              isConfirmed,
              isCancelled,
              badgeBg,
              badgeColor,
              badgeClass,
              badgeLabel,
            } = getReservationBadge(r.status, r.payment_status);

            const isCompleted = normalizedStatus === 'completed' || normalizedStatus === 'done';
            const isReviewSubmitted = Number(r.has_review) === 1;

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
                style={{ cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: '14px', background: 'var(--color-bg-card)', padding: '1.25rem' }}
                onClick={() => setSelected(r)}
              >
                <div className="res-header">
                  <div>
                    <h3 style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{r.bar_name || `Bar #${r.bar_id}`}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                      {r.table_number || r.table_id ? `Table #${r.table_number || r.table_id} · ` : r.order_type === 'takeout' ? 'Takeout · ' : r.order_type === 'dine_in' ? 'Dine-in · ' : 'Menu-only order · '}Party of {r.party_size} guests
                    </p>
                  </div>
                  <span style={{ background: badgeBg, color: badgeColor, fontSize: '0.72rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: 50, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
        <ViewportModal>
          <div className="modal-backdrop" style={viewportBackdropStyle} onClick={() => setReviewModalReservation(null)}>
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
        </ViewportModal>
      )}
    </div>
  );
}

export default ReservationsView;
