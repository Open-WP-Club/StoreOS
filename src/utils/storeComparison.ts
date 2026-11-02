import { calculateRevenueKPIs, filterOrdersByPeriod } from './kpiCalculator';
import type { Order, Product } from '../types';

export interface StoreComparisonRow {
  storeId: string;
  name: string;
  revenue: number;
  orders: number;
  aov: number;
  lowStock: number;
  /** Set when the store failed to load; metrics are then excluded from the total. */
  error: string | null;
}

export interface StoreComparisonInput {
  storeId: string;
  name: string;
  orders: Order[];
  products: Product[];
  error: string | null;
}

/** Revenue/orders/AOV for the last `days` days (KPI rules: refunded/failed/cancelled excluded). */
export function compareStores(
  inputs: StoreComparisonInput[],
  days: number,
  lowStockThreshold: number
): { rows: StoreComparisonRow[]; total: Omit<StoreComparisonRow, 'storeId' | 'name' | 'error'> } {
  const rows = inputs.map((s): StoreComparisonRow => {
    if (s.error) {
      return {
        storeId: s.storeId,
        name: s.name,
        revenue: 0,
        orders: 0,
        aov: 0,
        lowStock: 0,
        error: s.error,
      };
    }
    const { current } = filterOrdersByPeriod(s.orders, days);
    const kpis = calculateRevenueKPIs({ current, previous: [] });
    const lowStock = s.products.filter(
      (p) =>
        p.stock_quantity !== null &&
        p.stock_quantity !== undefined &&
        p.stock_quantity <= lowStockThreshold
    ).length;
    return {
      storeId: s.storeId,
      name: s.name,
      revenue: kpis.totalRevenue.current,
      orders: current.length,
      aov: kpis.averageOrderValue.current,
      lowStock,
      error: null,
    };
  });

  // Combined AOV = combined revenue / combined revenue-orders, not an average of averages.
  const ok = rows.filter((r) => !r.error);
  const revenue = ok.reduce((a, r) => a + r.revenue, 0);
  const orders = ok.reduce((a, r) => a + r.orders, 0);
  const revenueOrders = inputs
    .filter((s) => !s.error)
    .reduce(
      (a, s) =>
        a +
        filterOrdersByPeriod(s.orders, days).current.filter(
          (o) => !['refunded', 'failed', 'cancelled', 'trash', 'checkout-draft'].includes(o.status)
        ).length,
      0
    );
  return {
    rows,
    total: {
      revenue,
      orders,
      aov: revenueOrders > 0 ? revenue / revenueOrders : 0,
      lowStock: ok.reduce((a, r) => a + r.lowStock, 0),
    },
  };
}
