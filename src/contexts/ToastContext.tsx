import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import ToastContainer from '../components/ToastContainer';
import type { ToastType } from '../types';
import type { ToastAction } from '../hooks/useToast';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
}

interface ToastMethods {
  success: (message: string, duration?: number, action?: ToastAction) => string;
  error: (message: string, duration?: number, action?: ToastAction) => string;
  warning: (message: string, duration?: number, action?: ToastAction) => string;
  info: (message: string, duration?: number, action?: ToastAction) => string;
}

const ToastContext = createContext<ToastMethods | null>(null);

export const useToast = (): ToastMethods => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      duration: number = 3000,
      action?: ToastAction
    ): string => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type, duration, action }]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Stable identity so consumers can list it in hook dependencies.
  const toast = useMemo<ToastMethods>(
    () => ({
      success: (message, duration, action) => addToast(message, 'success', duration, action),
      error: (message, duration, action) => addToast(message, 'error', duration, action),
      warning: (message, duration, action) => addToast(message, 'warning', duration, action),
      info: (message, duration, action) => addToast(message, 'info', duration, action),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};
