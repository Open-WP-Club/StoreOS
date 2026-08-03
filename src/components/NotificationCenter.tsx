import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  ShoppingCart,
  AlertTriangle,
  CreditCard,
  RefreshCw,
  Info,
} from 'lucide-react';
import useNotifications from '../stores/notificationStore';
import type { NotificationType } from '../stores/notificationStore';

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; color: string; bgColor: string }> = {
  new_order: {
    icon: ShoppingCart,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  low_stock: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  failed_payment: {
    icon: CreditCard,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  order_status: {
    icon: RefreshCw,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  info: {
    icon: Info,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function NotificationCenter(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const notifications = useNotifications((s) => s.notifications);
  const markAsRead = useNotifications((s) => s.markAsRead);
  const markAllAsRead = useNotifications((s) => s.markAllAsRead);
  const removeNotification = useNotifications((s) => s.removeNotification);
  const clearAll = useNotifications((s) => s.clearAll);
  const getUnreadCount = useNotifications((s) => s.getUnreadCount);

  const unreadCount = getUnreadCount();

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleNotificationClick = (id: string, route?: string): void => {
    markAsRead(id);
    if (route) {
      navigate(route);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 rounded text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title="Mark all as read"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1 rounded text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Clear all"
                  aria-label="Clear all notifications"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification.id, notification.route)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNotificationClick(notification.id, notification.route);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 p-1.5 rounded-lg ${config.bgColor}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${
                          !notification.read
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {notification.body}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        {formatTimeAgo(notification.timestamp)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {!notification.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          title="Mark as read"
                          aria-label="Mark notification as read"
                        >
                          <Check className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="Remove"
                        aria-label="Remove notification"
                      >
                        <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
