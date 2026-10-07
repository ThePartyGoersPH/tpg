import { useEffect, useState, useCallback } from 'react';
import { socialService } from '../services/socialService';

function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);

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

  const handleSelectNotification = (notification) => {
    if (!notification.is_read) {
      handleMarkRead(notification.id);
    }
    setSelectedNotification(notification);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'reservation': return '📅';
      case 'payment': return '💳';
      case 'promotion': return '🎉';
      case 'event': return '🎶';
      case 'review': return '⭐';
      case 'follow': return '👥';
      case 'like': return '❤️';
      case 'comment': return '💬';
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              {selectedNotification.related_type && (
                <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                  Related: {selectedNotification.related_type} #{selectedNotification.related_id}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
