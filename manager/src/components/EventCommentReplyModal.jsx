import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import { socialApi } from '../api/socialApi';
import { eventApi } from '../api/eventApi';
import { barApi } from '../api/barApi';
import toast from 'react-hot-toast';

const fmtTime = (v) => {
  if (!v) return '';
  try {
    return format(parseUTC(v), 'MMM d, h:mm a');
  } catch {
    return '';
  }
};

const EventCommentReplyModal = ({ notification, draft, onDraftChange, onClose }) => {
  const eventId = notification?.metadata?.event_id;
  const targetCommentId =
    notification?.metadata?.parent_comment_id || notification?.metadata?.comment_id;

  const [eventInfo, setEventInfo] = useState(null);
  const [barName, setBarName] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const threadRef = useRef(null);

  const loadThread = async () => {
    if (!eventId) return;
    try {
      const { data } = await socialApi.getEventComments(eventId);
      setComments(data?.data || []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!notification) return;
    setLoading(true);
    setComments([]);

    // Event context banner (title + date), plus bar name for extra context.
    eventApi
      .getDetails(eventId)
      .then(({ data }) => setEventInfo(data?.data || data || null))
      .catch(() => {});
    barApi
      .getDetails({ silentError: true })
      .then(({ data }) => setBarName(data?.data?.name || data?.name || ''))
      .catch(() => {});

    loadThread();
  }, [notification?.id]);

  const handleSend = async () => {
    const text = (draft || '').trim();
    if (!text || submitting) return;
    if (!targetCommentId) {
      toast.error('Unable to locate the original comment.');
      return;
    }
    setSubmitting(true);
    try {
      await eventApi.replyToComment(targetCommentId, text);
      onDraftChange('');
      toast.success('Reply sent');
      await loadThread();
      // Scroll thread to bottom to reveal the new reply.
      requestAnimationFrame(() => {
        if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
      });
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const originalCommentId = notification?.metadata?.comment_id;
  const originalComment = comments.find((c) => c.id === originalCommentId);
  const replyLabel = originalComment?.user_name || notification?.metadata?.commenter_name || 'the comment';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-lg rounded-xl overflow-hidden"
        style={{ background: 'var(--m-bg)', border: '1px solid var(--m-border)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--m-border)' }}
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" style={{ color: '#CC0000' }} />
            <h3 className="text-sm font-semibold text-white">{notification?.title || 'Comment'}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5" style={{ color: '#aaa' }} />
          </button>
        </div>

        {/* Event context banner */}
        <div className="px-5 py-3" style={{ background: 'var(--m-surface-2)', borderBottom: '1px solid var(--m-border)' }}>
          <p className="text-xs" style={{ color: '#888' }}>EVENT</p>
          <p className="text-sm font-semibold text-white truncate">
            {eventInfo?.title || 'Loading event…'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#666' }}>
            {eventInfo?.event_date ? fmtTime(eventInfo.event_date) : ''}
            {eventInfo?.start_time ? ` · ${String(eventInfo.start_time).slice(0, 5)}` : ''}
            {barName ? ` · ${barName}` : ''}
          </p>
        </div>

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <p className="text-sm" style={{ color: '#555' }}>Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm" style={{ color: '#555' }}>No comments yet.</p>
          ) : (
            comments.map((c) => {
              const isOriginal = c.id === originalCommentId;
              return (
                <div
                  key={c.id}
                  className="rounded-lg p-3"
                  style={{
                    background: 'var(--m-surface-2)',
                    borderLeft: isOriginal ? '3px solid #CC0000' : '3px solid transparent',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: '#ccc' }}>{c.user_name}</span>
                    <span className="text-xs" style={{ color: '#555' }}>{fmtTime(c.created_at)}</span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: '#aaa' }}>{c.comment}</p>

                  {c.replies && c.replies.length > 0 && (
                    <div className="ml-4 space-y-2 mt-2">
                      {c.replies.map((r) => (
                        <div key={r.id} className="rounded p-2 text-xs" style={{ background: 'var(--m-surface)' }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white">{r.user_name}</span>
                            {r.is_bar_owner && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#CC0000', color: '#fff' }}>
                                Bar Owner
                              </span>
                            )}
                            <span className="text-xs" style={{ color: '#555' }}>{fmtTime(r.created_at)}</span>
                          </div>
                          <p style={{ color: '#888' }}>{r.reply}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Reply box */}
        <div className="px-5 py-3" style={{ borderTop: '1px solid var(--m-border)' }}>
          <p className="text-xs mb-1" style={{ color: '#666' }}>
            Replying to {replyLabel}
          </p>
          <div className="flex items-end gap-2">
            <textarea
              value={draft || ''}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              placeholder="Type your reply…"
              className="input-field flex-1 text-sm resize-none"
              style={{ background: 'var(--m-surface-2)' }}
            />
            <button
              onClick={handleSend}
              disabled={!draft?.trim() || submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: '#CC0000' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCommentReplyModal;
