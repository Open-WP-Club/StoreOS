import { getCost } from './costPrice';
import type { Order } from '../types';

export interface ProductProfit {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
  cogs: number;
  profit: number;
  /** percent of revenue, null when revenue is 0 */
  margin: number | null;
}

export interface ProfitReport {
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number | null;
  /** products sold in the period with no cost set (their COGS counts as 0) */
  missingCost: number;
  /** sorted by profit, best first */
  products: ProductProfit[];
}

type CostedProduct = { id: number; meta_data?: Array<{ key: string; value: unknown }> };

/**
 * Gross profit from orders x cached product cost. Only `completed` orders count, matching
 * FinancialAnalyticsPage (cancelled/refunded/failed/etc. are excluded). Line revenue is the
 * line total excluding tax. Variations use the parent product's cost. Partial refunds are
 * not deducted (order.refunds carries no line detail).
 */
export function computeProfit(
  orders: Order[],
  products: CostedProduct[],
  since: Date
): ProfitReport {
  const costs = new Map(products.map((p) => [p.id, getCost(p)]));
  const byProduct = new Map<number, ProductProfit>();
  const noCost = new Set<number>();
  for (const o of orders) {
    if (o.status !== 'completed' || new Date(o.date_created) < since) continue;
    for (const li of o.line_items ?? []) {
      const cost = costs.get(li.product_id) ?? null;
      if (cost === null) noCost.add(li.product_id);
      const row = byProduct.get(li.product_id) ?? {
        productId: li.product_id,
        name: li.name,
        quantity: 0,
        revenue: 0,
        cogs: 0,
        profit: 0,
        margin: null,
      };
      row.quantity += li.quantity;
      row.revenue += parseFloat(li.total) || 0;
      row.cogs += (cost ?? 0) * li.quantity;
      byProduct.set(li.product_id, row);
    }
  }
  const list = [...byProduct.values()].map((r) => ({
    ...r,
    profit: r.revenue - r.cogs,
    margin: r.revenue > 0 ? ((r.revenue - r.cogs) / r.revenue) * 100 : null,
  }));
  const revenue = list.reduce((s, r) => s + r.revenue, 0);
  const cogs = list.reduce((s, r) => s + r.cogs, 0);
  return {
    revenue,
    cogs,
    grossProfit: revenue - cogs,
    margin: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : null,
    missingCost: noCost.size,
    products: list.sort((a, b) => b.profit - a.profit),
  };
}
