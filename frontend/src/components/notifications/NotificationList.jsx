import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { notificationsApi } from '../../api';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';
import Button from '../common/Button';

export default function NotificationList() {
  const { markAsRead: contextMarkAsRead, markAllAsRead: contextMarkAllAsRead, refreshUnreadCount } =
    useNotifications();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  // Fetch notifications from API
  const loadNotifications = useCallback(
    async (page = 1, unreadOnly = filterUnreadOnly) => {
      try {
        setLoading(true);
        setError(null);
        const data = await notificationsApi.getNotifications({
          page,
          limit: 10,
          unreadOnly,
        });

        setNotifications(data.notifications || []);
        setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
        setUnreadCount(data.unreadCount ?? 0);
      } catch (err) {
        console.error('Failed to load notifications', err);
        setError(err.response?.data?.message || 'Unable to retrieve notifications. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [filterUnreadOnly]
  );

  useEffect(() => {
    loadNotifications(1, filterUnreadOnly);
  }, [loadNotifications, filterUnreadOnly]);

  // Mark single notification as read
  const handleMarkAsRead = async (notificationId) => {
    try {
      await contextMarkAsRead(notificationId);
      // Update local state optimistically
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      refreshUnreadCount();
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await contextMarkAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
      refreshUnreadCount();
      // If currently on unreadOnly filter, refresh list
      if (filterUnreadOnly) {
        loadNotifications(1, true);
      }
    } catch (err) {
      console.error('Failed to mark all as read', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleTabChange = (unreadOnly) => {
    setFilterUnreadOnly(unreadOnly);
    loadNotifications(1, unreadOnly);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadNotifications(newPage, filterUnreadOnly);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleTabChange(false)}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              !filterUnreadOnly
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Notifications
            {pagination.total > 0 && !filterUnreadOnly && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {pagination.total}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange(true)}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              filterUnreadOnly
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Unread Only</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500 text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => loadNotifications(pagination.page, filterUnreadOnly)}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              loading={markingAll}
              icon={CheckCheck}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadNotifications(pagination.page, filterUnreadOnly)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* List Container */}
      {loading ? (
        // Loading Skeleton
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-4 bg-white/70 border border-slate-200 rounded-xl animate-pulse flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="h-3.5 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-200 rounded w-16" />
                </div>
                <div className="h-3 bg-slate-200 rounded w-3/4" />
                <div className="h-2.5 bg-slate-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        // Empty State
        <div className="py-16 px-4 bg-white/60 border border-slate-200/80 rounded-2xl text-center backdrop-blur-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-3 shadow-inner">
            {filterUnreadOnly ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            ) : (
              <Inbox className="w-7 h-7 text-slate-400" />
            )}
          </div>
          <h4 className="text-sm font-bold text-slate-900">
            {filterUnreadOnly ? "You're all caught up!" : 'No notifications yet'}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {filterUnreadOnly
              ? 'There are no unread notifications right now. Check back when you make new reservations or visit facilities.'
              : 'As you reserve smart toilets, complete sessions, and receive receipts, all activity updates will appear here.'}
          </p>

          {filterUnreadOnly && (
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => handleTabChange(false)}>
                View all notifications
              </Button>
            </div>
          )}
        </div>
      ) : (
        // Render Notifications
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
            />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
            notifications
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-slate-700 px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              type="button"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
