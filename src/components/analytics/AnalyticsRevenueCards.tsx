import React from 'react';
import type { RevenueStats, OrderStats, ProductStats } from '../../hooks/useAnalyticsData';

interface AnalyticsRevenueCardsProps {
  revenue: RevenueStats;
  orders: OrderStats;
  products: ProductStats;
  formatCurrency: (amount: number) => string;
}

function AnalyticsRevenueCards({
  revenue,
  orders,
  products,
  formatCurrency,
}: AnalyticsRevenueCardsProps): React.ReactElement {
  return (
    <section aria-labelledby="revenue-overview-heading">
      <h2 id="revenue-overview-heading" className="sr-only">
        Revenue Overview
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <article
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
          aria-label={`Total revenue: ${formatCurrency(revenue.total)}`}
        >
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(revenue.total)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            From {orders.completed} completed orders
          </div>
        </article>

        <article
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
          aria-label={`Average order value: ${formatCurrency(revenue.average)}`}
        >
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Average Order Value
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(revenue.average)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">Per completed order</div>
        </article>

        <article
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
          aria-label={`Pending revenue: ${formatCurrency(revenue.pending)}`}
        >
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Pending Revenue
          </div>
          <div className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {formatCurrency(revenue.pending)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            From {orders.processing + orders.pending} orders
          </div>
        </article>

        <article
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
          aria-label={`Inventory value: ${formatCurrency(products.inventoryValue)}`}
        >
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Inventory Value
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(products.inventoryValue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Across {products.total} products
          </div>
        </article>
      </div>
    </section>
  );
}

export default React.memo(AnalyticsRevenueCards);
