import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  AlertTriangle,
  Sparkles,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Star,
} from 'lucide-react';
import Badge from '../common/Badge';

/**
 * Format relative time (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Configuration per notification type
 */
const TYPE_CONFIG = {
  BOOKING_CREATED: {
    label: 'Booking Created',
    badgeVariant: 'primary',
    icon: Calendar,
    iconBg: 'bg-brand-50 text-brand-600 border-brand-200',
    unreadBorder: 'border-l-4 border-l-brand-500',
  },
  PAYMENT_SUCCEEDED: {
    label: 'Payment Successful',
    badgeVariant: 'success',
    icon: CreditCard,
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    unreadBorder: 'border-l-4 border-l-emerald-500',
  },
  BOOKING_CANCELLED: {
    label: 'Booking Cancelled',
    badgeVariant: 'danger',
    icon: AlertTriangle,
    iconBg: 'bg-rose-50 text-rose-600 border-rose-200',
    unreadBorder: 'border-l-4 border-l-rose-500',
  },
  SESSION_COMPLETED: {
    label: 'Session Completed',
    badgeVariant: 'info',
    icon: Sparkles,
    iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
    unreadBorder: 'border-l-4 border-l-purple-500',
  },
};

export default function NotificationItem({
  notification,
  onMarkAsRead,
  compact = false,
  onActionClick,
}) {
  const [marking, setMarking] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { id, type, title, message, data, readAt, createdAt } = notification;
  const isRead = Boolean(readAt);

  const config = TYPE_CONFIG[type] || {
    label: type || 'Notification',
    badgeVariant: 'neutral',
    icon: Bell,
    iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
    unreadBorder: 'border-l-4 border-l-slate-400',
  };

  const IconComponent = config.icon;

  const handleMarkAsRead = async (e) => {
    e.stopPropagation();
    if (isRead || marking) return;
    try {
      setMarking(true);
      await onMarkAsRead(id);
    } catch {
      // Handled in parent
    } finally {
      setMarking(false);
    }
  };

  // Determine deep-link action button based on payload data
  const renderAction = () => {
    if (type === 'SESSION_COMPLETED' && data?.toiletId) {
      return (
        <Link
          to={`/toilets/${data.toiletId}`}
          onClick={onActionClick}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
        >
          <Star className="w-3.5 h-3.5 fill-purple-500 text-purple-500" />
          Rate & Review Facility
        </Link>
      );
    }

    if (data?.bookingId) {
      return (
        <Link
          to="/customer/bookings"
          onClick={onActionClick}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Booking Details
        </Link>
      );
    }

    return null;
  };

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-200 ${
        isRead
          ? 'bg-white/70 border-slate-200/80 hover:bg-white hover:border-slate-300'
          : `bg-slate-50/90 border-slate-200 shadow-sm ${config.unreadBorder}`
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex items-start gap-3">
        {/* Type Icon */}
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${config.iconBg}`}
        >
          <IconComponent className="w-4 h-4" />
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold ${isRead ? 'text-slate-800' : 'text-slate-900'}`}>
                {title || config.label}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {config.label}
              </span>
              {!isRead && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-100 text-brand-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  New
                </span>
              )}
            </div>

            {/* Timestamp & Mark Read action */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(createdAt)}
              </span>

              {!isRead && onMarkAsRead && (
                <button
                  type="button"
                  onClick={handleMarkAsRead}
                  disabled={marking}
                  title="Mark as read"
                  className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors focus:outline-none"
                >
                  <Check className={`w-3.5 h-3.5 ${marking ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>

          <p className={`text-xs leading-relaxed ${isRead ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>
            {message}
          </p>

          {/* Action and details footer */}
          <div className="mt-2.5 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100/80">
            <div className="flex items-center gap-2">
              {renderAction()}

              {data && Object.keys(data).length > 0 && !compact && (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" /> Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" /> View Event Details
                    </>
                  )}
                </button>
              )}
            </div>

            {isRead && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <CheckCheck className="w-3 h-3 text-emerald-500" /> Read
              </span>
            )}
          </div>

          {/* Expanded Metadata */}
          {expanded && data && (
            <div className="mt-2.5 p-2.5 bg-slate-900 rounded-lg text-slate-200 font-mono text-[11px] overflow-x-auto shadow-inner">
              <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
