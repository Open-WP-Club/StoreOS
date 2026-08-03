/**
 * KPI Calculator Engine
 *
 * Pure functions for computing KPI metrics from cached orders and products.
 * No React dependencies - can be used anywhere.
 */

import useSettings from '../stores/settingsStore';
import type { WooCommerceOrder, WooCommerceProduct } from '../types';

// ============================================
// Types
// ============================================

export type KPIDirection = 'up' | 'down' | 'flat';

export interface KPIValue {
  current: number;
  previous: number;
  changePercent: number;
  direction: KPIDirection;
}

export interface RevenueKPIs {
  totalRevenue: KPIValue;
  averageOrderValue: KPIValue;
  revenueGrowthRate: number;
}

export interface CustomerKPIs {
  repeatPurchaseRate: KPIValue;
  avgItemsPerOrder: KPIValue;
  customerLifetimeValue: KPIValue;
}

export interface OperationsKPIs {
  refundRate: KPIValue;
  orderCompletionRate: KPIValue;
  avgProcessingTimeDays: KPIValue;
}

export interface InventoryKPIs {
  stockTurnoverRate: KPIValue;
  inventoryValue: KPIValue;
  lowStockCount: KPIValue;
}

export interface ParetoProduct {
  name: string;
  revenue: number;
  percentage: number;
}

export interface ConcentrationKPIs {
  top20RevenueShare: number;
  paretoProducts: ParetoProduct[];
}

export interface AllKPIs {
  revenue: RevenueKPIs;
  customer: CustomerKPIs;
  operations: OperationsKPIs;
  inventory: InventoryKPIs;
  concentration: ConcentrationKPIs;
}

// ============================================
// Helpers
// ============================================

interface PeriodOrders {
  current: WooCommerceOrder[];
  previous: WooCommerceOrder[];
}

/**
 * Split orders into current and previous period for comparison.
 * Current = last N days, Previous = N days before that.
 */
export function filterOrdersByPeriod(orders: WooCommerceOrder[], days: number): PeriodOrders {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - days);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  const current: WooCommerceOrder[] = [];
  const previous: WooCommerceOrder[] = [];

  for (const order of orders) {
    const orderDate = new Date(order.date_created);
    if (orderDate >= currentStart) {
      current.push(order);
    } else if (orderDate >= previousStart) {
      previous.push(order);
    }
  }

  return { current, previous };
}

/**
 * Build a KPIValue from current and previous period values.
 */
export function buildKPIValue(current: number, previous: number): KPIValue {
  let changePercent = 0;
  if (previous > 0) {
    changePercent = ((current - previous) / previous) * 100;
  } else if (current > 0) {
    changePercent = 100;
  }

  let direction: KPIDirection = 'flat';
  if (changePercent > 0.5) direction = 'up';
  else if (changePercent < -0.5) direction = 'down';

  return {
    current,
    previous,
    changePercent: Math.round(changePercent * 10) / 10,
    direction,
  };
}

/** Only count orders that represent real revenue (not refunded/failed/cancelled). */
function isRevenueOrder(order: WooCommerceOrder): boolean {
  return !['refunded', 'failed', 'cancelled', 'trash', 'checkout-draft'].includes(order.status);
}

function sumRevenue(orders: WooCommerceOrder[]): number {
  return orders.filter(isRevenueOrder).reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
}

// ============================================
// KPI Group Calculators
// ============================================

export function calculateRevenueKPIs(periodOrders: PeriodOrders): RevenueKPIs {
  const { current, previous } = periodOrders;

  const currentRevenue = sumRevenue(current);
  const previousRevenue = sumRevenue(previous);

  const currentRevenueOrders = current.filter(isRevenueOrder);
  const previousRevenueOrders = previous.filter(isRevenueOrder);

  const currentAOV = currentRevenueOrders.length > 0 ? currentRevenue / currentRevenueOrders.length : 0;
  const previousAOV = previousRevenueOrders.length > 0 ? previousRevenue / previousRevenueOrders.length : 0;

  const revenueGrowthRate =
    previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : currentRevenue > 0 ? 100 : 0;

  return {
    totalRevenue: buildKPIValue(currentRevenue, previousRevenue),
    averageOrderValue: buildKPIValue(currentAOV, previousAOV),
    revenueGrowthRate: Math.round(revenueGrowthRate * 10) / 10,
  };
}

