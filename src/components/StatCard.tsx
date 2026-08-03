import React, { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export type StatCardColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: StatCardColor;
  icon?: LucideIcon;
  link?: string;
  ariaLabel?: string;
}

const COLOR_CLASSES: Record<StatCardColor, string> = {
  gray: 'text-gray-900 dark:text-white',
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  red: 'text-red-600 dark:text-red-400',
  purple: 'text-purple-600 dark:text-purple-400',
};

const ICON_COLOR_CLASSES: Record<StatCardColor, string> = {
  gray: 'text-gray-600 dark:text-gray-400',
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  red: 'text-red-600 dark:text-red-400',
  purple: 'text-purple-600 dark:text-purple-400',
};

/**
 * StatCard - Reusable statistics card component
 * Displays a label, value with optional icon and link
 */
export default function StatCard({
  label,
  value,
  color = 'gray',
  icon: Icon,
  link,
  ariaLabel,
}: StatCardProps): ReactElement {
  const content = (
    <>
      {Icon && (
        <div className="flex items-center justify-between mb-2">
          <Icon className={`w-6 h-6 ${ICON_COLOR_CLASSES[color]}`} aria-hidden="true" />
        </div>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${COLOR_CLASSES[color]}`}>{value}</p>
    </>
  );

  const baseClasses =
    'bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 transition-colors';

  if (link) {
    return (
      <Link
        to={link}
        className={`${baseClasses} block hover:shadow-lg`}
        aria-label={ariaLabel || `${label}: ${value}`}
      >
        {content}
      </Link>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
