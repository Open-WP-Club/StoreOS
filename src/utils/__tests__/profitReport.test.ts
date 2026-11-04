import { describe, it, expect } from 'vitest';
import { computeProfit } from '../profitReport';
import { getCost, costMeta, META_COST } from '../costPrice';
import type { Order } from '../../types';

const order = (
  status: string,
  items: Array<[number, number, string]>,
  date = '2026-01-10T00:00:00'
): Order =>
  ({
    status,
    date_created: date,
    line_items: items.map(([product_id, quantity, total]) => ({
      product_id,
      quantity,
      total,
      name: `P${product_id}`,
    })),
  }) as unknown as Order;
const prod = (id: number, cost?: string) => ({
  id,
  meta_data: cost === undefined ? [] : [{ key: META_COST, value: cost }],
});

describe('costPrice', () => {
  it('reads and writes cost meta', () => {
    expect(getCost(prod(1, '2.5'))).toBe(2.5);
    expect(getCost(prod(1))).toBeNull();
    expect(getCost(prod(1, 'abc'))).toBeNull();
    expect(costMeta(3)).toEqual({ key: META_COST, value: '3' });
    expect(costMeta(null).value).toBe('');
  });
});

describe('computeProfit', () => {
  const since = new Date('2026-01-01');
  it('computes revenue, COGS, margin and excludes non-completed/old orders', () => {
    const r = computeProfit(
      [
        order('completed', [
          [1, 2, '20'],
          [2, 1, '10'],
        ]),
        order('cancelled', [[1, 5, '50']]),
        order('refunded', [[1, 5, '50']]),
        order('completed', [[1, 1, '10']], '2025-01-01T00:00:00'),
      ],
      [prod(1, '4'), prod(2)],
      since
    );
    expect(r.revenue).toBe(30);
    expect(r.cogs).toBe(8);
    expect(r.grossProfit).toBe(22);
    expect(r.margin).toBeCloseTo(73.33, 1);
    expect(r.missingCost).toBe(1);
    expect(r.products[0]?.productId).toBe(1);
  });
  it('handles no sales', () => {
    expect(computeProfit([], [], since).margin).toBeNull();
  });
});