export function calculateCustomerKPIs(periodOrders: PeriodOrders): CustomerKPIs {
  const { current, previous } = periodOrders;

  // Repeat purchase rate: % of unique customers with 2+ orders
  const calcRepeatRate = (orders: WooCommerceOrder[]): number => {
    const revenueOrders = orders.filter(isRevenueOrder);
    const customerOrders = new Map<string, number>();
    for (const order of revenueOrders) {
      const key = order.customer_id > 0 ? String(order.customer_id) : order.billing.email;
      if (key) customerOrders.set(key, (customerOrders.get(key) || 0) + 1);
    }
    const totalCustomers = customerOrders.size;
    if (totalCustomers === 0) return 0;
    let repeats = 0;
    for (const count of customerOrders.values()) {
      if (count >= 2) repeats++;
    }
    return (repeats / totalCustomers) * 100;
  };

  // Average items per order (basket size)
  const calcBasketSize = (orders: WooCommerceOrder[]): number => {
    const revenueOrders = orders.filter(isRevenueOrder);
    if (revenueOrders.length === 0) return 0;
    const totalItems = revenueOrders.reduce(
      (sum, o) => sum + (o.line_items?.reduce((s, li) => s + li.quantity, 0) || 0),
      0
    );
    return totalItems / revenueOrders.length;
  };

  // CLV: average total spend per unique customer
  const calcCLV = (orders: WooCommerceOrder[]): number => {
    const revenueOrders = orders.filter(isRevenueOrder);
    const customerSpend = new Map<string, number>();
    for (const order of revenueOrders) {
      const key = order.customer_id > 0 ? String(order.customer_id) : order.billing.email;
      if (key) {
        customerSpend.set(key, (customerSpend.get(key) || 0) + parseFloat(order.total || '0'));
      }
    }
    if (customerSpend.size === 0) return 0;
    let totalSpend = 0;
    for (const spend of customerSpend.values()) totalSpend += spend;
    return totalSpend / customerSpend.size;
  };

  return {
    repeatPurchaseRate: buildKPIValue(calcRepeatRate(current), calcRepeatRate(previous)),
    avgItemsPerOrder: buildKPIValue(calcBasketSize(current), calcBasketSize(previous)),
    customerLifetimeValue: buildKPIValue(calcCLV(current), calcCLV(previous)),
  };
}

export function calculateOperationsKPIs(periodOrders: PeriodOrders): OperationsKPIs {
  const { current, previous } = periodOrders;

  // Refund rate: % of orders with status 'refunded'
  const calcRefundRate = (orders: WooCommerceOrder[]): number => {
    if (orders.length === 0) return 0;
    const refunded = orders.filter((o) => o.status === 'refunded').length;
    return (refunded / orders.length) * 100;
  };

  // Completion rate: % of orders with status 'completed'
  const calcCompletionRate = (orders: WooCommerceOrder[]): number => {
    if (orders.length === 0) return 0;
    const completed = orders.filter((o) => o.status === 'completed').length;
    return (completed / orders.length) * 100;
  };

  // Average processing time: date_created → date_completed (in days)
  const calcAvgProcessingTime = (orders: WooCommerceOrder[]): number => {
    const completedOrders = orders.filter((o) => o.status === 'completed' && o.date_completed);
    if (completedOrders.length === 0) return 0;
    let totalDays = 0;
    for (const order of completedOrders) {
      const created = new Date(order.date_created).getTime();
      const completed = new Date(order.date_completed!).getTime();
      totalDays += (completed - created) / (1000 * 60 * 60 * 24);
    }
    return totalDays / completedOrders.length;
  };

  return {
    refundRate: buildKPIValue(calcRefundRate(current), calcRefundRate(previous)),
    orderCompletionRate: buildKPIValue(calcCompletionRate(current), calcCompletionRate(previous)),
    avgProcessingTimeDays: buildKPIValue(calcAvgProcessingTime(current), calcAvgProcessingTime(previous)),
  };
}

