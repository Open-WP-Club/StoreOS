import React, { memo, useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type DialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface VariantStyles {
  icon: string;
  iconBg: string;
  button: string;
}

/**
 * ConfirmDialog - Accessible modal dialog to replace window.confirm()
 */
const ConfirmDialog = memo(function ConfirmDialog({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps): React.ReactElement | null {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        onConfirm();
      }
    },
    [isOpen, onCancel, onConfirm, isLoading]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const variantStyles: Record<DialogVariant, VariantStyles> = {
    danger: {
      icon: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: 'text-yellow-600 dark:text-yellow-400',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
    info: {
      icon: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  };

  const styles = variantStyles[variant] || variantStyles.danger;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/80 transition-opacity"
        aria-hidden="true"
        onClick={onCancel}
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all w-full max-w-lg"
        >
          <button
            onClick={onCancel}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-6">
            <div className="flex items-start gap-4">
              <div
                className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${styles.iconBg}`}
              >
                <AlertTriangle className={`h-6 w-6 ${styles.icon}`} />
              </div>

              <div className="flex-1 pt-1">
                <h3
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                  id="modal-title"
                >
                  {title}
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{message}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex flex-row-reverse gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${styles.button}`}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="inline-flex justify-center rounded-md bg-white dark:bg-gray-600 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ConfirmDialog;
