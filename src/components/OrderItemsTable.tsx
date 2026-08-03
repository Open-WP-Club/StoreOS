import { ReactElement } from 'react';
import { ZoomIn, Package } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import type { Order, OrderLineItem, OrderCouponLine, OrderRefund, WooCommerceMetaData } from '../types';

interface OrderItemsTableProps {
  order: Order;
  onOpenLightbox: (itemIndex: number) => void;
}

/**
 * Order line items table with product images, meta, and order totals summary.
 */
export function OrderItemsTable({ order, onOpenLightbox }: OrderItemsTableProps): ReactElement {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order Items</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-16">
                Image
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {(order.line_items || []).map((item: OrderLineItem, itemIndex: number) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="px-4 py-4">
                  {item.image?.src ? (
                    <button
                      onClick={() => onOpenLightbox(itemIndex)}
                      className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:scale-105 transition-transform group"
                      title={`Виж ${item.name}`}
                    >
                      <img
                        src={item.image.src}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                        <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.name}
                  </div>
                  {item.sku && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      SKU: {item.sku}
                    </div>
                  )}
                  {item.meta_data && item.meta_data.length > 0 && (
                    <div className="mt-1">
                      {item.meta_data.map((meta: WooCommerceMetaData, idx: number) => (
                        <div key={idx} className="text-xs text-gray-500 dark:text-gray-400">
                          {String(meta.key)}: {String(meta.value)}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                  {formatPrice(item.price, order.currency_symbol)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                  {item.quantity}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {formatPrice(parseFloat(item.total), order.currency_symbol)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order Totals */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Items Subtotal:</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {formatPrice(
                (order.line_items || []).reduce((sum: number, item: OrderLineItem) => sum + parseFloat(item.subtotal || item.total), 0),
                order.currency_symbol
              )}
            </span>
          </div>

          {order.coupon_lines && order.coupon_lines.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Coupon(s): {order.coupon_lines.map((c: OrderCouponLine) => c.code).join(', ')}
              </span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                -{formatPrice(
                  order.coupon_lines.reduce((sum: number, c: OrderCouponLine) => sum + parseFloat(c.discount), 0),
                  order.currency_symbol
                )}
              </span>
            </div>
          )}

          {order.shipping_total && parseFloat(order.shipping_total) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Shipping{order.shipping_lines?.[0]?.method_title ?
                  ` (${order.shipping_lines[0].method_title})` : ''}:
              </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatPrice(parseFloat(order.shipping_total), order.currency_symbol)}
              </span>
            </div>
          )}

          {order.total_tax && parseFloat(order.total_tax) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tax:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatPrice(parseFloat(order.total_tax), order.currency_symbol)}
              </span>
            </div>
          )}

          {order.discount_total && parseFloat(order.discount_total) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Discount:</span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                -{formatPrice(parseFloat(order.discount_total), order.currency_symbol)}
              </span>
            </div>
          )}

          <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-300 dark:border-gray-600">
            <span className="text-gray-900 dark:text-white">Order Total:</span>
            <span className="text-gray-900 dark:text-white">
              {formatPrice(parseFloat(order.total), order.currency_symbol)}
            </span>
          </div>

          {order.refunds && order.refunds.length > 0 && (
            <div className="flex justify-between text-sm text-red-600 dark:text-red-400 pt-1">
              <span>Refunded:</span>
              <span className="font-medium">
                -{formatPrice(
                  order.refunds.reduce((sum: number, r: OrderRefund) => sum + Math.abs(parseFloat(r.total)), 0),
                  order.currency_symbol
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderItemsTable;
