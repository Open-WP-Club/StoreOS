import React, { ChangeEvent } from 'react';
import Pagination from './Pagination';
import OrderTableRow from './OrderTableRow';
import type { Order } from '../types';

interface OrdersTableProps {
  paginatedOrders: Order[];
  selectedOrderIds: number[];
  onSelectAll: (e: ChangeEvent<HTMLInputElement>) => void;
  onSelectOrder: (orderId: number) => void;
  onStatusChange: (orderId: number, newStatus: string) => Promise<void>;
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
}

function OrdersTable({
  paginatedOrders,
  selectedOrderIds,
  onSelectAll,
  onSelectOrder,
  onStatusChange,
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: OrdersTableProps): React.ReactElement {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-3 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={
                    selectedOrderIds.length === paginatedOrders.length && paginatedOrders.length > 0
                  }
                  onChange={onSelectAll}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Order ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No orders found
                </td>
              </tr>
            ) : (
              paginatedOrders.map((order) => (
                <OrderTableRow
                  key={order.id}
                  order={order}
                  isSelected={selectedOrderIds.includes(order.id)}
                  onSelect={onSelectOrder}
                  onStatusChange={onStatusChange}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

export default OrdersTable;
