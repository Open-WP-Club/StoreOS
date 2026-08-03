import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import type { ToastType } from '../types';
import type { ToastAction } from '../hooks/useToast';

interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
  onClose: (id: string) => void;
}

/**
 * Toast Notification Component
 *
 * Accessible toast notification with:
 * - ARIA live regions for screen reader announcements
 * - Role based on toast type (alert for errors, status for others)
 * - Keyboard accessible close button
 * - Auto-dismiss with configurable duration
 * - Optional action button (e.g. "Undo")
 */
const Toast: React.FC<ToastProps> = ({ id, message, type = 'info', duration = 3000, action, onClose }) => {
  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [id, duration, onClose]);

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />,
    error: <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500" aria-hidden="true" />,
    info: <Info className="w-5 h-5 text-blue-500" aria-hidden="true" />,
  };

  const bgColors: Record<ToastType, string> = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  const textColors: Record<ToastType, string> = {
    success: 'text-green-800 dark:text-green-300',
    error: 'text-red-800 dark:text-red-300',
    warning: 'text-yellow-800 dark:text-yellow-300',
    info: 'text-blue-800 dark:text-blue-300',
  };

  const actionColors: Record<ToastType, string> = {
    success: 'text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200',
    error: 'text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200',
    warning: 'text-yellow-700 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-200',
    info: 'text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200',
  };

  const typeLabels: Record<ToastType, string> = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
  };

  const role = type === 'error' ? 'alert' : 'status';
  const ariaLive = type === 'error' ? 'assertive' : 'polite';

  const handleAction = () => {
    action?.onClick();
    onClose(id);
  };

  return (
    <div
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
      className={`flex items-center gap-3 p-4 rounded-lg border shadow-lg ${bgColors[type]} animate-slide-in-right`}
    >
      {icons[type]}
      <p className={`flex-1 ${textColors[type]} font-medium`}>
        <span className="sr-only">{typeLabels[type]}: </span>
        {message}
      </p>
      {action && (
        <button
          type="button"
          onClick={handleAction}
          className={`${actionColors[type]} font-semibold text-sm underline underline-offset-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current rounded shrink-0`}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onClose(id)}
        className={`${textColors[type]} hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current rounded`}
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default Toast;
