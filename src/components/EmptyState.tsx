import React, { ReactElement, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  /** Alias for message */
  description?: string;
  action?: ReactNode;
  /** Label for an action button (used together with onAction) */
  actionLabel?: string;
  /** Click handler for the action button */
  onAction?: () => void;
}

/**
 * EmptyState - Reusable empty state component
 * Displays a centered message when no data is available
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  description,
  action,
  actionLabel,
  onAction,
}: EmptyStateProps): ReactElement {
  const subText = message ?? description;
  const actionNode =
    action ??
    (actionLabel && onAction ? (
      <button
        onClick={onAction}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        {actionLabel}
      </button>
    ) : null);

  return (
    <div className="text-center py-12">
      <Icon
        className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
        aria-hidden="true"
      />
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
      {subText && (
        <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">{subText}</p>
      )}
      {actionNode && <div className="mt-4">{actionNode}</div>}
    </div>
  );
}
