import type { Product } from '../types';

/** Product meta key holding the unit cost (shared with the cost-price feature). */
export const META_COST = '_storeos_cost';

/** Cost stored on a product, or null when unset/invalid. */
export function getCost(p: Pick<Product, 'meta_data'>): number | null {
  const v = p.meta_data?.find((m) => m.key === META_COST)?.value;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** meta_data entry to send to WooCommerce for a cost. */
export const costMeta = (cost: number): { key: string; value: string } => ({
  key: META_COST,
  value: String(cost),
});
