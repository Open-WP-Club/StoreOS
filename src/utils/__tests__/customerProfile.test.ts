import { describe, it, expect } from 'vitest';
import {
  customerOrderStats,
  findDuplicateGroups,
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
});
