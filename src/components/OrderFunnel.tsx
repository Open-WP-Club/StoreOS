import React, { useMemo } from 'react';
import type { WooCommerceOrder } from '../types';

interface FunnelStage {
  label: string;
  description: string;
  count: number;
  color: string;
  bgColor: string;
}

interface OrderFunnelProps {
  orders: WooCommerceOrder[];
}

export default function OrderFunnel({ orders }: OrderFunnelProps): React.ReactElement | null {
  const stages = useMemo<FunnelStage[]>(() => {
    const total = orders.length;
    if (total === 0) return [];

    const confirmed = orders.filter(
      (o) => !['cancelled', 'failed', 'trash'].includes(o.status)
    ).length;

    const inProgress = orders.filter((o) =>
      ['processing', 'on-hold', 'completed'].includes(o.status)
    ).length;

    const completed = orders.filter((o) => o.status === 'completed').length;

    return [
      {
        label: 'Received',
        description: 'All orders placed',
        count: total,
        color: 'text-blue-700 dark:text-blue-300',
        bgColor: 'bg-blue-500',
      },
      {
        label: 'Confirmed',
        description: 'Not cancelled or failed',
        count: confirmed,
        color: 'text-indigo-700 dark:text-indigo-300',
        bgColor: 'bg-indigo-500',
      },
      {
        label: 'In Progress',
        description: 'Processing, on-hold, or completed',
        count: inProgress,
        color: 'text-violet-700 dark:text-violet-300',
        bgColor: 'bg-violet-500',
      },
      {
        label: 'Completed',
        description: 'Fully fulfilled',
        count: completed,
        color: 'text-green-700 dark:text-green-300',
        bgColor: 'bg-green-500',
      },
    ];
  }, [orders]);

  if (stages.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No order data available
      </p>
    );
  }

  const maxCount = stages[0]?.count ?? 1;

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const widthPct = Math.max((stage.count / maxCount) * 100, 8);
        const prevCount = i > 0 ? (stages[i - 1]?.count ?? stage.count) : stage.count;
        const dropOff = prevCount > 0 && i > 0
          ? (((prevCount - stage.count) / prevCount) * 100).toFixed(1)
          : null;
        const convRate = maxCount > 0
          ? ((stage.count / maxCount) * 100).toFixed(1)
          : '0';

        return (
          <div key={stage.label}>
            {/* Drop-off indicator between stages */}
            {dropOff !== null && parseFloat(dropOff) > 0 && (
              <div className="flex items-center gap-2 py-0.5 pl-2">
                <div className="h-px flex-1 border-t border-dashed border-gray-300 dark:border-gray-600" />
                <span className="text-xs text-red-500 dark:text-red-400 shrink-0">
                  −{dropOff}%
                </span>
              </div>
            )}

            {/* Stage row */}
            <div className="flex items-center gap-3">
              {/* Funnel bar — centered, shrinks for lower stages */}
              <div className="flex-1 flex justify-center">
                <div
                  className={`h-9 rounded-md flex items-center justify-between px-3 transition-all duration-500 ${stage.bgColor} bg-opacity-80`}
                  style={{ width: `${widthPct}%`, minWidth: '120px' }}
                >
                  <span className="text-white text-sm font-semibold truncate">{stage.label}</span>
                  <span className="text-white text-sm font-bold ml-2 shrink-0">{stage.count}</span>
                </div>
              </div>

              {/* Conversion rate from top */}
              <div className="w-14 text-right shrink-0">
                <span className={`text-xs font-medium ${stage.color}`}>{convRate}%</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-400 dark:text-gray-500 pl-2 mt-0.5">{stage.description}</p>
          </div>
        );
      })}

      <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700">
        Conversion rate = % of all received orders
      </p>
    </div>
  );
}
