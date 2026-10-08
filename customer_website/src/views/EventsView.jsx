import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { useView } from '../hooks/useView';
import { barService } from '../services/barService';
import { eventService } from '../services/eventService';
import { socialService } from '../services/socialService';
import { reservationService } from '../services/reservationService';
import { paymentService } from '../services/paymentService';
import { imageUrl } from '../utils/imageUrl';
import { formatDate, formatTime, timeAgo } from '../utils/dateHelpers';
import { Clock, Heart, MessageCircle, PartyPopper, Flag } from 'lucide-react';
import { LeftSidebar, RightSidebar } from '../components/feed/FeedSidebar';

function buildCommentTree(flat) {
  const map = {};
  const roots = [];
  flat.forEach(c => { map[c.id] = { ...c, replies: [] }; });
  flat.forEach(c => {
    const pid = c.parent_id || c.parent_comment_id;
    if (pid && map[pid]) map[pid].replies.push(map[c.id]);
    else roots.push(map[c.id]);
  });
  return roots;
}

function Avatar({ user, size = 36 }) {
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || '?';
  const defaultAvatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'%3E%3Ccircle cx='${size/2}' cy='${size/2}' r='${size/2}' fill='%23CC0000'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='${size * 0.4}' font-weight='700' fill='%23fff'%3E${initials}%3C/text%3E%3C/svg%3E`;
  
  if (user?.profile_picture) {
    return (
      <img 
        src={imageUrl(user.profile_picture)} 
        alt={initials} 
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} 
        onError={(e) => { e.target.src = defaultAvatar; }}
      />
    );
  }
  return <img src={defaultAvatar} alt={initials} style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />;
}

