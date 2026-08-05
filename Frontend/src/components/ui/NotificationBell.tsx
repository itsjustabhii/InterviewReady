import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { useUnreadCount, useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/useApi';
import type { Notification } from '../../types';

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-gray-400',
};

const typeIcon: Record<string, string> = {
  booking_confirmed: '📅',
  booking_cancelled: '❌',
  booking_reminder: '⏰',
  booking_completed: '✅',
  booking_rescheduled: '🔄',
  payment_success: '💳',
  payment_failed: '⚠️',
  payment_refunded: '↩️',
  subscription_expiring: '⏳',
  subscription_expired: '🔒',
  subscription_renewed: '🔁',
  review_received: '⭐',
  review_responded: '💬',
  interviewer_approved: '🎉',
  interviewer_rejected: '😞',
  withdrawal_processed: '💰',
  system_announcement: '📢',
  general: '🔔',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notifData } = useNotifications({ page: 1, limit: 10 });
  const notifications = notifData?.data.notifications ?? [];

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n._id);
    if (n.actionUrl) {
      navigate(n.actionUrl);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 rounded-xl hover:bg-[var(--glass)] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-80 rounded-2xl glass border border-[var(--border)] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                Notifications {unreadCount > 0 && <span className="text-[var(--accent)] ml-1">({unreadCount})</span>}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    All read
                  </button>
                )}
                <button onClick={() => setOpen(false)}>
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-[var(--text-secondary)] text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((n: Notification) => (
                  <button
                    key={n._id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-[var(--glass)] transition-colors flex gap-3 ${
                      !n.isRead ? 'bg-blue-500/5' : ''
                    }`}
                  >
                    {/* Icon */}
                    <span className="text-xl flex-shrink-0 mt-0.5">{typeIcon[n.type] ?? '🔔'}</span>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-sm font-medium truncate ${!n.isRead ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[n.priority]}`} />
                          {n.isRead && <Check className="w-3 h-3 text-green-500" />}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] opacity-60 mt-1">
                        {formatDistanceToNow(n.createdAt)}
                      </p>
                    </div>

                    {n.actionUrl && (
                      <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0 mt-2" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-[var(--border)] px-4 py-2.5 text-center">
                <button
                  onClick={() => { navigate('/notifications'); setOpen(false); }}
                  className="text-xs text-[var(--accent)] hover:opacity-80 font-medium"
                >
                  View all notifications →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Made with Bob
