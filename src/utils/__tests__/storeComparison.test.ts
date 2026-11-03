import { describe, it, expect } from 'vitest';
import { compareStores } from '../storeComparison';
import type { Order, Product } from '../../types';

const daysAgo = (n: number): string => new Date(Date.now() - n * 86400000).toISOString();
const order = (total: string, status = 'completed', age = 1): Order =>
  ({ id: Math.random(), total, status, date_created: daysAgo(age) }) as unknown as Order;
const product = (q: number | null): Product => ({ stock_quantity: q }) as unknown as Product;

describe('compareStores', () => {
  const a = {
    storeId: 'a',
    name: 'A',
    orders: [order('100'), order('50'), order('999', 'refunded'), order('500', 'completed', 40)],
    products: [product(2), product(50), product(null)],
    error: null,
  };
  const b = { storeId: 'b', name: 'B', orders: [order('30')], products: [product(0)], error: null };
  const eur = { ...b, storeId: 'c', name: 'C', currency: 'EUR', symbol: '€' };

  it('computes per-store revenue, orders, AOV, low stock for the period', () => {
    const { rows } = compareStores([a, b], 30, 5);
    expect(rows[0]).toMatchObject({ revenue: 150, orders: 3, aov: 75, lowStock: 1 });
    expect(rows[1]).toMatchObject({ revenue: 30, orders: 1, aov: 30, lowStock: 1 });
  });

  it('combined AOV is weighted, not an average of averages', () => {
    const { totals } = compareStores([a, b], 30, 5);
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ revenue: 180, orders: 4, lowStock: 2 });
    expect(totals[0]?.aov).toBe(60);
  });

  it('never sums different currencies', () => {
    const { totals } = compareStores([{ ...a, currency: 'USD', symbol: '$' }, eur], 30, 5);
    expect(totals.map((t) => [t.currency, t.revenue])).toEqual([
      ['USD', 150],
      ['EUR', 30],
    ]);
  });

  it('excludes errored stores from the total', () => {
    const { rows, totals } = compareStores([a, { ...b, error: 'boom' }], 30, 5);
    expect(rows[1]?.error).toBe('boom');
    expect(totals[0]?.revenue).toBe(150);
  });

  it('handles no orders', () => {
    expect(compareStores([], 7, 5).totals).toEqual([]);
  });
});
