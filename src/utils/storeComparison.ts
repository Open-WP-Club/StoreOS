import { isStockAtOrBelow } from './stock';
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
  currency: string;
  symbol: string;
  /** Orders that count toward revenue/AOV (internal, for weighted combined AOV). */
  revenueOrders: number;
}

/** Totals for stores sharing one currency; currencies are never summed together. */
export interface CurrencyTotal {
  currency: string;
  symbol: string;
  revenue: number;
  orders: number;
  aov: number;
  lowStock: number;
}

export interface StoreComparisonInput {
  storeId: string;
  name: string;
  orders: Order[];
  products: Product[];
  error: string | null;
  currency?: string;
  symbol?: string;
}

/** Revenue/orders/AOV for the last `days` days (KPI rules: refunded/failed/cancelled excluded). */
export function compareStores(
  inputs: StoreComparisonInput[],
  days: number,
  lowStockThreshold: number
): { rows: StoreComparisonRow[]; totals: CurrencyTotal[] } {
  const rows = inputs.map((s): StoreComparisonRow => {
    const base = {
      storeId: s.storeId,
      name: s.name,
      currency: s.currency ?? '',
      symbol: s.symbol ?? '',
    };
    if (s.error) {
      return {
        ...base,
        revenue: 0,
        orders: 0,
        aov: 0,
        lowStock: 0,
        revenueOrders: 0,
        error: s.error,
      };
    }
    const { current } = filterOrdersByPeriod(s.orders, days);
    const kpis = calculateRevenueKPIs({ current, previous: [] });
    return {
      ...base,
      revenue: kpis.totalRevenue.current,
      orders: current.length,
      aov: kpis.averageOrderValue.current,
      lowStock: s.products.filter((p) => isStockAtOrBelow(p.stock_quantity, lowStockThreshold))
        .length,
      revenueOrders: current.filter(
        (o) => !['refunded', 'failed', 'cancelled', 'trash', 'checkout-draft'].includes(o.status)
      ).length,
      error: null,
    };
  });

  // One combined row per currency; combined AOV = revenue / revenue-orders, not an average of averages.
  const groups = new Map<string, StoreComparisonRow[]>();
  for (const r of rows) {
    if (r.error) continue;
    groups.set(r.currency, [...(groups.get(r.currency) ?? []), r]);
  }
  const totals = [...groups.entries()].map(([currency, rs]): CurrencyTotal => {
    const revenue = rs.reduce((a, r) => a + r.revenue, 0);
    const revenueOrders = rs.reduce((a, r) => a + r.revenueOrders, 0);
    return {
      currency,
      symbol: rs[0]?.symbol ?? '',
      revenue,
      orders: rs.reduce((a, r) => a + r.orders, 0),
      aov: revenueOrders > 0 ? revenue / revenueOrders : 0,
      lowStock: rs.reduce((a, r) => a + r.lowStock, 0),
    };
  });
  return { rows, totals };
}
