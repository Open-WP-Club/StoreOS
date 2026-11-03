import type { Customer, WooCommerceOrder } from '../types';

export const DUPLICATE_TAG = 'duplicate';
const NON_REVENUE = new Set(['cancelled', 'refunded', 'failed', 'trash']);

/** Lowercase, trim, drop "+tag" from the local part. */
export function normalizeEmail(email?: string): string {
  const e = (email ?? '').trim().toLowerCase();
  const at = e.indexOf('@');
  return at < 1 ? e : `${e.slice(0, at).split('+')[0]}${e.slice(at)}`;
}

/** Digits only; too-short numbers are ignored (returns ''). */
export function normalizePhone(phone?: string): string {
  const d = (phone ?? '').replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-9) : '';
}

/** Case/accent/word-order-insensitive full name. */
export function normalizeName(c: Pick<Customer, 'first_name' | 'last_name'>): string {
  return `${c.first_name ?? ''} ${c.last_name ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** Orders belonging to a customer: by customer id, or billing email for guest checkouts. */
export function ordersForCustomer(
  customer: Customer,
  orders: WooCommerceOrder[]
): WooCommerceOrder[] {
  const email = normalizeEmail(customer.email);
  return orders.filter(
    (o) =>
      o.customer_id === customer.id || (email !== '' && normalizeEmail(o.billing?.email) === email)
  );
}

export interface CustomerOrderStats {
  count: number;
  lifetimeValue: number;
  average: number;
  lastOrderDate: string | null;
}

export function customerOrderStats(orders: WooCommerceOrder[]): CustomerOrderStats {
  const counted = orders.filter((o) => !NON_REVENUE.has(o.status));
  const lifetimeValue = counted.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
  const last = orders.reduce<string | null>(
    (m, o) => (m === null || o.date_created > m ? o.date_created : m),
    null
  );
  return {
    count: counted.length,
    lifetimeValue,
    average: counted.length ? lifetimeValue / counted.length : 0,
    lastOrderDate: last,
  };
}

export type DuplicateReason = 'email' | 'phone' | 'name';
export interface DuplicateGroup {
  customers: Customer[];
  reasons: DuplicateReason[];
}

/**
 * Groups customers sharing a normalized email, phone, or name (transitively).
 * ponytail: name match is exact after normalization (no fuzzy edit distance); add Levenshtein if needed.
 */
export function findDuplicateGroups(customers: Customer[]): DuplicateGroup[] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) as number;
    parent.set(x, r);
    return r;
  };
  customers.forEach((c) => parent.set(c.id, c.id));
  const reasonsByRoot = new Map<number, Set<DuplicateReason>>();
  const seen = new Map<string, number>();
  const link = (key: string, reason: DuplicateReason, id: number): void => {
    const prev = seen.get(key);
    if (prev === undefined) {
      seen.set(key, id);
      return;
    }
    const a = find(prev);
    const b = find(id);
    const merged = new Set([
      ...(reasonsByRoot.get(a) ?? []),
      ...(reasonsByRoot.get(b) ?? []),
      reason,
    ]);
    parent.set(b, a);
    reasonsByRoot.set(a, merged);
  };
  for (const c of customers) {
    const email = normalizeEmail(c.email);
    const phone = normalizePhone(c.billing?.phone);
    const name = normalizeName(c);
    if (email) link(`e:${email}`, 'email', c.id);
    if (phone) link(`p:${phone}`, 'phone', c.id);
    if (name.includes(' ')) link(`n:${name}`, 'name', c.id);
  }
  const groups = new Map<number, Customer[]>();
  for (const c of customers) {
    const r = find(c.id);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([root, list]) => ({
      customers: list,
      reasons: [...(reasonsByRoot.get(root) ?? [])],
    }));
}
