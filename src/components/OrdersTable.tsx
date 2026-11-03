import React, { ChangeEvent } from 'react';
import Pagination from './Pagination';
import OrderTableRow from './OrderTableRow';
import { SortableTh } from './ListViewControls';
import type { Order, SortState } from '../types';
import { useVirtualRows } from '../hooks/useVirtualRows';

const NO_HIDDEN: string[] = [];
const TH =
  'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider';

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
  sort?: SortState | null;
  onSort?: (s: SortState | null) => void;
  hiddenColumns?: string[];
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
  sort = null,
  onSort,
  hiddenColumns = NO_HIDDEN,
}: OrdersTableProps): React.ReactElement {
  const {
    scrollContainer,
    enabled: virtualized,
    rows: visibleRows,
    padTop,
    padBottom,
  } = useVirtualRows(paginatedOrders);
  const selectedSet = new Set(selectedOrderIds);
  const show = (k: string): boolean => !hiddenColumns.includes(k);
  const sortTh = (label: string, key: string): React.ReactElement =>
    onSort ? (
      <SortableTh label={label} sortKey={key} sort={sort} onSort={onSort} />
    ) : (
      <th className={TH}>{label}</th>
    );
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors">
      <div
        ref={scrollContainer}
        className={virtualized ? 'overflow-auto max-h-[70vh]' : 'overflow-x-auto'}
      >
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead
            className={`bg-gray-50 dark:bg-gray-700${virtualized ? ' sticky top-0 z-10' : ''}`}
          >
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
              {show('customer') && <th className={TH}>Customer</th>}
              {show('date') && sortTh('Date', 'date')}
              {show('status') && sortTh('Status', 'status')}
              {show('total') && sortTh('Total', 'total')}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {padTop > 0 && (
              <tr aria-hidden="true" style={{ height: padTop }}>
                <td colSpan={99} className="p-0" />
              </tr>
            )}
            {paginatedOrders.length === 0 ? (
              <tr>
                <td colSpan={99} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No orders found
                </td>
              </tr>
            ) : (
              visibleRows.map((order) => (
                <OrderTableRow
                  key={order.id}
                  order={order}
                  isSelected={selectedSet.has(order.id)}
                  onSelect={onSelectOrder}
                  onStatusChange={onStatusChange}
                  hiddenColumns={hiddenColumns}
                />
              ))
            )}
            {padBottom > 0 && (
              <tr aria-hidden="true" style={{ height: padBottom }}>
                <td colSpan={99} className="p-0" />
              </tr>
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
