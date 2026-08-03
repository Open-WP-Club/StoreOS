import React from 'react';
import Toast from './Toast';
import type { ToastType } from '../types';
import type { ToastAction } from '../hooks/useToast';

interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          action={toast.action}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
