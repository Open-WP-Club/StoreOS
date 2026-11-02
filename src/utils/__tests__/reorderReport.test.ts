import { describe, it, expect } from 'vitest';
import { buildReorderReport, suggestQty, getSupplier, salesByProduct } from '../reorderReport';
import type { Product, Order } from '../../types';

const NOW = Date.parse('2026-06-30T00:00:00Z');
const daysAgo = (d: number): string => new Date(NOW - d * 86_400_000).toISOString();

const prod = (o: Partial<Product>): Product =>
  ({ id: 1, name: 'P', sku: 'S', manage_stock: true, stock_quantity: 3, meta_data: [], ...o }) as Product;
const order = (status: string, d: number, items: Array<[number, number, number?]>): Order =>
  ({
    status,
    date_created: daysAgo(d),
    line_items: items.map(([product_id, quantity, variation_id = 0]) => ({
      product_id,
      quantity,
      variation_id,
    })),
  }) as unknown as Order;

describe('reorderReport', () => {
  it('low stock with zero sales: suggests nothing, daysLeft null', () => {
    const [r] = buildReorderReport([prod({})], [], { lowStockThreshold: 5, now: NOW });
    expect(r).toMatchObject({ sold30d: 0, daysLeft: null, suggestedQty: 0 });
  });

  it('excludes well-stocked slow sellers', () => {
    const rows = buildReorderReport(
      [prod({ stock_quantity: 100 })],
      [order('completed', 1, [[1, 3]])],
      { lowStockThreshold: 5, now: NOW }
    );
    expect(rows).toHaveLength(0);
  });

  it('includes fast sell-through above threshold and rounds up', () => {
    // 31 sold / 30d, stock 20 -> 30d need 31 -> 11
    const rows = buildReorderReport(
      [prod({ stock_quantity: 20 })],
      [order('processing', 2, [[1, 31]])],
      { lowStockThreshold: 5, now: NOW }
    );
    expect(rows[0]).toMatchObject({ suggestedQty: 11, daysLeft: 19.4 });
  });

  it('ignores cancelled, refunded, failed orders and old orders', () => {
    const orders = [
      order('cancelled', 1, [[1, 10]]),
      order('refunded', 1, [[1, 10]]),
      order('failed', 1, [[1, 10]]),
      order('completed', 45, [[1, 10]]),
      order('completed', 1, [[1, 3]]),
    ];
    expect(salesByProduct(orders, NOW).get(1)).toBe(3);
  });

  it('counts variations toward parent and themselves', () => {
    const m = salesByProduct(
      [
        order('completed', 1, [
          [1, 2, 11],
          [1, 1, 12],
        ]),
      ],
      NOW
    );
    expect(m.get(1)).toBe(3);
    expect(m.get(11)).toBe(2);
    const rows = buildReorderReport(
      [prod({ id: 11, stock_quantity: 0 })],
      [order('completed', 1, [[1, 3, 11]])],
      { lowStockThreshold: 5, targetDays: 30, now: NOW }
    );
    expect(rows[0]?.suggestedQty).toBe(3);
  });

  it('skips unmanaged stock and respects target days', () => {
    expect(
      buildReorderReport([prod({ manage_stock: false })], [], { lowStockThreshold: 5, now: NOW })
    ).toHaveLength(0);
    expect(suggestQty(0, 1, 60)).toBe(60);
    expect(suggestQty(100, 1, 30)).toBe(0);
  });

  it('groups by supplier meta, Unassigned last', () => {
    const rows = buildReorderReport(
      [
        prod({ id: 1 }),
        prod({ id: 2, meta_data: [{ id: 1, key: '_supplier', value: 'Acme' }] }),
        prod({ id: 3, meta_data: [{ id: 2, key: 'supplier', value: 'Beta' }] }),
      ],
      [],
      { lowStockThreshold: 5, now: NOW }
    );
    expect(rows.map((r) => r.supplier)).toEqual(['Acme', 'Beta', 'Unassigned']);
    expect(getSupplier(prod({ meta_data: [{ id: 1, key: 'supplier', value: '  ' }] }))).toBe(
      'Unassigned'
    );
  });
});
