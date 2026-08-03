import { ChangeEvent, ReactElement, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import type { Order, OrderStatus } from '../types';

interface OrderSidebarProps {
  order: Order;
  updatingStatus: boolean;
  onStatusUpdate: (newStatus: OrderStatus) => Promise<void>;
}

/**
 * Order sidebar: status actions, billing/shipping addresses, payment details, order meta.
 */
function buildAddress(addr: Order['billing'] | Order['shipping']): string {
  if (!addr) return '';
  return [
    [addr.first_name, addr.last_name].filter(Boolean).join(' '),
    'company' in addr ? addr.company : '',
    addr.address_1,
    addr.address_2,
    [addr.city, addr.state, addr.postcode].filter(Boolean).join(', '),
    addr.country,
  ]
    .filter(Boolean)
    .join('\n');
}

function CopyButton({ text }: { text: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function OrderSidebar({ order, updatingStatus, onStatusUpdate }: OrderSidebarProps): ReactElement {
  return (
    <div className="space-y-6">
      {/* Order Actions */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order Actions</h2>
        </div>
        <div className="px-6 py-4">
          <label htmlFor="order-status-update" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Update Status
          </label>
          <select
            id="order-status-update"
            value={order.status || 'pending'}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onStatusUpdate(e.target.value as OrderStatus)}
            disabled={updatingStatus}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 transition-colors"
          >
            <option value="pending">Pending Payment</option>
            <option value="processing">Processing</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>
          {updatingStatus && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Updating...</p>
          )}
        </div>
      </div>

      {/* Customer Details */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Details</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          {order.billing && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Billing Address</h3>
                <CopyButton text={buildAddress(order.billing)} />
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                {(order.billing.first_name || order.billing.last_name) && (
                  <p className="font-medium">
                    {order.billing.first_name || ''} {order.billing.last_name || ''}
                  </p>
                )}
                {order.billing.company && <p>{order.billing.company}</p>}
                {order.billing.address_1 && <p>{order.billing.address_1}</p>}
                {order.billing.address_2 && <p>{order.billing.address_2}</p>}
                {(order.billing.city || order.billing.state || order.billing.postcode) && (
                  <p>
                    {[order.billing.city, order.billing.state, order.billing.postcode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {order.billing.country && <p>{order.billing.country}</p>}
                {order.billing.email && (
                  <p className="pt-2 flex items-center gap-1">
                    <a href={`mailto:${order.billing.email}`} className="text-blue-600 hover:underline">
                      {order.billing.email}
                    </a>
                    <CopyButton text={order.billing.email} />
                  </p>
                )}
                {order.billing.phone && (
                  <p className="flex items-center gap-1">
                    <a href={`tel:${order.billing.phone}`} className="text-blue-600 hover:underline">
                      {order.billing.phone}
                    </a>
                    <CopyButton text={order.billing.phone} />
                  </p>
                )}
              </div>
            </div>
          )}

          {order.shipping && (
            order.shipping.address_1 ||
            order.shipping.first_name ||
            order.shipping.last_name
          ) && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Shipping Address</h3>
                <CopyButton text={buildAddress(order.shipping)} />
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                {(order.shipping.first_name || order.shipping.last_name) && (
                  <p className="font-medium">
                    {order.shipping.first_name || ''} {order.shipping.last_name || ''}
                  </p>
                )}
                {order.shipping.company && <p>{order.shipping.company}</p>}
                {order.shipping.address_1 && <p>{order.shipping.address_1}</p>}
                {order.shipping.address_2 && <p>{order.shipping.address_2}</p>}
                {(order.shipping.city || order.shipping.state || order.shipping.postcode) && (
                  <p>
                    {[order.shipping.city, order.shipping.state, order.shipping.postcode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {order.shipping.country && <p>{order.shipping.country}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Details */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Details</h2>
        </div>
        <div className="px-6 py-4 space-y-2">
          {order.payment_method_title && (
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Method: </span>
              <span className="text-sm text-gray-900 dark:text-white">{order.payment_method_title}</span>
            </div>
          )}
          {order.transaction_id && (
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Transaction ID: </span>
              <span className="text-sm text-gray-900 dark:text-white font-mono">{order.transaction_id}</span>
              <CopyButton text={order.transaction_id} />
            </div>
          )}
          <div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Status: </span>
            <span className={`text-sm font-semibold ${
              order.date_paid ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
            }`}>
              {order.date_paid ? 'Paid' : 'Unpaid'}
            </span>
          </div>
          {order.date_paid && (
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Date Paid: </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {new Date(order.date_paid).toLocaleString()}
              </span>
            </div>
          )}
          {order.date_completed && (
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Date Completed: </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {new Date(order.date_completed).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Order Meta */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order Information</h2>
        </div>
        <div className="px-6 py-4 space-y-2">
          <div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Order Number: </span>
            <span className="text-sm text-gray-900 dark:text-white">#{order.number || order.id}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Created: </span>
            <span className="text-sm text-gray-900 dark:text-white">
              {new Date(order.date_created).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Modified: </span>
            <span className="text-sm text-gray-900 dark:text-white">
              {new Date(order.date_modified).toLocaleString()}
            </span>
          </div>
          {order.customer_id > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer ID: </span>
              <span className="text-sm text-gray-900 dark:text-white">{order.customer_id}</span>
            </div>
          )}
          {order.customer_ip_address && (
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer IP: </span>
              <span className="text-sm text-gray-900 dark:text-white font-mono">{order.customer_ip_address}</span>
            </div>
          )}
          {order.customer_user_agent && (
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">User Agent: </span>
              <span className="text-xs text-gray-900 dark:text-white break-all">{order.customer_user_agent}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderSidebar;