function BarAvatar({ event, size = 22 }) {
  const src = event?.bar_logo || event?.bar_icon || event?.logo_path || event?.bar_image || '';
  const initial = (event?.bar_name?.[0] || 'B').toUpperCase();

  if (src) {
    return (
      <img
        src={imageUrl(src)}
        alt={event?.bar_name || 'Bar'}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid rgba(232,0,30,0.4)',
          flexShrink: 0,
        }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(232,0,30,0.14)',
        color: 'var(--red-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '0.65rem',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

const parseEventClockToMinutes = (token) => {
  if (!token) return null;
  const cleaned = String(token).trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hh = Number(match[1]);
  const mm = Number(match[2] || 0);
  const meridiem = match[4] ? match[4].toLowerCase() : null;
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm < 0 || mm > 59) return null;

  if (meridiem) {
    if (hh < 1 || hh > 12) return null;
    if (meridiem === 'am' && hh === 12) hh = 0;
    if (meridiem === 'pm' && hh !== 12) hh += 12;
  }

  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm;
};

const normalizeDateLikeToYmd = (rawDate) => {
  if (!rawDate) return null;
  const str = String(rawDate).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toOnTheHourTime = (minutes) => {
  if (!Number.isFinite(minutes)) return null;
  const hour = Math.floor(minutes / 60);
  if (hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:00:00`;
};

const getEventWindow = (event) => {
  if (!event) return null;

  const eventDate = normalizeDateLikeToYmd(event?.event_date || event?.eventDate);
  if (!eventDate) return null;

  const startRaw = event?.start_time || event?.startTime;
  const endRaw = event?.end_time || event?.endTime;
  const startMinutes = parseEventClockToMinutes(startRaw);
  const endMinutes = parseEventClockToMinutes(endRaw);

  const baseDate = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return null;

  const startsAt = new Date(baseDate);
  if (startMinutes !== null) {
    startsAt.setMinutes(startMinutes, 0, 0);
  } else {
    startsAt.setHours(0, 0, 0, 0);
  }

  const endsAt = new Date(baseDate);
  if (endMinutes !== null) {
    endsAt.setMinutes(endMinutes, 0, 0);
  } else {
    endsAt.setHours(23, 59, 59, 999);
  }

  // Cross-midnight events (e.g. 8PM to 4AM) should end the following day.
  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt.setDate(endsAt.getDate() + 1);
  }

  return { startsAt, endsAt };
};

const getEventLifecycleStatus = (event, now = new Date()) => {
  const window = getEventWindow(event);
  if (!window) return 'upcoming';

  if (now.getTime() >= window.endsAt.getTime()) return 'done';
  if (now.getTime() >= window.startsAt.getTime()) return 'ongoing';
  return 'upcoming';
};

// ═══════════════════════════════════════════
// FEATURE 1: Report Modal
// ═══════════════════════════════════════════
const REPORT_REASONS = [
  'Spam or advertisement',
  'Offensive or inappropriate',
  'Harassment or bullying',
  'False information',
  'Other',
];

function ReportModal({ open, onClose, commentId, commentType }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await socialService.reportComment(commentId, { reason, details: details.trim() || undefined, comment_type: commentType });
      setResult('success');
    } catch (err) {
      if (err?.response?.status === 409) {
        setResult('duplicate');
      } else {
        setResult('error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason(''); setDetails(''); setResult(null);
    onClose(result === 'success');
  };

  const modalUi = (
    <div className="notif-panel-backdrop" onClick={handleClose} style={{ zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'min(12vh, 5rem) 1rem 2rem', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#111111', borderRadius: '12px', padding: '1.5rem', maxWidth: '420px', width: 'min(420px, 100%)',
        margin: 0, boxShadow: '0 0 30px rgba(204,0,0,0.25), 0 8px 32px rgba(0,0,0,0.6)',
        border: '1px solid rgba(204,0,0,0.2)',
        maxHeight: 'calc(100vh - 4rem)',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>🚩 Report Comment</h3>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {result === 'success' ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ color: '#4ade80', fontWeight: 600, marginBottom: '0.5rem' }}>Report submitted.</p>
            <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Thank you for helping keep the community safe.</p>
            <button className="btn btn-glass btn-sm" onClick={handleClose} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        ) : result === 'duplicate' ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ color: '#f59e0b', fontWeight: 600 }}>You have already reported this comment.</p>
            <button className="btn btn-glass btn-sm" onClick={handleClose} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        ) : (
          <>
            <p style={{ color: '#ccc', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Why are you reporting this comment?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
              {REPORT_REASONS.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: '8px', background: reason === r ? 'rgba(204,0,0,0.15)' : 'transparent', border: reason === r ? '1px solid rgba(204,0,0,0.4)' : '1px solid transparent', transition: 'all 0.15s', userSelect: 'none' }}>
                  <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: '#CC0000' }} />
                  <span style={{ color: '#ddd', fontSize: '0.85rem' }}>{r}</span>
                </label>
              ))}
            </div>
            <textarea
              placeholder="Additional details (optional)"
              maxLength={200}
              value={details}
              onChange={e => setDetails(e.target.value)}
              style={{ width: '100%', minHeight: '60px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#ddd', padding: '0.5rem 0.75rem', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-glass btn-sm" onClick={handleClose}>Cancel</button>
              <button className="btn btn-red btn-sm" onClick={handleSubmit} disabled={!reason || submitting}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalUi, document.body);
}

// ═══════════════════════════════════════════
// FEATURE 1: Report Flag Button
// ═══════════════════════════════════════════
function ReportFlag({ commentId, commentType, commentUserId, currentUserId, onReported }) {
  const [reported, setReported] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Don't show on own comments
  if (!currentUserId || commentUserId === currentUserId) return null;

  const handleClick = () => {
    if (reported) return;
    setModalOpen(true);
  };

  const handleClose = (wasSuccess) => {
    setModalOpen(false);
    if (wasSuccess) {
      setReported(true);
      if (onReported) onReported();
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        title={reported ? 'You have already reported this comment' : 'Report comment'}
        style={{
          background: 'none', border: 'none', cursor: reported ? 'default' : 'pointer',
          color: reported ? '#ef4444' : '#888888', fontSize: '0.85rem', padding: '0.15rem 0.3rem',
          transition: 'color 0.15s', lineHeight: 1, flexShrink: 0,
        }}
        onMouseEnter={e => { if (!reported) e.currentTarget.style.color = '#ef4444'; }}
        onMouseLeave={e => { if (!reported) e.currentTarget.style.color = '#888888'; }}
      >
        <Flag size={13} fill={reported ? 'currentColor' : 'none'} />
      </button>
      <ReportModal open={modalOpen} onClose={handleClose} commentId={commentId} commentType={commentType} />
    </>
  );
}

function CommentThread({ comments, eventId, postId, isEvent, depth = 0, rootParentId = null, onReplyPosted, barName, currentUserId, commentDomPrefix = '' }) {
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);

  const directReplyDepth = depth === 1;

  const resolveRootParentId = useCallback((comment) => {
    const candidate = Number(
      rootParentId ||
      comment?.root_parent_id ||
      comment?.root_comment_id ||
      comment?.parent_comment_id ||
      comment?.parent_id ||
      comment?.id
    );

    if (Number.isFinite(candidate) && candidate > 0) return candidate;
    return Number(comment?.id || 0);
  }, [rootParentId]);

  const handleReply = async (e, parentId) => {
    e.preventDefault();
    const targetParentId = Number(parentId || 0);
    if (!replyText.trim() || !targetParentId) return;
    setPosting(true);
    try {
      if (isEvent) {
        await eventService.postComment(eventId, { comment: replyText.trim(), parent_comment_id: targetParentId });
      } else {
        await socialService.commentOnPost(postId, replyText.trim(), targetParentId);
      }
      setReplyText(''); setReplyingTo(null);
      onReplyPosted();
    } catch (_) {} finally { setPosting(false); }
  };

  const getCommentType = (c, d) => {
    if (isEvent) return d > 0 ? 'event_reply' : 'event_comment';
    // Post replies in this feed are persisted in bar_post_comments with parent_comment_id.
    return 'post_comment';
  };

  return (
    <div style={{ marginLeft: directReplyDepth ? '40px' : '0px' }}>
      {comments.map(c => (
        <div
          key={c.id}
          id={commentDomPrefix ? `${commentDomPrefix}${c.id}` : undefined}
          className={`tweet-comment ${depth === 1 ? 'tweet-reply' : ''} ${depth >= 2 ? 'tweet-reply-capped' : ''}`}
          data-comment-depth={depth}
        >
          <div className="tweet-comment-inner">
            <Avatar user={c} size={depth > 0 ? 28 : 36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tweet-comment-meta" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                <span className="tweet-comment-author">{c.first_name || c.user_name?.split(' ')[0]} {c.last_name || c.user_name?.split(' ').slice(1).join(' ') || ''}</span>
                {c.is_bar_owner && (
                  <span style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.5rem',
                    marginLeft: '0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    color: '#fff',
                    background: '#dc2626',
                    borderRadius: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {barName ? `${barName} Owner` : 'Official Reply'}
                  </span>
                )}
                <span className="tweet-comment-time">{timeAgo(c.created_at)}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <ReportFlag
                    commentId={c.id}
                    commentType={getCommentType(c, depth)}
                    commentUserId={c.user_id}
                    currentUserId={currentUserId}
                  />
                </span>
              </div>
              <p className="tweet-comment-text">{c.comment || c.reply}</p>
              <button className="tweet-reply-btn" onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}>
                ↩ Reply
              </button>
              {replyingTo === c.id && (
                <form className="tweet-reply-form" onSubmit={e => handleReply(e, depth === 0 ? c.id : resolveRootParentId(c))}>
                  <input
                    className="glass-input"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                    placeholder={`Reply to ${c.first_name || 'user'}...`}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    autoFocus
                  />
                  <button className="btn btn-red btn-sm" type="submit" disabled={posting}>
                    {posting ? '...' : 'Post'}
                  </button>
                </form>
              )}
            </div>
          </div>
          {c.replies?.length > 0 && (
            <CommentThread
              comments={c.replies}
              eventId={eventId}
              postId={postId}
              isEvent={isEvent}
              depth={depth + 1}
              rootParentId={resolveRootParentId(c)}
              onReplyPosted={onReplyPosted}
              barName={barName}
              currentUserId={currentUserId}
              commentDomPrefix={commentDomPrefix}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// FEATURE 2: Event Table Reservation Section
// ═══════════════════════════════════════════
function EventTableReservation({ eventId, entryPrice }) {
  const [tables, setTables] = useState([]);
  const [eventMeta, setEventMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [partySize, setPartySize] = useState(2);
  const [reserving, setReserving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [selectedMenuItems, setSelectedMenuItems] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const res = await socialService.getEventTables(eventId);
        setTables(res?.data || []);
        setEventMeta(res?.event || null);
      } catch (_) {
        setTables([]);
      } finally { setLoading(false); }
    })();
  }, [eventId]);

  const loadMenu = async (barId) => {
    setLoadingMenu(true);
    try {
      const items = await barService.menu(barId);
      setMenuItems(items || []);
    } catch (_) {
      setMenuItems([]);
    } finally { setLoadingMenu(false); }
  };

  const handleMenuItemQuantityChange = (itemId, quantity) => {
    setSelectedMenuItems(prev => {
      if (quantity <= 0) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }
      return { ...prev, [itemId]: quantity };
    });
  };

  if (loading) return <div className="loading-state" style={{ padding: '1rem 0' }}><div className="spinner" /><span>Loading tables...</span></div>;
  if (!eventMeta || tables.length === 0) return null;

  const eventStatus = getEventLifecycleStatus(eventMeta);
  const reservationLocked = eventStatus !== 'upcoming';
  const reservationLockMsg = eventStatus === 'ongoing'
    ? 'This event is currently ongoing. Table reservations are closed.'
    : 'This event is already done. Table reservations are closed.';

  const fee = Number(entryPrice || eventMeta.entry_price || 0);
  const selectedTableData = tables.find(t => t.id === selectedTable);
  const tablePrice = Number(selectedTableData?.price || 0);
  const entranceTotal = fee * partySize;
  const menuTotal = Object.entries(selectedMenuItems).reduce((sum, [itemId, quantity]) => {
    const item = menuItems.find(m => m.id === Number(itemId));
    return sum + (Number(quantity) * Number(item?.selling_price || 0));
  }, 0);
  const grandTotal = tablePrice + entranceTotal + menuTotal;

  const handleReserve = async () => {
    if (!selectedTable) return;

    if (reservationLocked) {
      setMsg(reservationLockMsg);
      setMsgType('error');
      return;
    }

    const eventDate = normalizeDateLikeToYmd(eventMeta.event_date);
    const startMinutes = parseEventClockToMinutes(eventMeta.start_time);
    const reservationTime = toOnTheHourTime(startMinutes);

    if (!eventDate || !reservationTime) {
      setMsg('This event has an invalid date/time setup. Please contact the bar.');
      setMsgType('error');
      return;
    }

    setReserving(true); setMsg('');
    try {
      const menuItemsArray = Object.entries(selectedMenuItems).map(([itemId, quantity]) => {
        const item = menuItems.find(m => m.id === Number(itemId));
        return {
          menu_item_id: Number(itemId),
          quantity: Number(quantity),
          unit_price: Number(item?.selling_price || 0)
        };
      });

      const reservationResponse = await reservationService.create({
        bar_id: eventMeta.bar_id,
        table_id: selectedTable,
        event_id: eventId,
        reservation_date: eventDate,
        reservation_time: reservationTime,
        party_size: partySize,
        notes: `Event reservation`,
        menu_items: menuItemsArray.length > 0 ? menuItemsArray : undefined,
      });

      const reservationId = reservationResponse?.data?.id;
      if (!reservationId) {
        throw new Error('Failed to get reservation ID');
      }

      const selectedTableData = tables.find(t => t.id === selectedTable);
      const tablePrice = Number(selectedTableData?.price || 0);
      const entranceTotal = fee * partySize;
      const menuTotal = menuItemsArray.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const totalAmount = tablePrice + entranceTotal + menuTotal;

      console.log('Creating payment with amount:', totalAmount);
      
      const paymentResponse = await paymentService.createPayment({
        payment_type: 'reservation',
        related_id: reservationId,
        amount: totalAmount,
        payment_method: 'gcash',
        bar_id: eventMeta.bar_id
      });

      console.log('Full Payment Response:', paymentResponse);
      
      const checkoutUrl = paymentResponse?.data?.checkout_url || paymentResponse?.checkout_url;
      
      if (checkoutUrl) {
        console.log('Redirecting to:', checkoutUrl);
        // Save current view state before redirecting
        try {
          sessionStorage.setItem('lastViewState', JSON.stringify({ view: 'events', params: {} }));
          sessionStorage.setItem('pendingReservation', reservationId.toString());
        } catch (e) {
          console.warn('Failed to save view state:', e);
        }
        // Use window.location.assign for better browser history handling
        window.location.assign(checkoutUrl);
      } else {
        const errorMsg = paymentResponse?.message || 'Payment checkout URL not available. Please check Paymongo configuration.';
        setMsg(`Reservation created! ${errorMsg}`);
        setMsgType('error');
        console.error('No checkout URL in response:', paymentResponse);
      }
    } catch (err) {
      console.error('Payment creation error:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to create reservation or payment.';
      setMsg(errorMessage);
      setMsgType('error');
    } finally { setReserving(false); }
  };

  return (
    <div style={{
      marginTop: '1rem', padding: '1rem', background: 'rgba(204,0,0,0.05)',
      border: '1px solid rgba(204,0,0,0.15)', borderRadius: '10px',
    }}>
      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        🪑 RESERVE A TABLE FOR THIS EVENT
      </h4>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#bbb', marginBottom: '0.75rem' }}>
        <span><strong style={{ color: '#ddd' }}>Date:</strong> {formatDate(eventMeta.event_date)}</span>
        <span><strong style={{ color: '#ddd' }}>Time:</strong> {formatTime(eventMeta.start_time)}{eventMeta.end_time ? ` - ${formatTime(eventMeta.end_time)}` : ''}</span>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.82rem', color: '#ccc', fontWeight: 600 }}>Party Size:</label>
        <input
          type="number" min={1} max={50} value={partySize}
          onChange={e => {
            const newSize = Math.max(1, Number(e.target.value) || 1);
            setPartySize(newSize);
            // Clear selected table if it no longer has capacity
            if (selectedTable) {
              const table = tables.find(t => t.id === selectedTable);
              if (table && Number(table.capacity) < newSize) {
                setSelectedTable(null);
              }
            }
          }}
          className="glass-input"
          style={{ width: '80px', marginLeft: '0.5rem', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
        />
      </div>

      <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.5rem', fontWeight: 600 }}>Select Table:</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {tables.map(t => {
          const isAvail = t.available;
          const isSelected = selectedTable === t.id;
          const hasCapacity = Number(t.capacity) >= partySize;
          const isClickable = isAvail && hasCapacity;
          return (
            <div
              key={t.id}
              onClick={() => isClickable && setSelectedTable(isSelected ? null : t.id)}
              style={{
                padding: '0.6rem', borderRadius: '8px', textAlign: 'center', cursor: isClickable ? 'pointer' : 'not-allowed',
                background: isClickable ? (isSelected ? 'rgba(204,0,0,0.15)' : '#1a1a1a') : '#0d0d0d',
                border: isSelected ? '2px solid #CC0000' : '1px solid #333',
                opacity: isClickable ? 1 : 0.5, transition: 'all 0.15s',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isClickable ? '#fff' : '#666' }}>
                {t.table_number || `Table ${t.id}`}
              </div>
              {t.floor && <div style={{ fontSize: '0.7rem', color: '#888' }}>Floor: {t.floor}</div>}
              <div style={{ fontSize: '0.72rem', color: hasCapacity ? '#999' : '#f59e0b' }}>Cap: {t.capacity}</div>
              {Number(t.price) > 0 && <div style={{ fontSize: '0.72rem', color: '#CC0000' }}>₱{Number(t.price).toLocaleString()}</div>}
              <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', color: !isAvail ? '#ef4444' : !hasCapacity ? '#f59e0b' : '#4ade80' }}>
                {!isAvail ? '❌ Taken' : !hasCapacity ? '⚠️ Too Small' : '✅ Available'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Menu Selection */}
      {selectedTable && (
        <div style={{ marginBottom: '0.75rem' }}>
          <button
            className="btn btn-glass btn-sm"
            onClick={() => {
              setShowMenu(!showMenu);
              if (!showMenu && menuItems.length === 0) {
                loadMenu(eventMeta.bar_id);
              }
            }}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          >
            {showMenu ? '🍽️ Hide Menu' : '🍽️ Add Food & Drinks (Optional)'}
          </button>

          {showMenu && (
            <div style={{ background: '#0d0d0d', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {loadingMenu ? (
                <div className="loading-state" style={{ padding: '1rem 0' }}><div className="spinner" /><span>Loading menu...</span></div>
              ) : menuItems.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: '#888', textAlign: 'center' }}>No menu items available</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {menuItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#1a1a1a', borderRadius: '6px', border: selectedMenuItems[item.id] ? '1px solid #CC0000' : '1px solid #333' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{item.menu_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#CC0000' }}>₱{Number(item.selling_price).toLocaleString()}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <button
                          onClick={() => handleMenuItemQuantityChange(item.id, (selectedMenuItems[item.id] || 0) - 1)}
                          style={{ width: '24px', height: '24px', background: '#333', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: '0.82rem', color: '#fff', minWidth: '20px', textAlign: 'center' }}>
                          {selectedMenuItems[item.id] || 0}
                        </span>
                        <button
                          onClick={() => handleMenuItemQuantityChange(item.id, (selectedMenuItems[item.id] || 0) + 1)}
                          style={{ width: '24px', height: '24px', background: '#CC0000', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feature 3: Fee Breakdown */}
      {selectedTable && (
        <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', marginBottom: '0.3rem' }}>
            <span>Table Reservation:</span>
            <span>₱{tablePrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          {fee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', marginBottom: '0.3rem' }}>
              <span>Entrance Fee (x{partySize}):</span>
              <span>₱{entranceTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {menuTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', marginBottom: '0.3rem' }}>
              <span>Food & Drinks:</span>
              <span>₱{menuTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ borderTop: '1px solid #333', marginTop: '0.4rem', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#fff' }}>
            <span>Total:</span>
            <span>₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.82rem', background: msgType === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', color: msgType === 'success' ? '#4ade80' : '#ef4444', border: `1px solid ${msgType === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {msg}
        </div>
      )}

      {reservationLocked && (
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.82rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {reservationLockMsg}
        </div>
      )}

      <button
        className="btn btn-red btn-sm"
        disabled={!selectedTable || reserving || reservationLocked}
        onClick={handleReserve}
        style={{ width: '100%' }}
      >
        {reserving
          ? 'Processing...'
          : reservationLocked
            ? eventStatus === 'ongoing'
              ? 'Reservations Closed (Ongoing Event)'
              : 'Reservations Closed (Event Done)'
            : 'Reserve & Pay with GCash'}
      </button>
      <p style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.5rem', textAlign: 'center' }}>
        You will be redirected to PayMongo for secure payment
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// FEATURE 3: Entrance Fee Badge
// ═══════════════════════════════════════════
function EntranceFeeBadge({ entryPrice }) {
  const fee = Number(entryPrice || 0);
  if (fee > 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
        padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 600,
        background: 'rgba(204,0,0,0.15)', color: '#f87171',
        borderRadius: '12px', border: '1px solid rgba(204,0,0,0.25)',
      }}>
        🎟 ₱{fee.toLocaleString()} entrance
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 600,
      background: 'rgba(74,222,128,0.1)', color: '#4ade80',
      borderRadius: '12px', border: '1px solid rgba(74,222,128,0.2)',
    }}>
      FREE
    </span>
  );
}

