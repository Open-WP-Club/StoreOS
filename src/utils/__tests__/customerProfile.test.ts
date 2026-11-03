import { describe, it, expect } from 'vitest';
import {
  customerOrderStats,
  findDuplicateGroups,
  namesMatch,
  normalizeName,
  profileMeta,
  remoteProfile,
  normalizeEmail,
  normalizePhone,
  ordersForCustomer,
} from '../customerProfile';
import { createMockCustomer, createMockOrder, createMockBilling } from '../../__test_utils__';

describe('customerProfile', () => {
  it('normalizes email and phone', () => {
    expect(normalizeEmail(' Bob+x@Mail.com ')).toBe('bob@mail.com');
    expect(normalizePhone('+1 (555) 123-4567')).toBe('551234567');
    expect(normalizePhone('123')).toBe('');
  });

  it('matches orders by id or billing email', () => {
    const c = createMockCustomer({ id: 7, email: 'a@b.com' });
    const byId = createMockOrder({ customer_id: 7 });
    const byEmail = createMockOrder({
      customer_id: 0,
      billing: createMockBilling({ email: 'A@B.com' }),
    });
    const other = createMockOrder({
      customer_id: 9,
      billing: createMockBilling({ email: 'x@y.com' }),
    });
    expect(ordersForCustomer(c, [byId, byEmail, other])).toEqual([byId, byEmail]);
  });

  it('computes stats ignoring cancelled/refunded', () => {
    const s = customerOrderStats([
      createMockOrder({ total: '10.00', status: 'completed', date_created: '2024-01-01T00:00:00' }),
      createMockOrder({
        total: '30.00',
        status: 'processing',
        date_created: '2024-03-01T00:00:00',
      }),
      createMockOrder({ total: '99.00', status: 'cancelled', date_created: '2024-02-01T00:00:00' }),
    ]);
    expect(s.count).toBe(2);
    expect(s.lifetimeValue).toBe(40);
    expect(s.average).toBe(20);
    expect(s.lastOrderDate).toBe('2024-03-01T00:00:00');
    expect(customerOrderStats([]).average).toBe(0);
  });

  it('groups duplicates by email, phone and name, transitively', () => {
    const a = createMockCustomer({
      id: 1,
      email: 'jo@x.com',
      first_name: 'Jo',
      last_name: 'Smith',
    });
    const b = createMockCustomer({
      id: 2,
      email: 'JO+shop@x.com',
      first_name: 'A',
      last_name: 'B',
    });
    const c = createMockCustomer({
      id: 3,
      email: 'c@x.com',
      first_name: 'Zed',
      last_name: 'Q',
      billing: createMockBilling({ phone: '555-111-2222' }),
    });
    const d = createMockCustomer({
      id: 4,
      email: 'd@x.com',
      first_name: 'Other',
      last_name: 'Person',
      billing: createMockBilling({ phone: '(555) 111 2222' }),
    });
    const e = createMockCustomer({ id: 5, email: 'e@x.com', first_name: 'smith', last_name: 'JÓ' });
    const f = createMockCustomer({ id: 6, email: 'f@x.com', first_name: 'Jo', last_name: 'Smith' });
    const lone = createMockCustomer({
      id: 7,
      email: 'l@x.com',
      first_name: 'Lone',
      last_name: 'Wolf',
    });
    // mock customers share a default phone; give the others unique ones
    const uniq = [a, b, e, f, lone].map((x, i) => ({
      ...x,
      billing: { ...x.billing, phone: `${i}00${i}` },
    }));
    const groups = findDuplicateGroups([...uniq, c, d]);
    const ids = groups.map((g) => g.customers.map((x) => x.id).sort());
    expect(ids).toContainEqual([1, 2, 5, 6]);
    expect(ids).toContainEqual([3, 4]);
    expect(ids.flat()).not.toContain(7);
    expect(groups.find((g) => g.customers.some((x) => x.id === 3))?.reasons).toEqual(['phone']);
  });

  describe('fuzzy names', () => {
    const n = (first: string, last: string): string =>
      normalizeName({ first_name: first, last_name: last });
    const noPhone = createMockBilling({ phone: '' });
    const dup = (a: [string, string], b: [string, string]): boolean =>
      findDuplicateGroups([
        createMockCustomer({
          id: 1,
          email: 'a@x.com',
          first_name: a[0],
          last_name: a[1],
          billing: noPhone,
        }),
        createMockCustomer({
          id: 2,
          email: 'b@x.com',
          first_name: b[0],
          last_name: b[1],
          billing: noPhone,
        }),
      ]).length === 1;

    it('matches diacritics, order and surname typos', () => {
      expect(dup(['José', 'Álvarez'], ['jose', 'alvarez'])).toBe(true);
      expect(dup(['Smith', 'John'], ['John', 'Smith'])).toBe(true);
      expect(dup(['Maria', 'Petrova'], ['Maria', 'Petrovq'])).toBe(true);
      expect(dup(['Georgi', 'Dimitrov'], ['Georgi', 'Dimitrow'])).toBe(true);
    });

    it('does not merge different people with similar names', () => {
      expect(dup(['Maria', 'Petrova'], ['Mario', 'Petrova'])).toBe(false);
      expect(dup(['Jon', 'Smith'], ['Jan', 'Smith'])).toBe(false);
      expect(dup(['Ana', 'Li'], ['Ana', 'Lo'])).toBe(false);
      expect(dup(['Ivan', 'Petrov'], ['Ivana', 'Petrova'])).toBe(false);
      expect(dup(['Maria', 'Petrova'], ['Maria', 'Ivanova'])).toBe(false);
      expect(dup(['Peter', 'Johnson'], ['Peter', 'Jackson'])).toBe(false);
    });

    it('needs two tokens and two typos are too many', () => {
      expect(namesMatch('madonna', 'madonnb')).toBe(false);
      expect(namesMatch(n('Georgi', 'Dimitrov'), n('Georgy', 'Dimitrow'))).toBe(false);
    });

    it('keeps exact email matching', () => {
      const g = findDuplicateGroups([
        createMockCustomer({ id: 1, email: 'same@x.com', first_name: 'A', last_name: 'B' }),
        createMockCustomer({ id: 2, email: 'SAME@x.com', first_name: 'C', last_name: 'D' }),
      ]);
      expect(g[0]?.reasons).toContain('email');
    });
  });

  it('round-trips profile meta_data and rejects missing/corrupt data', () => {
    const meta = profileMeta({ tags: ['vip'], notes: 'hi', updatedAt: 5 });
    expect(remoteProfile(meta)).toEqual({ tags: ['vip'], notes: 'hi', updatedAt: 5 });
    expect(remoteProfile([])).toBeNull();
    expect(
      remoteProfile([
        { key: '_storeos_tags', value: '{bad' },
        { key: '_storeos_updated', value: '9' },
      ])
    ).toEqual({ tags: [], notes: '', updatedAt: 9 });
  });
});
