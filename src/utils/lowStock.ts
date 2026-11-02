import type { WooCommerceProduct } from '../types';

export function isLowStock(p: WooCommerceProduct, threshold: number): boolean {
  return (
    !!p.manage_stock &&
    p.stock_quantity !== null &&
    p.stock_quantity !== undefined &&
    p.stock_quantity > 0 &&
    p.stock_quantity <= threshold
  );
}

/**
 * Products that newly crossed into low stock. `alerted` holds ids already notified and
 * still low; `next` is the new alerted set (recovered/removed products are dropped so
 * they can notify again later).
 */
export function detectLowStockCrossings(
  products: WooCommerceProduct[],
  threshold: number,
  alerted: ReadonlySet<number>
): { crossed: WooCommerceProduct[]; next: Set<number> } {
  const next = new Set<number>();
  const crossed: WooCommerceProduct[] = [];
  for (const p of products) {
    if (!isLowStock(p, threshold)) continue;
    next.add(p.id);
    if (!alerted.has(p.id)) crossed.push(p);
  }
  return { crossed, next };
}

export function lowStockMessage(crossed: WooCommerceProduct[]): string | null {
  const first = crossed[0];
  if (!first) return null;
  return crossed.length === 1
    ? `${first.name} has only ${first.stock_quantity} left`
    : `${crossed.length} products low on stock`;
}
