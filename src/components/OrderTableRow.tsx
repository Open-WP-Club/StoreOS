import React, { memo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Loader2 } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import { formatDate } from '../utils/dateTime';
import { getOrderStatusColor } from '../constants';
import type { WooCommerceOrder, OrderStatus } from '../types';

const ORDER_STATUSES: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: 'Pending Payment' },
  { value: 'processing', label: 'Processing' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
];

interface OrderTableRowProps {
  order: WooCommerceOrder;
  isSelected: boolean;
  onSelect: (orderId: number) => void;
  onStatusChange?: (orderId: number, newStatus: string) => Promise<void>;
}

const OrderTableRow = memo(function OrderTableRow({
  order,
  isSelected,
  onSelect,
  onStatusChange,
}: OrderTableRowProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<OrderStatus>(order.status as OrderStatus);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync if parent updates order
  useEffect(() => {
    setOptimisticStatus(order.status as OrderStatus);
  }, [order.status]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleStatusSelect = async (newStatus: OrderStatus) => {
    setOpen(false);
    if (newStatus === optimisticStatus || !onStatusChange) return;

    const previous = optimisticStatus;
    setOptimisticStatus(newStatus);
    setUpdating(true);
    try {
      await onStatusChange(order.id, newStatus);
    } catch {
      setOptimisticStatus(previous);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(order.id)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
        <Link
          to={`/orders/${order.id}`}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
        >
          #{order.id}
        </Link>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900 dark:text-white">
          {order.billing.first_name} {order.billing.last_name}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{order.billing.email}</div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {formatDate(order.date_created)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        {onStatusChange ? (
          <div className="relative inline-block" ref={dropdownRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              disabled={updating}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs leading-5 font-semibold rounded-full cursor-pointer transition-opacity ${getOrderStatusColor(optimisticStatus)} ${updating ? 'opacity-60' : 'hover:opacity-80'}`}
            >
              {updating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : null}
              {optimisticStatus}
              <ChevronDown className="w-3 h-3" />
            </button>
            {open && (
              <div className="absolute z-50 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg min-w-[160px]">
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleStatusSelect(s.value);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${s.value === optimisticStatus ? 'font-semibold' : ''}`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${getOrderStatusColor(s.value).split(' ')[0]}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getOrderStatusColor(order.status)}`}
          >
            {order.status}
          </span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {formatPrice(order.total, order.currency_symbol)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm">
        <Link
          to={`/orders/${order.id}`}
          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
        >
          View Details
        </Link>
      </td>
    </tr>
  );
});

export default OrderTableRow;
