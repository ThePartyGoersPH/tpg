import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { socialService } from '../services/socialService';
import { useAuth } from '../hooks/useAuth';

function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Chat thread state for action === 'open_chat'
  const [chat, setChat] = useState({ loading: false, messages: [], error: null, draft: '' });

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await socialService.notifications(200);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notificationId) => {
    try {
      await socialService.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await socialService.markNotificationRead(null);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;
    try {
      await socialService.clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const loadChatThread = useCallback(async (notification) => {
    const meta = notification.metadata || {};
    const eventId = meta.event_id;
    const postId = meta.post_id;
    if (!eventId && !postId) return;

    setChat({ loading: true, messages: [], error: null, draft: '' });
    try {
      const messages = eventId
        ? await socialService.getEventComments(eventId)
        : await socialService.getPostComments(postId);
      setChat({ loading: false, messages: Array.isArray(messages) ? messages : [], error: null, draft: '' });
    } catch (err) {
      console.error('Failed to load chat thread:', err);
      setChat({ loading: false, messages: [], error: 'Could not load conversation.', draft: '' });
    }
  }, []);

  const handleSelectNotification = (notification) => {
    if (!notification.is_read) handleMarkRead(notification.id);

    const action = notification.action || 'navigate';
    const route = notification.target_route;

    if (action === 'open_chat' && notification.metadata) {
      setSelectedNotification(notification);
      loadChatThread(notification);
      return;
    }

    if (route) {
      navigate(route);
      return;
    }

    setSelectedNotification(notification);
  };

  const sendChatReply = async () => {
    const meta = selectedNotification?.metadata || {};
    const text = chat.draft.trim();
    if (!text) return;
    try {
      if (meta.event_id) {
        await socialService.commentOnEvent(meta.event_id, text);
      } else if (meta.post_id) {
        await socialService.commentOnPost(meta.post_id, text);
      } else {
        return;
      }
      setChat((c) => ({ ...c, draft: '' }));
      await loadChatThread(selectedNotification);
    } catch (err) {
      console.error('Failed to send reply:', err);
      setChat((c) => ({ ...c, error: 'Failed to send message.' }));
    }
  };

  const getNotificationIcon = (type) => {
    if (String(type || '').includes('chat')) return '💬';
    switch (type) {
      case 'reservation': return '📅';
      case 'payment': return '💳';
      case 'promotion': return '🎉';
      case 'event': return '🎶';
      case 'review': return '⭐';
      case 'follow': return '👥';
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'permit_expiry_warning':
      case 'permit_expired': return '📄';
      case 'low_stock': return '📦';
      case 'staff_added':
      case 'staff_permission_changed': return '👤';
      case 'attendance_late': return '⏰';
      case 'order_placed': return '🧾';
      case 'purchase_order_created':
      case 'purchase_order_approved':
      case 'purchase_order_rejected': return '🛒';
      default: return '🔔';
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  const isChat = selectedNotification?.action === 'open_chat' && selectedNotification?.metadata;

  return (
    <div className="page-container">
      <div className="notifications-header">
        <div>
          <h1 className="section-title">Notifications</h1>
          {unreadCount > 0 && (
            <span className="unread-badge-large">{unreadCount} unread</span>
          )}
        </div>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button className="button outline" onClick={handleMarkAllRead} type="button">
              Mark All Read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="button ghost" onClick={handleClearAll} type="button">
              Clear All
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</p>
          <h3>No notifications yet</h3>
          <p className="text-muted">You'll see notifications about reservations, payments, events, and more here.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
              onClick={() => handleSelectNotification(notification)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectNotification(notification)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <div className="notification-title">{notification.title}</div>
                <div className="notification-message">{notification.message}</div>
                <div className="notification-time">{notification.time_ago}</div>
              </div>
              {!notification.is_read && <div className="notification-dot" />}
            </div>
          ))}
        </div>
      )}

      {selectedNotification && (
        <div className="modal-overlay" onClick={() => setSelectedNotification(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>
                {getNotificationIcon(selectedNotification.type)}{' '}
                {selectedNotification.title}
              </h2>
              <button
                className="modal-close"
                onClick={() => setSelectedNotification(null)}
                type="button"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>{selectedNotification.message}</p>
              <div className="notification-meta">
                <span className="notification-type-badge">
                  {selectedNotification.type}
                </span>
                <span className="text-muted">{selectedNotification.time_ago}</span>
              </div>

              {isChat && (
                <div className="notification-chat" style={{ marginTop: '1.25rem' }}>
                  <div
                    className="chat-thread"
                    style={{
                      maxHeight: '280px',
                      overflowY: 'auto',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    {chat.loading && <p className="text-muted">Loading conversation…</p>}
                    {chat.error && <p className="text-muted">{chat.error}</p>}
                    {!chat.loading && chat.messages.length === 0 && !chat.error && (
                      <p className="text-muted">No messages yet. Start the conversation below.</p>
                    )}
                    {chat.messages.map((m) => {
                      const isMe = Number(m.user_id) === Number(user?.id);
                      const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || 'User';
                      return (
                        <div
                          key={m.id}
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            background: isMe ? 'var(--accent, #6c5ce7)' : 'rgba(255,255,255,0.08)',
                            color: isMe ? '#fff' : 'inherit',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '12px',
                            maxWidth: '80%',
                          }}
                        >
                          <div style={{ fontSize: '0.72rem', opacity: 0.7, marginBottom: '0.15rem' }}>
                            {name}
                          </div>
                          <div>{m.comment || m.reply}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="chat-reply" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Reply to customer…"
                      value={chat.draft}
                      onChange={(e) => setChat((c) => ({ ...c, draft: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && sendChatReply()}
                      style={{ flex: 1 }}
                    />
                    <button className="button" type="button" onClick={sendChatReply} disabled={!chat.draft.trim()}>
                      Send
                    </button>
                  </div>
                </div>
              )}

              {!isChat && selectedNotification.target_route && (
                <button
                  className="button outline"
                  style={{ marginTop: '1.25rem' }}
                  type="button"
                  onClick={() => navigate(selectedNotification.target_route)}
                >
                  View details
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
