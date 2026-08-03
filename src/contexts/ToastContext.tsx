import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import ToastContainer from '../components/ToastContainer';
import type { ToastType } from '../types';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastMethods {
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
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
    (message: string, type: ToastType = 'info', duration: number = 3000): string => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast: ToastMethods = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};
