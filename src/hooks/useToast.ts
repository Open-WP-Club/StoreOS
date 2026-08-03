import { useState, useCallback, useMemo } from 'react';
import type { ToastType } from '../types';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

/**
 * Toast notification object
 */
export interface ToastNotification {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
}

/**
 * Return type for useToast hook
 */
export interface UseToastReturn {
  toasts: ToastNotification[];
  showToast: (message: string, type?: ToastType, duration?: number, action?: ToastAction) => void;
  removeToast: (id: string) => void;
}

/**
 * Hook for managing toast notifications
 */
export const useToast = (): UseToastReturn => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000, action?: ToastAction) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type, duration, action }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return useMemo(() => ({ toasts, showToast, removeToast }), [toasts, showToast, removeToast]);
};

export default useToast;
