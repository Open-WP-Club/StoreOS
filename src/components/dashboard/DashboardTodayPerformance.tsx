import React from 'react';
import { TrendingUp, TrendingDown, Minus, ShoppingCart } from 'lucide-react';
import type { DailyStatsState } from '../../hooks/useDashboardStats';

interface Props {
  dailyStats: DailyStatsState;
  formatCurrency: (n: number) => string;
}

function renderTrendIcon(trend: number): React.ReactElement {
  if (trend > 0) return <TrendingUp className="w-5 h-5 text-green-400" aria-hidden="true" />;
  if (trend < 0) return <TrendingDown className="w-5 h-5 text-red-400" aria-hidden="true" />;
  return <Minus className="w-5 h-5 text-gray-400" aria-hidden="true" />;
}

function calculateTrend(todayValue: number, yesterdayValue: number): number {
  if (yesterdayValue === 0) return todayValue > 0 ? 100 : 0;
  return parseFloat((((todayValue - yesterdayValue) / yesterdayValue) * 100).toFixed(1));
}

const DashboardTodayPerformance = React.memo(function DashboardTodayPerformance({
  dailyStats,
  formatCurrency,
}: Props) {
  const ordersTrend = calculateTrend(dailyStats.today.orders, dailyStats.yesterday.orders);
  const revenueTrend = calculateTrend(dailyStats.today.revenue, dailyStats.yesterday.revenue);

  return (
    <section aria-labelledby="todays-performance-heading" className="mb-6">
      <h2
        id="todays-performance-heading"
        className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
      >
        Today&apos;s Performance
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Orders Today Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Orders Today
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {renderTrendIcon(ordersTrend)}
              <span
                className={`text-sm font-bold ${
                  ordersTrend > 0
                    ? 'text-green-600 dark:text-green-400'
                    : ordersTrend < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {ordersTrend !== 0 && `${ordersTrend > 0 ? '+' : ''}${ordersTrend}%`}
                {ordersTrend === 0 && '—'}
              </span>
            </div>
          </div>
          <div className="mb-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {dailyStats.today.orders}
            </span>
            <span className="text-gray-600 dark:text-gray-400 text-sm ml-2">orders</span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            vs{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {dailyStats.yesterday.orders}
            </span>{' '}
            yesterday
          </div>
        </div>

        {/* Revenue Today Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp
                className="w-5 h-5 text-green-600 dark:text-green-400"
                aria-hidden="true"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Revenue Today
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {renderTrendIcon(revenueTrend)}
              <span
                className={`text-sm font-bold ${
                  revenueTrend > 0
                    ? 'text-green-600 dark:text-green-400'
                    : revenueTrend < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {revenueTrend !== 0 && `${revenueTrend > 0 ? '+' : ''}${revenueTrend}%`}
                {revenueTrend === 0 && '—'}
              </span>
            </div>
          </div>
          <div className="mb-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(dailyStats.today.revenue)}
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            vs{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(dailyStats.yesterday.revenue)}
            </span>{' '}
            yesterday
          </div>
        </div>
      </div>
    </section>
  );
});

export default DashboardTodayPerformance;
