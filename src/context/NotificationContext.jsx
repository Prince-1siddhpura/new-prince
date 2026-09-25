import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { notificationApi } from '../lib/apiClient';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem('edunova_notifications');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Error reading notifications', e);
    }
    return [];
  });

  // Sync from backend database on mount
  useEffect(() => {
    const token = localStorage.getItem('edunova_token') || localStorage.getItem('token');
    if (!token) return;

    notificationApi.getNotifications()
      .then((res) => {
        if (res && res.data) {
          setNotifications(res.data);
          localStorage.setItem('edunova_notifications', JSON.stringify(res.data));
        }
      })
      .catch((err) => {
        console.warn('Could not sync notifications from server:', err.message);
      });
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read && n.unread !== false).length;
  }, [notifications]);

  const markRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, unread: false } : n))
    );
    notificationApi.markRead(id).catch((err) => {
      console.warn('Failed to mark notification read on server:', err.message);
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, unread: false }))
    );
    notificationApi.markAllRead().catch((err) => {
      console.warn('Failed to mark all notifications read on server:', err.message);
    });
  }, []);

  const addNotification = useCallback((notif) => {
    const newNotif = {
      id: `notif_${Date.now()}`,
      timeAgo: 'Just now',
      time: 'Just now',
      read: false,
      unread: true,
      accent: '#06b6d4',
      ...notif
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Async persist to PostgreSQL
    notificationApi.create({
      title: notif.title || 'Notification',
      message: notif.message || '',
      type: notif.type || 'SYSTEM',
      accent: notif.accent || '#06b6d4',
      link: notif.link || null
    }).catch((err) => {
      console.warn('Failed to save notification on server:', err.message);
    });
  }, []);


  const contextValue = useMemo(() => ({
    notifications,
    unreadCount,
    markRead,
    markAllAsRead,
    addNotification
  }), [notifications, unreadCount, markRead, markAllAsRead, addNotification]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);

