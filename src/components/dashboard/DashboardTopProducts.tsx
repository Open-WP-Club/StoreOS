import React from 'react';
import { Link } from 'react-router-dom';
import type { TopProduct } from '../../hooks/useDashboardStats';

interface Props {
  topProducts: TopProduct[];
  formatCurrency: (n: number) => string;
}

const DashboardTopProducts = React.memo(function DashboardTopProducts({
  topProducts,
  formatCurrency,
}: Props) {
  if (topProducts.length === 0) return null;

  return (
    <section
      aria-labelledby="top-products-heading"
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 transition-colors"
    >
      <h2
        id="top-products-heading"
        className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
      >
        Top Selling Products
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 font-medium">#</th>
              <th className="pb-2 font-medium">Product</th>
              <th className="pb-2 font-medium text-right">Qty Sold</th>
              <th className="pb-2 font-medium text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {topProducts.map((product, index) => (
              <tr key={product.id} className="text-sm">
                <td className="py-3 text-gray-500 dark:text-gray-400">{index + 1}</td>
                <td className="py-3">
                  <Link
                    to={`/products/${product.id}`}
                    className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                  >
                    {product.name}
                  </Link>
                </td>
                <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                  {product.quantitySold}
                </td>
                <td className="py-3 text-right font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(product.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});

export default DashboardTopProducts;
