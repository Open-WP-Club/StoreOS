import React, { ReactElement } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
}

/**
 * ErrorAlert - Consistent error message display
 */
export default function ErrorAlert({
  message,
  onDismiss,
}: ErrorAlertProps): ReactElement {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-md flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