export function calculateInventoryKPIs(
  periodOrders: PeriodOrders,
  products: WooCommerceProduct[]
): InventoryKPIs {
  const { current, previous } = periodOrders;

  // Units sold from line items
  const calcUnitsSold = (orders: WooCommerceOrder[]): number => {
    return orders
      .filter(isRevenueOrder)
      .reduce((sum, o) => sum + (o.line_items?.reduce((s, li) => s + li.quantity, 0) || 0), 0);
  };

  // Stock turnover: units sold / average stock quantity
  const totalStock = products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);

  const currentUnitsSold = calcUnitsSold(current);
  const previousUnitsSold = calcUnitsSold(previous);

  const avgStock = totalStock > 0 ? totalStock : 1; // avoid division by zero
  const currentTurnover = currentUnitsSold / avgStock;
  const previousTurnover = previousUnitsSold / avgStock;

  // Inventory value: sum of (stock_quantity * price) for all products
  const currentInventoryValue = products.reduce((sum, p) => {
    const qty = p.stock_quantity || 0;
    const price = parseFloat(p.price || '0');
    return sum + qty * price;
  }, 0);

  // Low stock count: stock_quantity between 1 and threshold, or out of stock
  const lowStockThreshold = useSettings.getState().lowStockThreshold;
  const currentLowStock =
    products.filter((p) => p.stock_quantity !== null && p.stock_quantity > 0 && p.stock_quantity <= lowStockThreshold).length +
    products.filter((p) => p.stock_status === 'outofstock').length;

  // Inventory doesn't have a previous period value (it's a snapshot), so set previous = current
  return {
    stockTurnoverRate: buildKPIValue(currentTurnover, previousTurnover),
    inventoryValue: buildKPIValue(currentInventoryValue, currentInventoryValue),
    lowStockCount: buildKPIValue(currentLowStock, currentLowStock),
  };
}

export function calculateConcentrationKPIs(
  orders: WooCommerceOrder[]
): ConcentrationKPIs {
  const revenueOrders = orders.filter(isRevenueOrder);

  // Aggregate revenue per product
  const productRevenue = new Map<number, { name: string; revenue: number }>();
  for (const order of revenueOrders) {
    for (const item of order.line_items || []) {
      const existing = productRevenue.get(item.product_id);
      const itemRevenue = parseFloat(String(item.total)) || 0;
      if (existing) {
        existing.revenue += itemRevenue;
      } else {
        productRevenue.set(item.product_id, { name: item.name, revenue: itemRevenue });
      }
    }
  }

  // Sort by revenue descending
  const sorted = Array.from(productRevenue.values()).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);

  // Top 20% products' share
  const top20Count = Math.max(1, Math.ceil(sorted.length * 0.2));
  const top20Revenue = sorted.slice(0, top20Count).reduce((sum, p) => sum + p.revenue, 0);
  const top20RevenueShare = totalRevenue > 0 ? (top20Revenue / totalRevenue) * 100 : 0;

  // Top 10 products for chart
  const paretoProducts: ParetoProduct[] = sorted.slice(0, 10).map((p) => ({
    name: p.name.length > 25 ? p.name.substring(0, 22) + '...' : p.name,
    revenue: p.revenue,
    percentage: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
  }));

  return {
    top20RevenueShare: Math.round(top20RevenueShare * 10) / 10,
    paretoProducts,
  };
}

// ============================================
// Main Calculator
// ============================================

export function calculateAllKPIs(
  orders: WooCommerceOrder[],
  products: WooCommerceProduct[],
  periodDays: number
): AllKPIs {
  const periodOrders = filterOrdersByPeriod(orders, periodDays);

  return {
    revenue: calculateRevenueKPIs(periodOrders),
    customer: calculateCustomerKPIs(periodOrders),
    operations: calculateOperationsKPIs(periodOrders),
    inventory: calculateInventoryKPIs(periodOrders, products),
    concentration: calculateConcentrationKPIs(periodOrders.current),
  };
}
