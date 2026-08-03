import React from 'react';
import { ArrowUp, ArrowDown, Minus, LucideIcon } from 'lucide-react';
import type { KPIDirection } from '../utils/kpiCalculator';

interface KPICardProps {
  label: string;
  value: string;
  changePercent: number;
  direction: KPIDirection;
  icon?: LucideIcon;
  /** When true, "down" is green and "up" is red (e.g. refund rate, processing time). */
  invertColors?: boolean;
}

function KPICard({
  label,
  value,
  changePercent,
  direction,
  icon: Icon,
  invertColors = false,
}: KPICardProps): React.ReactElement {
  const isPositive = invertColors ? direction === 'down' : direction === 'up';
  const isNegative = invertColors ? direction === 'up' : direction === 'down';

  const DirectionIcon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
      </div>

      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</div>

      {direction !== 'flat' || changePercent !== 0 ? (
        <div className="flex items-center gap-1">
          <DirectionIcon
            className={`w-3.5 h-3.5 ${
              isPositive
                ? 'text-green-600 dark:text-green-400'
                : isNegative
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-400 dark:text-gray-500'
            }`}
          />
          <span
            className={`text-sm font-medium ${
              isPositive
                ? 'text-green-600 dark:text-green-400'
                : isNegative
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {Math.abs(changePercent).toFixed(1)}%
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">vs prev period</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Minus className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="text-sm text-gray-400 dark:text-gray-500">No change</span>
        </div>
      )}
    </div>
  );
}

export default KPICard;
