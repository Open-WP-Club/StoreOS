import { customerOrderStats, normalizeEmail, NON_REVENUE } from './customerProfile';
import type { Customer, WooCommerceOrder } from '../types';

export const SEGMENTS = [
  'Champions',
  'Loyal',
  'At risk',
  'New',
  'Lost',
  'One-time',
  'No orders',
] as const;
export type Segment = (typeof SEGMENTS)[number];

export interface CustomerSegment {
  customer: Customer;
  segment: Segment;
  /** 1-5 quintile scores; 0 when the customer has no orders. */
  r: number;
  f: number;
  m: number;
  orders: number;
  revenue: number;
  lastOrderDate: string | null;
}

export interface SegmentSummary {
  segment: Segment;
  count: number;
  revenue: number;
  revenueShare: number;
}

export interface CohortRow {
  /** YYYY-MM of first order */
  month: string;
  size: number;
  /** retention[k] = share of the cohort ordering k months after the first order */
  retention: number[];
}

export interface CustomerSegmentation {
  rows: CustomerSegment[];
  summary: SegmentSummary[];
  /** Customers with 2+ orders / customers with 1+ orders. */
  repeatRate: number;
  cohorts: CohortRow[];
}

export const NEW_DAYS = 30;
const DAY = 86_400_000;

/** Quintile 1-5 (5 best). Ties share a score (mid-rank), so a single value scores 3. */
function quintiles(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const first = new Map<number, number>();
  const last = new Map<number, number>();
  sorted.forEach((v, i) => {
    if (!first.has(v)) first.set(v, i);
    last.set(v, i + 1);
  });
  return values.map((v) => {
    const mid = ((first.get(v) as number) + (last.get(v) as number)) / 2 / n;
    return Math.min(5, Math.floor(mid * 5) + 1);
  });
}

const monthIndex = (iso: string): number =>
  Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const monthLabel = (idx: number): string =>
  `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;

/**
 * Computes RFM segments + cohorts in O(customers + orders): orders are indexed once by customer id
 * and normalized email (same matching rule as ordersForCustomer, without the per-customer scan).
 */
export function segmentCustomers(
  customers: Customer[],
  orders: WooCommerceOrder[],
  now: number = Date.now(),
  cohortMonths = 6
): CustomerSegmentation {
  const byId = new Map<number, WooCommerceOrder[]>();
  const byEmail = new Map<string, WooCommerceOrder[]>();
  const push = <K>(m: Map<K, WooCommerceOrder[]>, k: K, o: WooCommerceOrder): void => {
    const l = m.get(k);
    if (l) l.push(o);
    else m.set(k, [o]);
  };
  for (const o of orders) {
    if (o.customer_id) push(byId, o.customer_id, o);
    const e = normalizeEmail(o.billing?.email);
    if (e) push(byEmail, e, o);
  }

  const base = customers.map((customer) => {
    const email = normalizeEmail(customer.email);
    const list = [
      ...new Set([...(byId.get(customer.id) ?? []), ...(email ? (byEmail.get(email) ?? []) : [])]),
    ];
    const stats = customerOrderStats(list);
    const counted = list.filter((o) => !NON_REVENUE.has(o.status));
    const last = counted.reduce<string | null>(
      (m, o) => (m === null || o.date_created > m ? o.date_created : m),
      null
    );
    return { customer, stats, counted, last };
  });

  const active = base.filter((b) => b.stats.count > 0);
  const days = (b: (typeof base)[number]): number =>
    Math.max(0, (now - new Date(b.last as string).getTime()) / DAY);
  const rS = quintiles(active.map((b) => -days(b)));
  const fS = quintiles(active.map((b) => b.stats.count));
  const mS = quintiles(active.map((b) => b.stats.lifetimeValue));
  const scores = new Map(active.map((b, i) => [b, [rS[i], fS[i], mS[i]] as number[]]));

  const rows: CustomerSegment[] = base.map((b) => {
    const [r = 0, f = 0, m = 0] = scores.get(b) ?? [];
    let segment: Segment;
    if (b.stats.count === 0) segment = 'No orders';
    else if (b.stats.count === 1) segment = days(b) <= NEW_DAYS ? 'New' : 'One-time';
    else if (r >= 4 && f >= 4 && m >= 4) segment = 'Champions';
    else if (r <= 2) segment = f >= 3 ? 'At risk' : 'Lost';
    else segment = 'Loyal';
    return {
      customer: b.customer,
      segment,
      r,
      f,
      m,
      orders: b.stats.count,
      revenue: b.stats.lifetimeValue,
      lastOrderDate: b.last,
    };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const summary = SEGMENTS.map((segment) => {
    const inSeg = rows.filter((r) => r.segment === segment);
    const revenue = inSeg.reduce((s, r) => s + r.revenue, 0);
    return {
      segment,
      count: inSeg.length,
      revenue,
      revenueShare: totalRevenue ? revenue / totalRevenue : 0,
    };
  });

  const repeatRate = active.length
    ? active.filter((b) => b.stats.count > 1).length / active.length
    : 0;

  // Cohorts: first revenue-order month; retention = share with an order k months later.
  const cohortMap = new Map<number, Set<number>[]>();
  for (const b of active) {
    const months = new Set(b.counted.map((o) => monthIndex(o.date_created)));
    const start = Math.min(...months);
    const l = cohortMap.get(start);
    if (l) l.push(months);
    else cohortMap.set(start, [months]);
  }
  const cohorts = [...cohortMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, members]) => ({
      month: monthLabel(start),
      size: members.length,
      retention: Array.from(
        { length: cohortMonths + 1 },
        (_, k) => members.filter((m) => m.has(start + k)).length / members.length
      ),
    }));

  return { rows, summary, repeatRate, cohorts };
}

export function segmentCsvRows(
  rows: CustomerSegment[],
  segment: Segment
): Record<string, unknown>[] {
  return rows
    .filter((r) => r.segment === segment)
    .map((r) => ({
      name: `${r.customer.first_name ?? ''} ${r.customer.last_name ?? ''}`.trim(),
      email: r.customer.email,
      segment: r.segment,
      orders: r.orders,
      revenue: r.revenue.toFixed(2),
      lastOrder: r.lastOrderDate ?? '',
      r: r.r,
      f: r.f,
      m: r.m,
    }));
}

export const SEGMENT_CSV_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'segment', label: 'Segment' },
  { key: 'orders', label: 'Orders' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'lastOrder', label: 'Last order' },
  { key: 'r', label: 'R' },
  { key: 'f', label: 'F' },
  { key: 'm', label: 'M' },
];
