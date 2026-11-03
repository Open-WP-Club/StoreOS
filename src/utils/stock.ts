/** The one low-stock rule: stock at or below the threshold (inclusive). Unknown stock is never low. */
export function isStockAtOrBelow(quantity: number | null | undefined, threshold: number): boolean {
  return quantity != null && quantity <= threshold;
}
