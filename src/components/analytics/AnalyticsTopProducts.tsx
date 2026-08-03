import React from 'react';
import type { TopProduct } from '../../hooks/useAnalyticsData';

interface AnalyticsTopProductsProps {
  products: TopProduct[];
  formatCurrency: (amount: number) => string;
}

function AnalyticsTopProducts({
  products,
  formatCurrency,
}: AnalyticsTopProductsProps): React.ReactElement {
  return (
    <section
      aria-labelledby="top-products-heading"
      className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
    >
      <h2
        id="top-products-heading"
        className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
      >
        Top 5 Products by Revenue
      </h2>
      {products.length > 0 ? (
        <div className="overflow-x-auto">
          <table
            className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
            aria-label="Top products by revenue"
          >
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['Rank', 'Product', 'Units Sold', 'Revenue'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {products.map((product, index) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {product.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(product.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No product data available
        </div>
      )}
    </section>
  );
}

export default React.memo(AnalyticsTopProducts);
