import { boundedLevenshteinDistance } from './search/fuzzy';
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

/**
 * Fuzzy "same person" check on normalized (sorted-token) names. Same token count (>= 2); every
 * token must match exactly except at most ONE token of >= 6 chars that may differ by 1 edit
 * (surname typo). Short tokens (first names like Maria/Mario, Jon/Jan) must match exactly, so
 * different people with similar names are not merged.
 */
export function namesMatch(a: string, b: string): boolean {
  if (a === b) return a.includes(' ');
  const ta = a.split(' ');
  const tb = b.split(' ');
  if (ta.length < 2 || ta.length !== tb.length) return false;
  let typos = 0;
  for (let i = 0; i < ta.length; i++) {
    const x = ta[i] as string;
    const y = tb[i] as string;
    if (x === y) continue;
    if (Math.min(x.length, y.length) < 6 || ++typos > 1) return false;
    if (boundedLevenshteinDistance(x, y, 1) > 1) return false;
  }
  return true;
}

export type DuplicateReason = 'email' | 'phone' | 'name';
export interface DuplicateGroup {
  customers: Customer[];
  reasons: DuplicateReason[];
}

/**
 * Groups customers sharing a normalized email or phone (exact) or a fuzzy-equal name
 * (see namesMatch), transitively.
 * ponytail: name pairs are compared within shared-token buckets (O(bucket^2)); very common
 * first names in huge stores could be slow, add a size cap if it shows up.
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
  const union = (prev: number, id: number, reason: DuplicateReason): void => {
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
  const link = (key: string, reason: DuplicateReason, id: number): void => {
    const prev = seen.get(key);
    if (prev === undefined) seen.set(key, id);
    else union(prev, id, reason);
  };
  const names = new Map<number, string>();
  const byToken = new Map<string, number[]>();
  for (const c of customers) {
    const email = normalizeEmail(c.email);
    const phone = normalizePhone(c.billing?.phone);
    const name = normalizeName(c);
    if (email) link(`e:${email}`, 'email', c.id);
    if (phone) link(`p:${phone}`, 'phone', c.id);
    if (name.includes(' ')) {
      names.set(c.id, name);
      for (const t of new Set(name.split(' '))) byToken.set(t, [...(byToken.get(t) ?? []), c.id]);
    }
  }
  for (const ids of byToken.values()) {
    for (let i = 1; i < ids.length; i++) {
      for (let j = 0; j < i; j++) {
        const x = ids[i] as number;
        const y = ids[j] as number;
        if (namesMatch(names.get(x) as string, names.get(y) as string)) union(y, x, 'name');
      }
    }
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

export const META_TAGS = '_storeos_tags';
export const META_NOTES = '_storeos_notes';
export const META_UPDATED = '_storeos_updated';

/** meta_data entries for syncing a local profile to WooCommerce (only built when sync is ON). */
export function profileMeta(p: {
  tags: string[];
  notes: string;
  updatedAt?: number;
}): { key: string; value: string }[] {
  return [
    { key: META_TAGS, value: JSON.stringify(p.tags) },
    { key: META_NOTES, value: p.notes },
    { key: META_UPDATED, value: String(p.updatedAt ?? Date.now()) },
  ];
}

/** Reads a synced profile back from customer.meta_data, or null if the customer has none. */
export function remoteProfile(
  meta?: { key: string; value: unknown }[]
): { tags: string[]; notes: string; updatedAt: number } | null {
  const get = (k: string): unknown => meta?.find((m) => m.key === k)?.value;
  const ts = Number(get(META_UPDATED));
  if (!Number.isFinite(ts) || ts <= 0) return null;
  let tags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(get(META_TAGS) ?? '[]'));
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    /* corrupt remote tags: treat as empty */
  }
  const notes = get(META_NOTES);
  return { tags, notes: typeof notes === 'string' ? notes : '', updatedAt: ts };
}
