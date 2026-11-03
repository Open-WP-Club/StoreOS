/** The one low-stock rule: stock at or below the threshold (inclusive). Unknown stock is never low. */
export function isStockAtOrBelow(quantity: number | null | undefined, threshold: number): boolean {
  return quantity != null && quantity <= threshold;
}

/** Low stock but still available: quantity in 1..threshold. Out-of-stock (0) is not "low". */
export function isLowButInStock(quantity: number | null | undefined, threshold: number): boolean {
  return quantity != null && quantity > 0 && quantity <= threshold;
}

/** Out of stock per WooCommerce's stock_status. */
export function isOutOfStock(p: { stock_status?: string }): boolean {
  return p.stock_status === 'outofstock';
}
