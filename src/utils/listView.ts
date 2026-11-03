import type { Order, Product, SortState } from '../types';

/** Optional (hideable) columns per list. Identity columns (id/name/actions) are always shown. */
export const ORDER_COLUMNS = [
  { key: 'customer', label: 'Customer' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total' },
] as const;
export const PRODUCT_COLUMNS = [
  { key: 'sku', label: 'SKU' },
  { key: 'price', label: 'Price' },
  { key: 'stockStatus', label: 'Stock Status' },
  { key: 'stockQty', label: 'Stock Qty' },
] as const;

type Getter<T> = (item: T) => string | number;

export const ORDER_SORT: Record<string, Getter<Order>> = {
  date: (o) => Date.parse(o.date_created) || 0,
  total: (o) => parseFloat(o.total) || 0,
  status: (o) => o.status,
};
export const PRODUCT_SORT: Record<string, Getter<Product>> = {
  name: (p) => p.name.toLowerCase(),
  price: (p) => parseFloat(p.price) || 0,
  stock: (p) => (p.manage_stock ? (p.stock_quantity ?? 0) : -1),
};

/** none -> asc -> desc -> none */
export function nextSort(cur: SortState | null, key: string): SortState | null {
  if (cur?.key !== key) return { key, dir: 'asc' };
  return cur.dir === 'asc' ? { key, dir: 'desc' } : null;
}

/** Stable sort on a copy; null/unknown sort returns the input untouched. */
export function sortItems<T>(
  items: T[],
  sort: SortState | null,
  getters: Record<string, Getter<T>>
): T[] {
  const get = sort && getters[sort.key];
  if (!sort || !get) return items;
  const m = sort.dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    return x < y ? -m : x > y ? m : 0;
  });
}

/** Coerce untrusted (persisted) sort to a valid one for this list, else default (null). */
export function normalizeSort(raw: unknown, allowed: string[]): SortState | null {
  const s = raw as Partial<SortState> | null | undefined;
  if (!s || typeof s.key !== 'string' || !allowed.includes(s.key)) return null;
  return { key: s.key, dir: s.dir === 'desc' ? 'desc' : 'asc' };
}

/** Coerce untrusted hidden-column list to known optional keys (default []). */
export function normalizeHidden(raw: unknown, allowed: string[]): string[] {
  return Array.isArray(raw) ? raw.filter((k): k is string => allowed.includes(k)) : [];
}

export function toggleHidden(hidden: string[], key: string): string[] {
  return hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
}
