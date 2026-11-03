import {
  nextSort,
  normalizeHidden,
  normalizeSort,
  ORDER_SORT,
  PRODUCT_SORT,
  sortItems,
  toggleHidden,
} from '../listView';
import type { Order, Product } from '../../types';

const o = (id: number, total: string, date: string, status = 'pending') =>
  ({ id, total, date_created: date, status }) as unknown as Order;
const p = (id: number, name: string, price: string, qty: number | null, manage = true) =>
  ({ id, name, price, stock_quantity: qty, manage_stock: manage }) as unknown as Product;

describe('listView sort', () => {
  const orders = [
    o(1, '10.00', '2024-01-02T00:00:00'),
    o(2, '5.50', '2024-01-03T00:00:00'),
    o(3, '100', '2024-01-01T00:00:00'),
  ];
  const ids = (xs: { id: number }[]) => xs.map((x) => x.id);

  it('cycles asc -> desc -> none and resets on a new key', () => {
    const a = nextSort(null, 'total');
    expect(a).toEqual({ key: 'total', dir: 'asc' });
    expect(nextSort(a, 'total')).toEqual({ key: 'total', dir: 'desc' });
    expect(nextSort({ key: 'total', dir: 'desc' }, 'total')).toBeNull();
    expect(nextSort(a, 'date')).toEqual({ key: 'date', dir: 'asc' });
  });

  it('sorts numerically (not lexically) and by date, both directions', () => {
    expect(ids(sortItems(orders, { key: 'total', dir: 'asc' }, ORDER_SORT))).toEqual([2, 1, 3]);
    expect(ids(sortItems(orders, { key: 'date', dir: 'desc' }, ORDER_SORT))).toEqual([2, 1, 3]);
  });

  it('null/unknown sort keeps input order and does not mutate', () => {
    expect(sortItems(orders, null, ORDER_SORT)).toBe(orders);
    expect(sortItems(orders, { key: 'nope', dir: 'asc' }, ORDER_SORT)).toBe(orders);
    sortItems(orders, { key: 'total', dir: 'asc' }, ORDER_SORT);
    expect(ids(orders)).toEqual([1, 2, 3]);
  });

  it('sorts products by name (case-insensitive) and stock (unmanaged first when asc)', () => {
    const ps = [p(1, 'b', '1', 5), p(2, 'A', '2', 1), p(3, 'c', '3', null, false)];
    expect(ids(sortItems(ps, { key: 'name', dir: 'asc' }, PRODUCT_SORT))).toEqual([2, 1, 3]);
    expect(ids(sortItems(ps, { key: 'stock', dir: 'asc' }, PRODUCT_SORT))).toEqual([3, 2, 1]);
  });
});

describe('listView columns/migration', () => {
  it('toggles hidden columns', () => {
    expect(toggleHidden([], 'sku')).toEqual(['sku']);
    expect(toggleHidden(['sku', 'price'], 'sku')).toEqual(['price']);
  });

  it('missing/garbage persisted values fall back to defaults', () => {
    const keys = Object.keys(ORDER_SORT);
    expect(normalizeSort(undefined, keys)).toBeNull();
    expect(normalizeSort({ key: 'bogus', dir: 'asc' }, keys)).toBeNull();
    expect(normalizeSort({ key: 'total', dir: 'weird' }, keys)).toEqual({
      key: 'total',
      dir: 'asc',
    });
    expect(normalizeSort({ key: 'total', dir: 'desc' }, keys)).toEqual({
      key: 'total',
      dir: 'desc',
    });
    expect(normalizeHidden(undefined, ['date'])).toEqual([]);
    expect(normalizeHidden(['date', 'x'], ['date'])).toEqual(['date']);
  });
});

describe('sortItems performance contract', () => {
  it('evaluates the getter once per item and stays stable', () => {
    const items = Array.from({ length: 2000 }, (_, i) => ({ id: i, k: i % 7 }));
    const get = vi.fn((x: { id: number; k: number }) => x.k);
    const out = sortItems(items, { key: 'k', dir: 'asc' }, { k: get });
    expect(get).toHaveBeenCalledTimes(items.length);
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1]!;
      const b = out[i]!;
      expect(a.k < b.k || (a.k === b.k && a.id < b.id)).toBe(true);
    }
    expect(items[0]!.id).toBe(0);
  });
});
