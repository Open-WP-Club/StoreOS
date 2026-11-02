import type { Order } from '../types';
import type { RecentTransaction } from '../hooks/usePOSDailyReport';

export interface ReportRow extends Record<string, unknown> {
  ref: string;
  time: string;
  detail: string;
  total: number;
}

const EXCLUDED_STATUSES = new Set(['cancelled', 'failed', 'refunded', 'trash']);

const inRange = (iso: string, start: number, end: number): boolean => {
  const t = new Date(iso).getTime();
  return t >= start && t < end;
};

/** Non-refunded POS transactions with timestamp in [start, end) (epoch ms). */
export function posTransactionsInRange(
  txs: RecentTransaction[],
  start: number,
  end: number
): RecentTransaction[] {
  return txs.filter((tx) => !tx.refunded && inRange(tx.timestamp, start, end));
}

/** Report rows for POS transactions in [start, end). */
export function posReportRows(txs: RecentTransaction[], start: number, end: number): ReportRow[] {
  return posTransactionsInRange(txs, start, end).map((tx) => ({
    ref: `#${tx.id}`,
    time: tx.timestamp,
    detail: tx.paymentMethod,
    total: tx.total,
  }));
}

/** Report rows for non-cancelled/failed/refunded orders created in [start, end). */
export function orderReportRows(orders: Order[], start: number, end: number): ReportRow[] {
  return orders
    .filter(
      (o) =>
        !EXCLUDED_STATUSES.has(o.status) &&
        inRange(o.date_created_gmt || o.date_created, start, end)
    )
    .map((o) => ({
      ref: `#${o.id}`,
      time: o.date_created,
      detail: o.status,
      total: parseFloat(o.total) || 0,
    }));
}
