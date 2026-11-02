import { posReportRows, orderReportRows } from '../reportRows';
import type { Order } from '../../types';
import type { RecentTransaction } from '../../hooks/usePOSDailyReport';

const tx = (o: Partial<RecentTransaction>): RecentTransaction =>
  ({
    id: 1,
    timestamp: '2026-01-02T10:00:00Z',
    paymentMethod: 'cash',
    total: 5,
    ...o,
  }) as RecentTransaction;
const start = Date.parse('2026-01-02T00:00:00Z');
const end = Date.parse('2026-01-03T00:00:00Z');

describe('reportRows', () => {
  it('filters POS transactions by range and refunded flag', () => {
    const rows = posReportRows(
      [tx({}), tx({ id: 2, refunded: true }), tx({ id: 3, timestamp: '2026-01-03T00:00:00Z' })],
      start,
      end
    );
    expect(rows).toEqual([{ ref: '#1', time: '2026-01-02T10:00:00Z', detail: 'cash', total: 5 }]);
  });

  it('filters orders by status and range', () => {
    const o = (id: number, status: string, d: string): Order =>
      ({ id, status, date_created: d, date_created_gmt: d, total: '12.5' }) as Order;
    const rows = orderReportRows(
      [
        o(1, 'completed', '2026-01-02T10:00:00Z'),
        o(2, 'cancelled', '2026-01-02T10:00:00Z'),
        o(3, 'completed', '2026-02-01T10:00:00Z'),
      ],
      start,
      end
    );
    expect(rows.map((r) => r.ref)).toEqual(['#1']);
    expect(rows[0]!.total).toBe(12.5);
  });
});
