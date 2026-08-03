import React from 'react';
import { Loader2 } from 'lucide-react';
import type { LoadingState } from '../hooks/useProgressiveLoading';

interface LoadingIndicatorProps {
  loadingState?: LoadingState;
  /** Simple text message to show while loading (alternative to loadingState) */
  message?: string;
}

/**
 * Loading indicator component that shows a spinner with progress
 * Displays in the corner of the screen during progressive loading
 */
function LoadingIndicator({ loadingState, message }: LoadingIndicatorProps): React.ReactElement | null {
  // Simple message mode
  if (!loadingState) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-200 dark:border-gray-700 transition-all"
        role="status"
        aria-live="polite"
        aria-label={message ?? 'Loading...'}
      >
        <div className="flex items-center gap-3">
          <Loader2
            className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin"
            aria-hidden="true"
          />
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {message ?? 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  if (!loadingState.isLoading) return null;

  const { loaded, total, dataType, progress } = loadingState;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-200 dark:border-gray-700 transition-all"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${dataType}: ${loaded} of ${total} items`}
    >
      <div className="flex items-center gap-3">
        <Loader2
          className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin"
          aria-hidden="true"
        />
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">Loading {dataType}...</div>
          <div className="text-gray-600 dark:text-gray-400">
            {total > 0 ? `${loaded} / ${total} items (${progress}%)` : 'Initializing...'}
          </div>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-2 w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}
    </div>
  );
}

export default LoadingIndicator;
