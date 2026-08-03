import React, { ReactElement, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Alias for subtitle */
  description?: string;
  /** Optional icon displayed before the title */
  icon?: LucideIcon;
  actions?: ReactNode;
}

/**
 * PageHeader - Consistent page header with title, subtitle, and optional actions
 */
export default function PageHeader({
  title,
  subtitle,
  description,
  icon: Icon,
  actions,
}: PageHeaderProps): ReactElement {
  const subText = subtitle ?? description;
  return (
    <div className="mb-6 flex justify-between items-start">
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-6 h-6 text-gray-700 dark:text-gray-300" aria-hidden="true" />}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
        {subText && (
          <p className="text-gray-600 dark:text-gray-400 mt-1">{subText}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
