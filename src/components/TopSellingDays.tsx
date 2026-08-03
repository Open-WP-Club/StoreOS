import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import type { WooCommerceOrder } from '../types';

export interface DayData {
  date: string;
  revenue: number;
  orders: number;
}

interface TopSellingDaysProps {
  /** Pass either raw orders (data will be derived) or pre-computed topDays */
  orders?: WooCommerceOrder[];
  topDays?: DayData[];
  limit?: number;
  formatCurrency: (amount: number) => string;
}

export default function TopSellingDays({
  orders,
  topDays: topDaysProp,
  limit = 5,
  formatCurrency,
}: TopSellingDaysProps): React.ReactElement | null {
  const derivedTopDays = useMemo<DayData[]>(() => {
    if (topDaysProp) return topDaysProp.slice(0, limit);
    if (!orders) return [];
    const dailyMap: Record<string, DayData> = {};
    orders.forEach((o) => {
      if (o.status !== 'completed') return;
      const date = o.date_created.slice(0, 10);
      if (!dailyMap[date]) dailyMap[date] = { date, revenue: 0, orders: 0 };
      const entry = dailyMap[date]!;
      entry.revenue += parseFloat(o.total || '0');
      entry.orders += 1;
    });
    return Object.values(dailyMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }, [orders, topDaysProp, limit]);

  if (derivedTopDays.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No completed orders yet
      </p>
    );
  }

  const maxRevenue = derivedTopDays[0]?.revenue ?? 1;

  const formatDay = (dateStr: string): string =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-3">
      {derivedTopDays.map((day, i) => {
        const barPct = (day.revenue / maxRevenue) * 100;
        return (
          <div key={day.date}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                  i === 1 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' :
                  i === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' :
                  'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>{i + 1}</span>
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="font-medium">{formatDay(day.date)}</span>
              </div>
              <div className="flex items-center gap-3 text-right shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {day.orders} {day.orders === 1 ? 'order' : 'orders'}
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(day.revenue)}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
