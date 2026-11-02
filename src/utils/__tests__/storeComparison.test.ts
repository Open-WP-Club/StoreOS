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

  it('computes per-store revenue, orders, AOV, low stock for the period', () => {
    const { rows } = compareStores([a, b], 30, 5);
    expect(rows[0]).toMatchObject({ revenue: 150, orders: 3, aov: 75, lowStock: 1 });
    expect(rows[1]).toMatchObject({ revenue: 30, orders: 1, aov: 30, lowStock: 1 });
  });

  it('combined AOV is weighted, not an average of averages', () => {
    const { total } = compareStores([a, b], 30, 5);
    expect(total).toMatchObject({ revenue: 180, orders: 4, lowStock: 2 });
    expect(total.aov).toBe(60);
  });

  it('excludes errored stores from the total', () => {
    const { rows, total } = compareStores([a, { ...b, error: 'boom' }], 30, 5);
    expect(rows[1]?.error).toBe('boom');
    expect(total.revenue).toBe(150);
  });

  it('handles no orders', () => {
    expect(compareStores([], 7, 5).total).toEqual({ revenue: 0, orders: 0, aov: 0, lowStock: 0 });
  });
});
