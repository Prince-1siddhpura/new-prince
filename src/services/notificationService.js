import { notificationApi } from '../lib/apiClient';

export const getNotifications = async () => {
  try {
    const res = await notificationApi.getNotifications();
    if (res && res.data) {
      localStorage.setItem('edunova_notifications', JSON.stringify(res.data));
      return res.data;
    }
  } catch (err) {
    console.warn('Failed to fetch notifications from backend, using cache:', err.message);
  }
  const stored = localStorage.getItem('edunova_notifications');
  return stored ? JSON.parse(stored) : [];
};

export const markNotificationRead = async (id) => {
  try {
    await notificationApi.markRead(id);
  } catch (err) {
    console.warn('Failed to mark notification read on backend:', err.message);
  }
  const stored = localStorage.getItem('edunova_notifications');
  const notifs = stored ? JSON.parse(stored) : [];
  const updated = notifs.map((n) => (n.id === id ? { ...n, read: true, unread: false } : n));
  localStorage.setItem('edunova_notifications', JSON.stringify(updated));
  return updated;
};

export const markAllNotificationsRead = async () => {
  try {
    await notificationApi.markAllRead();
  } catch (err) {
    console.warn('Failed to mark all notifications read on backend:', err.message);
  }
  const stored = localStorage.getItem('edunova_notifications');
  const notifs = stored ? JSON.parse(stored) : [];
  const updated = notifs.map((n) => ({ ...n, read: true, unread: false }));
  localStorage.setItem('edunova_notifications', JSON.stringify(updated));
  return updated;
};

export const createNotification = async (payload) => {
  try {
    const res = await notificationApi.create(payload);
    return res.data;
  } catch (err) {
    console.warn('Failed to create notification on backend:', err.message);
    return null;
  }
};

export default {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification
};

