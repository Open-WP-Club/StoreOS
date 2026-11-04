import { describe, it, expect } from 'vitest';
import { segmentCustomers, segmentCsvRows } from '../customerSegments';
import { createMockCustomer, createMockOrder } from '../../__test_utils__/mockFactories';
import type { Customer } from '../../types';

const NOW = Date.parse('2026-06-15T00:00:00Z');
const cust = (id: number): Customer =>
  createMockCustomer({ id, email: `c${id}@x.com` }) as unknown as Customer;
const order = (customerId: number, date: string, total = '10', status = 'completed') =>
  createMockOrder({
    customer_id: customerId,
    date_created: date,
    total,
    status,
    billing: { email: `c${customerId}@x.com` },
  } as never);
const seg = (r: ReturnType<typeof segmentCustomers>, id: number) =>
  r.rows.find((x) => x.customer.id === id)?.segment;

describe('segmentCustomers', () => {
  it('handles empty input', () => {
    const r = segmentCustomers([], [], NOW);
    expect(r.rows).toEqual([]);
    expect(r.repeatRate).toBe(0);
    expect(r.cohorts).toEqual([]);
  });

  it('customer with no orders is "No orders" with zero scores', () => {
    const r = segmentCustomers([cust(1)], [], NOW);
    expect(r.rows[0]).toMatchObject({ segment: 'No orders', r: 0, revenue: 0 });
  });

  it('single customer: New when recent, One-time when old; no division errors', () => {
    expect(seg(segmentCustomers([cust(1)], [order(1, '2026-06-10T00:00:00')], NOW), 1)).toBe('New');
    const old = segmentCustomers([cust(1)], [order(1, '2026-01-10T00:00:00')], NOW);
    expect(seg(old, 1)).toBe('One-time');
    expect(old.rows[0]).toMatchObject({ r: 3, f: 3, m: 3 });
  });

  it('assigns Champions, At risk and Lost by RFM; ties share a score', () => {
    const customers = [1, 2, 3, 4, 5].map(cust);
    const orders = [
      ...[1, 2, 3, 4, 5].map((i) => order(1, `2026-06-0${i}T00:00:00`, '100')),
      ...[1, 2, 3, 4].map((i) => order(2, `2025-01-0${i}T00:00:00`, '30')),
      order(3, '2024-01-01T00:00:00', '5'),
      order(3, '2024-01-02T00:00:00', '5'),
      order(4, '2026-05-14T00:00:00', '20'),
      order(4, '2026-05-14T00:00:00', '20'),
      order(4, '2026-05-14T00:00:00', '20'),
      order(5, '2026-05-14T00:00:00', '20'),
      order(5, '2026-05-14T00:00:00', '20'),
      order(5, '2026-05-14T00:00:00', '20'),
    ];
    const r = segmentCustomers(customers, orders, NOW);
    expect(seg(r, 1)).toBe('Champions');
    expect(seg(r, 2)).toBe('At risk');
    expect(seg(r, 3)).toBe('Lost');
    const [a, b] = [r.rows[3], r.rows[4]];
    expect([a?.r, a?.f, a?.m]).toEqual([b?.r, b?.f, b?.m]);
    expect(r.repeatRate).toBe(1);
    expect(r.summary.reduce((s, x) => s + x.revenueShare, 0)).toBeCloseTo(1);
  });

  it('matches guest orders by email and ignores cancelled orders', () => {
    const o = createMockOrder({
      customer_id: 0,
      date_created: '2026-06-10T00:00:00',
      total: '10',
      status: 'completed',
      billing: { email: 'C1+tag@X.com' },
    } as never);
    const cancelled = order(1, '2026-06-11T00:00:00', '99', 'cancelled');
    const r = segmentCustomers([cust(1)], [o, cancelled], NOW);
    expect(r.rows[0]).toMatchObject({ orders: 1, revenue: 10, segment: 'New' });
  });

  it('builds monthly cohort retention', () => {
    const customers = [1, 2].map(cust);
    const orders = [
      order(1, '2026-01-05T00:00:00'),
      order(1, '2026-02-10T00:00:00'),
      order(2, '2026-01-20T00:00:00'),
    ];
    const r = segmentCustomers(customers, orders, NOW);
    expect(r.cohorts).toHaveLength(1);
    expect(r.cohorts[0]).toMatchObject({ month: '2026-01', size: 2 });
    expect(r.cohorts[0]?.retention.slice(0, 3)).toEqual([1, 0.5, 0]);
  });

  it('handles 5000 customers quickly', () => {
    const customers = Array.from({ length: 5000 }, (_, i) => cust(i + 1));
    const orders = customers.map((c) => order(c.id, '2026-05-01T00:00:00'));
    const t = Date.now();
    segmentCustomers(customers, orders, NOW);
    expect(Date.now() - t).toBeLessThan(2000);
  });

  it('segmentCsvRows filters by segment', () => {
    const r = segmentCustomers([cust(1), cust(2)], [order(1, '2026-06-10T00:00:00')], NOW);
    expect(segmentCsvRows(r.rows, 'New')).toHaveLength(1);
    expect(segmentCsvRows(r.rows, 'No orders')[0]).toMatchObject({ email: 'c2@x.com' });
  });
});
