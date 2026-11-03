export interface Discount {
  type: 'percent' | 'fixed';
  value: number;
}

interface PricedLine {
  price: number;
  quantity: number;
  discount?: Discount | null;
}

/** Default cap: no discount (line or sale) may exceed this share of its base. Overridable via the `maxPercent` params (app setting). */
export const MAX_DISCOUNT_PERCENT = 50;

/** All money math runs in integer cents so totals never drift by a cent. */
export const toCents = (n: number): number => Math.round((n + Number.EPSILON) * 100);
export const fromCents = (c: number): number => c / 100;

/** Discount in cents on a base, clamped to [0, MAX_DISCOUNT_PERCENT of base] (and to the base). */
export function discountCents(
  baseCents: number,
  d?: Discount | null,
  maxPercent: number = MAX_DISCOUNT_PERCENT
): number {
  if (!d || !(d.value > 0) || baseCents <= 0) return 0;
  const raw = d.type === 'percent' ? Math.round((baseCents * d.value) / 100) : toCents(d.value);
  return Math.min(raw, baseCents, Math.floor((baseCents * maxPercent) / 100));
}

export interface PricedTotals {
  lines: Array<{ grossCents: number; discountCents: number; netCents: number }>;
  subtotalCents: number;
  lineDiscountCents: number;
  saleDiscountCents: number;
  totalCents: number;
}

/** Line discounts first, then the sale-level discount on the remaining net. */
export function computeTotals(
  lines: PricedLine[],
  sale?: Discount | null,
  maxPercent: number = MAX_DISCOUNT_PERCENT
): PricedTotals {
  const priced = lines.map((l) => {
    const grossCents = toCents(l.price) * l.quantity;
    const d = discountCents(grossCents, l.discount, maxPercent);
    return { grossCents, discountCents: d, netCents: grossCents - d };
  });
  const subtotalCents = priced.reduce((s, l) => s + l.grossCents, 0);
  const lineDiscountCents = priced.reduce((s, l) => s + l.discountCents, 0);
  const saleDiscountCents = discountCents(subtotalCents - lineDiscountCents, sale, maxPercent);
  return {
    lines: priced,
    subtotalCents,
    lineDiscountCents,
    saleDiscountCents,
    totalCents: subtotalCents - lineDiscountCents - saleDiscountCents,
  };
}

const money = (cents: number): string => fromCents(cents).toFixed(2);

/**
 * Woo line items: a discounted line carries `subtotal` (pre-discount) and `total` (post-discount),
 * which is how Woo itself records coupon discounts. The sale-level discount is a negative fee line.
 */
export function buildDiscountOrderParts(
  cart: Array<PricedLine & { productId: number }>,
  sale: Discount | null | undefined,
  totals: PricedTotals
): {
  line_items: Array<Record<string, unknown>>;
  fee_lines?: Array<{ name: string; total: string }>;
} {
  const line_items = cart.map((l, i) => {
    const t = totals.lines[i];
    return {
      product_id: l.productId,
      quantity: l.quantity,
      ...(t && t.discountCents > 0 && { subtotal: money(t.grossCents), total: money(t.netCents) }),
    };
  });
  if (totals.saleDiscountCents <= 0) return { line_items };
  const name = sale?.type === 'percent' ? `Отстъпка ${sale.value}%` : 'Отстъпка';
  return { line_items, fee_lines: [{ name, total: '-' + money(totals.saleDiscountCents) }] };
}
