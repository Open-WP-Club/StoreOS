import React, { ChangeEvent } from 'react';
import { X } from 'lucide-react';
import type { OrderFilters } from '../types';

interface OrdersAdvancedFiltersProps {
  filters: OrderFilters;
  onFilterChange: (patch: Partial<OrderFilters>) => void;
  hasActiveFilters: boolean;
  searchTerm: string;
  onClearAll: () => void;
  filteredOrdersCount: number;
  ordersCount: number;
}

function OrdersAdvancedFilters({
  filters,
  onFilterChange,
  hasActiveFilters,
  searchTerm,
  onClearAll,
  filteredOrdersCount,
  ordersCount,
}: OrdersAdvancedFiltersProps): React.ReactElement {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Advanced Filters</h3>
        {(hasActiveFilters || searchTerm) && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Order Status Filter */}
        <div>
          <label
            htmlFor="order-status-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Order Status
          </label>
          <select
            id="order-status-filter"
            value={filters.status}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onFilterChange({ status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Payment Method Filter */}
        <div>
          <label
            htmlFor="payment-method-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Payment Method
          </label>
          <select
            id="payment-method-filter"
            value={filters.paymentMethod}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onFilterChange({ paymentMethod: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Methods</option>
            <option value="bacs">Bank Transfer</option>
            <option value="cheque">Check</option>
            <option value="cod">Cash on Delivery</option>
            <option value="paypal">PayPal</option>
            <option value="stripe">Stripe</option>
          </select>
        </div>

        {/* Total Amount Range */}
        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Total Amount
          </span>
          <div className="flex gap-2">
            <input
              id="total-min"
              type="number"
              placeholder="Min"
              aria-label="Minimum total amount"
              value={filters.totalMin}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onFilterChange({ totalMin: e.target.value })
              }
              className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              id="total-max"
              type="number"
              placeholder="Max"
              aria-label="Maximum total amount"
              value={filters.totalMax}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onFilterChange({ totalMax: e.target.value })
              }
              className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label
            htmlFor="date-from"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            From Date
          </label>
          <input
            id="date-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange({ dateFrom: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="date-to"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            To Date
          </label>
          <input
            id="date-to"
            type="date"
            value={filters.dateTo}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange({ dateTo: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing{' '}
        <span className="font-semibold text-gray-900 dark:text-white">{filteredOrdersCount}</span>{' '}
        of <span className="font-semibold text-gray-900 dark:text-white">{ordersCount}</span> orders
      </div>
    </div>
  );
}

export default OrdersAdvancedFilters;
