/**
 * Shared constants for StoreOS - Built for WooCommerce
 */

import type { Product, Order, Customer, Coupon, OrderStatus } from '../types';

// ============================================
// Empty Arrays (for stable React references)
// ============================================

/**
 * Empty arrays with stable references to prevent unnecessary re-renders.
 * Using these instead of inline [] ensures referential equality.
 */
export const EMPTY_ARRAY: never[] = [];
export const EMPTY_PRODUCTS: Product[] = [];
export const EMPTY_ORDERS: Order[] = [];
export const EMPTY_CUSTOMERS: Customer[] = [];
export const EMPTY_COUPONS: Coupon[] = [];

// ============================================
// Status Colors
// ============================================

/**
 * Order status to Tailwind CSS color class mapping
 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  'on-hold': 'bg-gray-100 text-gray-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-purple-100 text-purple-800',
  failed: 'bg-red-100 text-red-800',
  trash: 'bg-gray-100 text-gray-800',
  'checkout-draft': 'bg-gray-100 text-gray-800',
};

/**
 * Get the color class for an order status
 * @param status - The order status
 * @returns Tailwind CSS classes for the status badge
 */
export const getOrderStatusColor = (status: OrderStatus): string =>
  ORDER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';

/**
 * Product stock status to Tailwind CSS color class mapping
 */
export const STOCK_STATUS_COLORS: Record<string, string> = {
  instock: 'bg-green-100 text-green-800',
  outofstock: 'bg-red-100 text-red-800',
  onbackorder: 'bg-yellow-100 text-yellow-800',
};

/**
 * Get the color class for a stock status
 * @param status - The stock status
 * @returns Tailwind CSS classes for the status badge
 */
export const getStockStatusColor = (status: string): string =>
  STOCK_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
