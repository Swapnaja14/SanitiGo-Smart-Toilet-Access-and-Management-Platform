import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '../api';
import { useAuth } from '../hooks/useAuth';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const pollingRef = useRef(null);

  // Fetch unread count from API
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently catch network errors during polling
    }
  }, [isAuthenticated]);

  // Fetch top 5 recent notifications for quick dropdown preview
  const fetchRecentNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingRecent(true);
      const data = await notificationsApi.getNotifications({ page: 1, limit: 5 });
      setRecentNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Ignore background error
    } finally {
      setLoadingRecent(false);
    }
  }, [isAuthenticated]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setRecentNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, readAt: new Date().toISOString() } : notif
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      setUnreadCount(0);
      setRecentNotifications((prev) =>
        prev.map((notif) => ({ ...notif, readAt: notif.readAt || new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
      throw err;
    }
  }, []);

  // Polling setup: 30-second interval + window focus refresh
  useEffect(() => {
    if (isAuthenticated) {
      refreshUnreadCount();

      pollingRef.current = setInterval(() => {
        if (!document.hidden) {
          refreshUnreadCount();
        }
      }, 30000);

      const handleVisibilityChange = () => {
        if (!document.hidden) {
          refreshUnreadCount();
        }
      };

      window.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('sanitigo:refresh_notifications', refreshUnreadCount);

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('sanitigo:refresh_notifications', refreshUnreadCount);
      };
    } else {
      setUnreadCount(0);
      setRecentNotifications([]);
    }
  }, [isAuthenticated, user?.id, refreshUnreadCount]);

  const value = {
    unreadCount,
    recentNotifications,
    loadingRecent,
    refreshUnreadCount,
    fetchRecentNotifications,
    markAsRead,
    markAllAsRead,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