function EventStatusBadge({ status }) {
  if (status === 'ongoing') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
        padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700,
        background: 'rgba(245,158,11,0.14)', color: '#f59e0b',
        borderRadius: '12px', border: '1px solid rgba(245,158,11,0.35)',
        letterSpacing: '0.35px',
      }}>
        ONGOING
      </span>
    );
  }

  if (status === 'done') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
        padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700,
        background: 'rgba(148,163,184,0.12)', color: '#cbd5e1',
        borderRadius: '12px', border: '1px solid rgba(148,163,184,0.35)',
        letterSpacing: '0.35px',
      }}>
        EVENT DONE
      </span>
    );
  }

  return null;
}

function EventPost({
  ev,
  onLikeToggle,
  autoExpandComments = false,
  focusCommentId = null,
  focusToken = '',
  onOpenDetail = null,
  isDetailView = false,
  initialExpanded = false,
}) {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [expanded, setExpanded] = useState(Boolean(initialExpanded));
  const [showReservation, setShowReservation] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const liked = Boolean(ev.user_liked || ev.liked_by_user);
  const autoExpandedKeyRef = useRef('');
  
  const isEvent = ev.feed_type === 'event' || ev.event_date;
  const isPost = ev.feed_type === 'post' || (!ev.event_date && ev.description);
  const eventLifecycleStatus = isEvent ? getEventLifecycleStatus(ev) : 'upcoming';
  const reserveLocked = isEvent && eventLifecycleStatus !== 'upcoming';
  const fullDescription = (ev.description || '').trim();
  const shortDescription = fullDescription.length > 160
    ? `${fullDescription.slice(0, 157).trimEnd()}...`
    : fullDescription;
  const descriptionText = isDetailView ? fullDescription : shortDescription;
  const eventDate = isEvent && ev.event_date ? formatDate(ev.event_date) : '';
  const eventTime = isEvent && ev.start_time
    ? `${formatTime(ev.start_time)}${ev.end_time ? ` - ${formatTime(ev.end_time)}` : ''}`
    : '';

  const entryPrice = Number(ev.entry_price || 0);
  const mediaPath = ev.image_path || ev.post_image_path || ev.image_url || null;

  useEffect(() => {
    if (isDetailView && initialExpanded) {
      setExpanded(true);
    }
  }, [isDetailView, initialExpanded]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      if (isEvent) {
        const r = await eventService.comments(ev.id);
        const list = r?.data || r || [];
        setComments(Array.isArray(list) ? list : []);
      } else {
        const r = await socialService.getPostComments(ev.id);
        setComments(Array.isArray(r) ? r : []);
      }
    } catch (_) {} finally { setLoadingComments(false); }
  }, [ev.id, isEvent]);

  useEffect(() => {
    if (expanded) loadComments();
  }, [expanded, loadComments]);

  useEffect(() => {
    if (!autoExpandComments) return;
    const key = `${focusToken || 'notification'}:${focusCommentId || ''}`;
    if (autoExpandedKeyRef.current === key) return;
    autoExpandedKeyRef.current = key;
    setExpanded(true);
  }, [autoExpandComments, focusCommentId, focusToken]);

  useEffect(() => {
    if (!focusCommentId || !expanded || loadingComments) return;
    const scope = isEvent ? 'event' : 'post';
    const elementId = `notif-comment-${scope}-${ev.id}-${focusCommentId}`;
    const targetEl = document.getElementById(elementId);
    if (!targetEl) return;

    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prevOutline = targetEl.style.outline;
    const prevBg = targetEl.style.backgroundColor;
    targetEl.style.outline = '2px solid rgba(204,0,0,0.65)';
    targetEl.style.backgroundColor = 'rgba(204,0,0,0.08)';

    const timeoutId = setTimeout(() => {
      targetEl.style.outline = prevOutline;
      targetEl.style.backgroundColor = prevBg;
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [focusCommentId, expanded, loadingComments, comments, isEvent, ev.id]);

  const handleLikeToggle = async () => {
    const wasLiked = liked;
    try {
      if (isEvent) {
        if (wasLiked) {
          await eventService.unlike(ev.id);
          onLikeToggle(ev.id, -1, ev.feed_type);
        } else {
          await eventService.like(ev.id);
          onLikeToggle(ev.id, 1, ev.feed_type);
        }
      } else {
        await socialService.likePost(ev.id);
        onLikeToggle(ev.id, wasLiked ? -1 : 1, ev.feed_type);
      }
    } catch (_) { /* like state is props-driven; keep in sync with server */ }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      if (isEvent) {
        await eventService.postComment(ev.id, { comment: newComment.trim() });
      } else {
        await socialService.commentOnPost(ev.id, newComment.trim());
      }
      setNewComment('');
      await loadComments();
    } catch (_) {} finally { setPosting(false); }
  };

  const commentDomPrefix = `notif-comment-${isEvent ? 'event' : 'post'}-${ev.id}-`;

  const handleOpenDetail = useCallback(() => {
    if (isDetailView || !onOpenDetail) return;
    onOpenDetail(ev);
  }, [ev, isDetailView, onOpenDetail]);

  const handleCardKeyDown = useCallback((e) => {
    if (isDetailView || !onOpenDetail) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenDetail(ev);
    }
  }, [ev, isDetailView, onOpenDetail]);

  return (
    <article
      className={`tweet-post glass-card ${isDetailView ? 'tweet-post-detail' : 'tweet-post-clickable'}`}
      onClick={handleOpenDetail}
      onKeyDown={handleCardKeyDown}
      role={!isDetailView && onOpenDetail ? 'button' : undefined}
      tabIndex={!isDetailView && onOpenDetail ? 0 : undefined}
      aria-label={!isDetailView && onOpenDetail ? `Open ${isEvent ? 'event' : 'post'} details` : undefined}
    >
      <div className="tweet-post-body">
        <div className="tweet-post-header">
          <div className="tweet-post-venue">
            <span className="badge-red tweet-post-type">
              {isEvent ? 'EVENT' : 'POST'}
            </span>
            {ev.bar_name && (
              <span className="tweet-post-barname">
                <BarAvatar event={ev} />
                <span>{ev.bar_name}</span>
              </span>
            )}
            {/* Feature 3: Entrance fee badge on event cards */}
            {isEvent && <EntranceFeeBadge entryPrice={entryPrice} />}
            {isEvent && <EventStatusBadge status={eventLifecycleStatus} />}
          </div>
          <span className="tweet-post-time">
            {ev.time_ago || (ev.event_date ? formatDate(ev.event_date) : timeAgo(ev.created_at))}
          </span>
        </div>

        {ev.title && <h2 className="tweet-post-title" style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>{ev.title}</h2>}

        {(eventDate || eventTime) && (
          <p className="tweet-post-date" style={{ color: 'var(--color-text-muted)' }}>
            <Clock size={13} color="#C9762F" />
            <span>{eventDate}</span>
            {eventTime && (
              <>
                <span className="tweet-post-dot">•</span>
                <span>{eventTime}</span>
              </>
            )}
          </p>
        )}

        {/* Entrance fee & Capacity Indicator */}
        {isEvent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', margin: '0.4rem 0' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              🎟 {entryPrice > 0 ? `₱${entryPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'Free Entry'}
            </span>
            {Boolean(ev.max_capacity) && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-card)', padding: '0.15rem 0.5rem', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                👥 {ev.current_bookings || 0} / {ev.max_capacity} booked
              </span>
            )}
          </div>
        )}

        {descriptionText && (
          <p className={`tweet-post-desc ${isDetailView ? 'tweet-post-desc-full' : ''}`}>
            {descriptionText}
          </p>
        )}

        {mediaPath && (
          <div className={`tweet-post-media ${isDetailView ? 'tweet-post-media-detail' : ''}`}>
            <img
              src={imageUrl(mediaPath)}
              alt={ev.title || 'Post image'}
              className={`tweet-post-img ${isDetailView ? 'tweet-post-img-full' : ''}`}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        <div className="tweet-stats">
          <span>{ev.like_count || 0} likes</span>
          <span>{ev.comment_count || 0} comments</span>
        </div>

        <div className="tweet-actions">
          <button
            className={`tweet-action-btn ${liked ? 'liked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleLikeToggle();
            }}
          >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} style={{ color: liked ? '#ef4444' : 'currentColor' }} />
            <span>Like</span>
          </button>
          <button
            className={`tweet-action-btn ${expanded ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(p => !p);
            }}
          >
            <MessageCircle size={15} />
            <span>Comment</span>
          </button>
          {/* Feature 2: Reserve a Table button for events */}
          {isEvent && (
            <button
              className={`tweet-action-btn ${showReservation ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (reserveLocked) return;
                setShowReservation(p => !p);
              }}
              disabled={reserveLocked}
              title={reserveLocked
                ? eventLifecycleStatus === 'ongoing'
                  ? 'Reservations are disabled while this event is ongoing.'
                  : 'Reservations are disabled because this event is done.'
                : 'Reserve a table'}
              style={reserveLocked ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
            >
              🪑 <span>Reserve</span>
            </button>
          )}
        </div>

        {/* Feature 2: Event Table Reservation Section */}
        {showReservation && isEvent && (
          <div onClick={(e) => e.stopPropagation()}>
            <EventTableReservation eventId={ev.id} entryPrice={entryPrice} />
          </div>
        )}

        {expanded && (
          <div className="tweet-comments-section" onClick={(e) => e.stopPropagation()}>
            {loadingComments ? (
              <div className="loading-state" style={{ padding: '1rem 0' }}><div className="spinner" /><span>Loading comments...</span></div>
            ) : comments.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>No comments yet. Be the first!</p>
            ) : (
              <CommentThread comments={comments} eventId={isEvent ? ev.id : null} postId={isPost ? ev.id : null} isEvent={isEvent} depth={0} onReplyPosted={loadComments} barName={ev.bar_name} currentUserId={currentUserId} commentDomPrefix={commentDomPrefix} />
            )}
            <form className="tweet-comment-form" onSubmit={handlePostComment}>
              <input
                className="glass-input"
                placeholder="Write a comment..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
              />
              <button className="btn btn-red btn-sm" type="submit" disabled={posting}>
                {posting ? '...' : 'Post'}
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}

function FeedDetailModal({ open, item, onClose, onLikeToggle }) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !item) return null;

  const modalUi = (
    <div
      className="notif-panel-backdrop"
      onClick={onClose}
      style={{
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(980px, 96vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'rgba(10,10,10,0.96)',
          border: '1px solid rgba(232,0,30,0.24)',
          borderRadius: '14px',
          boxShadow: '0 20px 55px rgba(0,0,0,0.6)',
          padding: '0.85rem',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'sticky',
            top: '0.35rem',
            left: 'calc(100% - 2.1rem)',
            zIndex: 3,
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
          }}
          aria-label="Close post details"
          title="Close"
        >
          ✕
        </button>

        <EventPost
          ev={item}
          onLikeToggle={onLikeToggle}
          onOpenDetail={null}
          isDetailView
          initialExpanded
          autoExpandComments={false}
        />
      </div>
    </div>
  );

  return createPortal(modalUi, document.body);
}

function EventsView() {
  const { viewParams } = useView();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  const notificationTarget = viewParams?.notificationTarget;
  const targetFeedType = String(notificationTarget?.feed_type || '').toLowerCase();
  const targetPostId = Number(notificationTarget?.post_id || 0);
  const targetEventId = Number(notificationTarget?.event_id || 0);
  const targetItemId = targetFeedType === 'event' ? targetEventId : targetPostId;
  const targetCommentId = Number(
    targetFeedType === 'event'
      ? (notificationTarget?.reply_id || notificationTarget?.comment_id || 0)
      : (notificationTarget?.comment_id || notificationTarget?.reply_id || 0)
  ) || null;
  const targetFocusToken = `${notificationTarget?.notification_id || ''}-${notificationTarget?.reference_id || ''}-${targetCommentId || ''}`;
  const hasFocusedTarget =
    (targetFeedType === 'post' && targetPostId > 0) ||
    (targetFeedType === 'event' && targetEventId > 0);

  useEffect(() => {
    if (!notificationTarget || typeof notificationTarget !== 'object') return;
    if (targetFeedType === 'event') setActiveTab('events');
    if (targetFeedType === 'post') setActiveTab('posts');
  }, [notificationTarget, targetFeedType]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErr('');
        // Try unified feed first, fallback to events only
        try {
          const unifiedFeedParams = hasFocusedTarget
            ? {
                limit: 100,
                ...(targetFeedType === 'post' && targetPostId > 0 ? { focus_post_id: targetPostId } : {}),
                ...(targetFeedType === 'event' && targetEventId > 0 ? { focus_event_id: targetEventId } : {}),
              }
            : 50;

          const feed = await socialService.getUnifiedFeed(unifiedFeedParams);
          setEvents(feed);
        } catch (unifiedErr) {
          console.warn('Unified feed not available, falling back to events only');
          const bars = await barService.list();
          const responses = await Promise.all(
            bars.slice(0, 12).map(async (bar) => {
              const ev = await barService.events(bar.id).catch(() => []);
              return ev.map(e => ({ ...e, bar_name: bar.name, feed_type: 'event' }));
            })
          );
          const merged = responses.flat().sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
          setEvents(merged);
        }
      } catch (e) {
        setErr(e?.response?.data?.message || 'Failed to load feed.');
      } finally { setLoading(false); }
    }
    load();
  }, [hasFocusedTarget, targetFeedType, targetPostId, targetEventId]);

  const resolveFeedType = useCallback((item) => {
    if (!item) return 'post';
    return item.feed_type === 'event' || item.event_date ? 'event' : 'post';
  }, []);

  const openDetail = useCallback(async (seedItem) => {
    if (!seedItem) return;

    const itemId = Number(seedItem.id || 0);
    const itemType = resolveFeedType(seedItem);

    setDetailItem(seedItem);
    setDetailOpen(true);

    if (!itemId) return;

    try {
      const focusedParams = itemType === 'event'
        ? { limit: 1, focus_event_id: itemId }
        : { limit: 1, focus_post_id: itemId };

      const latest = await socialService.getUnifiedFeed(focusedParams);
      if (!Array.isArray(latest) || !latest.length) return;

      const matched = latest.find((entry) => {
        const entryType = resolveFeedType(entry);
        return Number(entry.id || 0) === itemId && entryType === itemType;
      }) || latest[0];

      if (matched) setDetailItem(matched);
    } catch (_) {
      // Keep opening with seed payload when focused fetch fails.
    }
  }, [resolveFeedType]);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const handleLikeToggle = (itemId, delta, feedType) => {
    const normalizedFeedType = feedType ? String(feedType).toLowerCase() : '';

    setEvents(prev => prev.map(e => {
      const eType = resolveFeedType(e);
      const matches = Number(e.id) === Number(itemId) && (!normalizedFeedType || eType === normalizedFeedType);
      return matches
        ? { ...e, like_count: Math.max(0, (e.like_count || 0) + delta), user_liked: delta > 0, liked_by_user: delta > 0 }
        : e;
    }));

    setDetailItem((prev) => {
      if (!prev) return prev;
      const prevType = resolveFeedType(prev);
      const matches = Number(prev.id) === Number(itemId) && (!normalizedFeedType || prevType === normalizedFeedType);
      if (!matches) return prev;
      return { ...prev, like_count: Math.max(0, (prev.like_count || 0) + delta), user_liked: delta > 0, liked_by_user: delta > 0 };
    });
  };

  if (loading) return <div className="loading-state" style={{ minHeight: '50vh' }}><div className="spinner" /><span>Loading events...</span></div>;

  const filtered = activeTab === 'all' ? events
    : activeTab === 'events' ? events.filter(e => e.feed_type === 'event' || e.event_date)
    : events.filter(e => e.feed_type === 'post' || (!e.event_date && e.feed_type !== 'event'));

  return (
    <div className="feed-page-container">
      <div className="feed-page-header">
        <div className="animate-in">
          <span className="home-eyebrow">SOCIAL FEED</span>
          <h1 className="home-section-title" style={{ marginTop: '0.5rem' }}>EVENTS & <span className="home-accent">POSTS</span></h1>
          <p className="home-section-sub">Events and posts from bars in Cavite.</p>
        </div>
      </div>

      <div className="feed-layout-3col">
        <LeftSidebar activeFilter={activeTab} onFilterChange={setActiveTab} />

        <div className="feed-center-column">
          <div className="feed-tabs">
            {[['all', 'All'], ['events', 'Events'], ['posts', 'Posts']].map(([tab, label]) => (
              <button
                key={tab}
                className={`feed-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
                {tab !== 'all' && (
                  <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', opacity: 0.7 }}>
                    {tab === 'events' ? events.filter(e => e.feed_type === 'event' || e.event_date).length
                      : events.filter(e => e.feed_type === 'post' || (!e.event_date && e.feed_type !== 'event')).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {err && <div className="alert alert-err">{err}</div>}

          {filtered.length === 0 ? (
            <div className="glass-card empty-state">
              <div className="empty-icon"><PartyPopper size={32} /></div>
              <h3 className="text-h3">{activeTab === 'all' ? 'No posts or events yet' : `No ${activeTab} yet`}</h3>
              <p className="text-muted mt-sm">Check back later for updates from bars.</p>
            </div>
          ) : (
            <div className="tweet-feed">
              {filtered.map(ev => {
                const evFeedType = (ev.feed_type === 'event' || ev.event_date) ? 'event' : 'post';
                const shouldFocusThisItem = Boolean(
                  targetItemId > 0 &&
                  Number(ev.id) === targetItemId &&
                  (!targetFeedType || targetFeedType === evFeedType)
                );

                return (
                  <EventPost
                    key={`${ev.feed_type || 'event'}-${ev.id}`}
                    ev={ev}
                    onLikeToggle={handleLikeToggle}
                    autoExpandComments={shouldFocusThisItem && Boolean(targetCommentId)}
                    focusCommentId={shouldFocusThisItem ? targetCommentId : null}
                    focusToken={shouldFocusThisItem ? targetFocusToken : ''}
                    onOpenDetail={openDetail}
                  />
                );
              })}
            </div>
          )}
        </div>

        <RightSidebar />
      </div>

      <FeedDetailModal
        open={detailOpen}
        item={detailItem}
        onClose={closeDetail}
        onLikeToggle={handleLikeToggle}
      />
    </div>
  );
}

export default EventsView;
