import type { Order, Product } from '../types';

export const UNASSIGNED_SUPPLIER = 'Unassigned';
export const DEFAULT_TARGET_DAYS = 30;
export const VELOCITY_WINDOW_DAYS = 30;
const SUPPLIER_KEYS = ['supplier', '_supplier', 'supplier_name', '_supplier_name'];
// Orders that represent real demand (cancelled/refunded/failed/pending/trash excluded).
const COUNTED_STATUSES = new Set(['processing', 'completed', 'on-hold']);

export interface ReorderRow {
  id: number;
  name: string;
  sku: string;
  supplier: string;
  stock: number;
  sold30d: number;
  dailyVelocity: number;
  /** null when there were no sales (infinite cover) */
  daysLeft: number | null;
  suggestedQty: number;
}

type OrderLike = Pick<Order, 'status' | 'date_created' | 'line_items'>;

/** Units sold per product id (parent) and per variation id within the window. */
export function salesByProduct(
  orders: OrderLike[],
  now: number = Date.now(),
  windowDays: number = VELOCITY_WINDOW_DAYS
): Map<number, number> {
  const since = now - windowDays * 86_400_000;
  const sold = new Map<number, number>();
  for (const o of orders) {
    if (!COUNTED_STATUSES.has(o.status)) continue;
    const t = Date.parse(o.date_created);
    if (!(t >= since && t <= now)) continue;
    for (const li of o.line_items ?? []) {
      const qty = li.quantity > 0 ? li.quantity : 0;
      sold.set(li.product_id, (sold.get(li.product_id) ?? 0) + qty);
      if (li.variation_id) sold.set(li.variation_id, (sold.get(li.variation_id) ?? 0) + qty);
    }
  }
  return sold;
}

export function getSupplier(p: Pick<Product, 'meta_data'>): string {
  for (const key of SUPPLIER_KEYS) {
    const m = p.meta_data?.find((md) => md.key.toLowerCase() === key);
    if (m && typeof m.value !== 'object' && String(m.value).trim()) return String(m.value).trim();
  }
  return UNASSIGNED_SUPPLIER;
}

/** Suggested qty to reach `targetDays` of cover, rounded up, never negative. */
export function suggestQty(stock: number, dailyVelocity: number, targetDays: number): number {
  return Math.max(0, Math.ceil(Number((dailyVelocity * targetDays - stock).toFixed(6))));
}

/**
 * Products that are at/below the low-stock threshold, or that will run out within
 * `targetDays` at the current sell-through, with a suggested reorder quantity.
 * Sorted by supplier (Unassigned last), then most urgent first.
 */
export function buildReorderReport(
  products: Product[],
  orders: OrderLike[],
  opts: { lowStockThreshold: number; targetDays?: number; now?: number }
): ReorderRow[] {
  const targetDays = opts.targetDays ?? DEFAULT_TARGET_DAYS;
  const sold = salesByProduct(orders, opts.now);
  const rows: ReorderRow[] = [];
  for (const p of products) {
    if (!p.manage_stock || p.stock_quantity == null) continue;
    const stock = Math.max(0, p.stock_quantity);
    const sold30d = sold.get(p.id) ?? 0;
    const dailyVelocity = sold30d / VELOCITY_WINDOW_DAYS;
    const daysLeft = dailyVelocity > 0 ? Math.round((stock / dailyVelocity) * 10) / 10 : null;
    const low = stock <= opts.lowStockThreshold;
    const fast = daysLeft !== null && daysLeft < targetDays;
    if (!low && !fast) continue;
    rows.push({
      id: p.id,
      name: p.name,
      sku: p.sku,
      supplier: getSupplier(p),
      stock,
      sold30d,
      dailyVelocity: Math.round(dailyVelocity * 100) / 100,
      daysLeft,
      suggestedQty: suggestQty(stock, dailyVelocity, targetDays),
    });
  }
  return rows.sort(
    (a, b) =>
      (a.supplier === UNASSIGNED_SUPPLIER ? 1 : 0) - (b.supplier === UNASSIGNED_SUPPLIER ? 1 : 0) ||
      a.supplier.localeCompare(b.supplier) ||
      (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity)
  );
}
