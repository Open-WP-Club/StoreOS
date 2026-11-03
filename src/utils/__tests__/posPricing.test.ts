import { describe, it, expect } from 'vitest';
import { computeTotals, discountCents, buildDiscountOrderParts } from '../posPricing';

describe('posPricing', () => {
  it('rounds percent discounts to the cent (half up)', () => {
    // 10% of 0.05 = 0.005 -> 1 cent after rounding of 0.5
    expect(discountCents(5, { type: 'percent', value: 10 })).toBe(1);
    // 33.33% of 10.00 = 3.333 -> 3.33
    expect(discountCents(1000, { type: 'percent', value: 33.33 })).toBe(333);
  });

  it('avoids float drift in sums', () => {
    const t = computeTotals([
      { price: 0.1, quantity: 3 },
      { price: 0.2, quantity: 1 },
    ]);
    expect(t.subtotalCents).toBe(50);
    expect(t.totalCents).toBe(50);
  });

  it('caps discounts at the max share and never goes negative', () => {
    expect(discountCents(1000, { type: 'percent', value: 90 })).toBe(500);
    expect(discountCents(1000, { type: 'fixed', value: 999 })).toBe(500);
    expect(discountCents(1000, { type: 'fixed', value: -5 })).toBe(0);
    expect(discountCents(0, { type: 'fixed', value: 5 })).toBe(0);
  });

  it('applies line discounts first, then the sale discount on the remainder', () => {
    const t = computeTotals(
      [
        { price: 10, quantity: 2, discount: { type: 'percent', value: 10 } }, // 20 -> 18
        { price: 5, quantity: 1 },
      ],
      { type: 'fixed', value: 3 }
    );
    expect(t.lineDiscountCents).toBe(200);
    expect(t.saleDiscountCents).toBe(300);
    expect(t.totalCents).toBe(2500 - 200 - 300);
  });

  it('maps to Woo: subtotal/total on discounted lines, negative fee for the sale discount', () => {
    const cart = [
      { productId: 1, price: 9.99, quantity: 3, discount: { type: 'percent' as const, value: 15 } },
      { productId: 2, price: 4, quantity: 1 },
    ];
    const sale = { type: 'percent' as const, value: 10 };
    const t = computeTotals(cart, sale);
    const parts = buildDiscountOrderParts(cart, sale, t);
    // 29.97 gross, 15% = 4.4955 -> 4.50 (cents round), net 25.47
    expect(parts.line_items[0]).toEqual({
      product_id: 1,
      quantity: 3,
      subtotal: '29.97',
      total: '25.47',
    });
    expect(parts.line_items[1]).toEqual({ product_id: 2, quantity: 1 });
    // (25.47 + 4.00) * 10% = 2.947 -> 2.95
    expect(parts.fee_lines).toEqual([{ name: 'Отстъпка 10%', total: '-2.95' }]);
    expect(t.totalCents).toBe(2547 + 400 - 295);
  });

  it('omits fee_lines without a sale discount', () => {
    const cart = [{ productId: 1, price: 5, quantity: 1 }];
    const t = computeTotals(cart, { type: 'percent', value: 0 });
    expect(buildDiscountOrderParts(cart, null, t).fee_lines).toBeUndefined();
  });
});
