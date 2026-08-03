import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingCart, AlertCircle, Clock, LucideIcon } from 'lucide-react';
import type { StatsState, WeeklyStatsState } from '../../hooks/useDashboardStats';

type ColorKey = 'blue' | 'yellow' | 'green' | 'red';

interface ColorStyle {
  icon: string;
  value: string;
}

// Static color classes for Tailwind CSS (dynamic classes don't work with Tailwind's JIT)
export const STAT_CARD_COLORS: Record<ColorKey, ColorStyle> = {
  blue: {
    icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-600 dark:text-blue-400',
  },
  yellow: {
    icon: 'text-yellow-600 dark:text-yellow-400',
    value: 'text-yellow-600 dark:text-yellow-400',
  },
  green: {
    icon: 'text-green-600 dark:text-green-400',
    value: 'text-green-600 dark:text-green-400',
  },
  red: {
    icon: 'text-red-600 dark:text-red-400',
    value: 'text-red-600 dark:text-red-400',
  },
};

interface StatCard {
  title: string;
  value: number;
  link: string;
  color: ColorKey;
  icon: LucideIcon;
  ariaLabel: string;
}

interface Props {
  weeklyStats: WeeklyStatsState;
  pendingOrdersValue: number;
  inventoryValue: number;
  stats: StatsState;
  formatCurrency: (n: number) => string;
}

const DashboardWeeklyStats = React.memo(function DashboardWeeklyStats({
  weeklyStats,
  pendingOrdersValue,
  inventoryValue,
  stats,
  formatCurrency,
}: Props) {
  const statCards: StatCard[] = [
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      link: '/orders',
      color: 'blue',
      icon: ShoppingCart,
      ariaLabel: `View all ${stats.totalOrders} orders`,
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders,
      link: '/orders',
      color: 'yellow',
      icon: Clock,
      ariaLabel: `View ${stats.pendingOrders} pending orders`,
    },
    {
      title: 'Total Products',
      value: stats.totalProducts,
      link: '/products',
      color: 'green',
      icon: Package,
      ariaLabel: `View all ${stats.totalProducts} products`,
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStock,
      link: '/inventory',
      color: 'red',
      icon: AlertCircle,
      ariaLabel: `View ${stats.lowStock} low stock items`,
    },
  ];

  return (
    <>
      {/* Weekly Performance */}
      <section aria-labelledby="weekly-performance-heading" className="mb-6">
        <h2
          id="weekly-performance-heading"
          className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
        >
          This Week vs Last Week
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 transition-colors">
            <p className="text-sm text-gray-600 dark:text-gray-400">This Week Orders</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {weeklyStats.thisWeek.orders}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              vs {weeklyStats.lastWeek.orders} last week
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 transition-colors">
            <p className="text-sm text-gray-600 dark:text-gray-400">This Week Revenue</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(weeklyStats.thisWeek.revenue)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              vs {formatCurrency(weeklyStats.lastWeek.revenue)} last week
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 transition-colors">
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending Value</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatCurrency(pendingOrdersValue)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stats.pendingOrders} orders awaiting
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 transition-colors">
            <p className="text-sm text-gray-600 dark:text-gray-400">Inventory Value</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(inventoryValue)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stats.totalProducts} products
            </p>
          </div>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section aria-labelledby="quick-stats-heading">
        <h2 id="quick-stats-heading" className="sr-only">
          Quick Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <Link
                key={card.title}
                to={card.link}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={card.ariaLabel}
              >
                <div className="flex items-center justify-between mb-3">
                  <IconComponent
                    className={`w-8 h-8 ${STAT_CARD_COLORS[card.color]?.icon || ''}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-3xl font-bold ${STAT_CARD_COLORS[card.color]?.value || ''}`}
                  >
                    {card.value}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {card.title}
                </h3>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
});

export default DashboardWeeklyStats;
