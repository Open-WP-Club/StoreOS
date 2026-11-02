import { describe, it, expect } from 'vitest';
import { detectLowStockCrossings, lowStockMessage } from '../lowStock';
import useSettings from '../../stores/settingsStore';
import type { WooCommerceProduct } from '../../types';

const p = (id: number, qty: number | null, manage = true) =>
  ({ id, name: `P${id}`, manage_stock: manage, stock_quantity: qty }) as WooCommerceProduct;

describe('detectLowStockCrossings', () => {
  it('flags only managed products in 1..threshold', () => {
    const { crossed } = detectLowStockCrossings(
      [p(1, 3), p(2, 0), p(3, 50), p(4, null), p(5, 2, false)],
      5,
      new Set()
    );
    expect(crossed.map((x) => x.id)).toEqual([1]);
  });

  it('dedupes until recovery', () => {
    const first = detectLowStockCrossings([p(1, 3)], 5, new Set());
    expect(first.crossed).toHaveLength(1);
    const again = detectLowStockCrossings([p(1, 2)], 5, first.next);
    expect(again.crossed).toHaveLength(0);
    const recovered = detectLowStockCrossings([p(1, 20)], 5, again.next);
    expect(recovered.next.size).toBe(0);
    expect(detectLowStockCrossings([p(1, 3)], 5, recovered.next).crossed).toHaveLength(1);
  });

  it('aggregates message', () => {
    expect(lowStockMessage([])).toBeNull();
    expect(lowStockMessage([p(1, 2)])).toBe('P1 has only 2 left');
    expect(lowStockMessage([p(1, 2), p(2, 1)])).toBe('2 products low on stock');
  });
});

describe('notifyLowStock setting', () => {
  it('defaults to on', () => {
    expect(useSettings.getState().notifyLowStock).toBe(true);
  });
});
