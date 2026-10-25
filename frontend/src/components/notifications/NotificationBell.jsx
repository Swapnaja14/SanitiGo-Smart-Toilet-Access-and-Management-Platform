import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Inbox,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';

export default function NotificationBell({ isMobile = false }) {
  const {
    unreadCount,
    recentNotifications,
    loadingRecent,
    fetchRecentNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle open dropdown and fetch latest
  const toggleDropdown = () => {
    if (!isOpen) {
      fetchRecentNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await markAllAsRead();
    } catch {
      // Ignored
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={toggleDropdown}
        aria-label="View notifications"
        className={`relative p-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
          isOpen
            ? 'bg-brand-50 text-brand-600'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
      >
        <Bell className="w-5 h-5 transition-transform group-hover:rotate-6" />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-md shadow-rose-500/30 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute ${
            isMobile ? 'right-0' : 'right-0'
          } mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-slide-up`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-[11px] font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
              >
                {markingAll ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCheck className="w-3 h-3" />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List Body */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
            {loadingRecent ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-2">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  We'll notify you when bookings, payments or access updates happen.
                </p>
              </div>
            ) : (
              recentNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  compact
                  onActionClick={() => setIsOpen(false)}
                />
              ))
            )}
          </div>

          {/* Footer: View all link */}
          <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Go to Notification Center
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
