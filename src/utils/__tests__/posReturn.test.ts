import { describe, it, expect, beforeEach } from 'vitest';
import {
  apiRefundFor,
  buildReturnReceipt,
  loadReturns,
  parseOrderNumber,
  returnsInRange,
  saveReturn,
  toPosReturn,
  POS_RETURNS_KEY,
} from '../posReturn';
import { renderReceiptHtml } from '../receipt';
import { RECENT_TRANSACTIONS_KEY } from '../posOfflineSale';
import { createMockOrder, createMockLineItem } from '../../__test_utils__/mockFactories';

const order = createMockOrder({
  id: 55,
  line_items: [
    createMockLineItem({ id: 7, product_id: 99, name: 'Widget', quantity: 2, total: '50.00' }),
  ],
});
const request = {
  amount: '25.00',
  line_items: [{ id: 7, quantity: 1, refund_total: '25.00', refund_tax: [] }],
  api_restock: true,
};

describe('posReturn', () => {
  beforeEach(() => localStorage.clear());

  it('parses order numbers', () => {
    expect(parseOrderNumber(' #1234 ')).toBe(1234);
    expect(parseOrderNumber('77')).toBe(77);
    expect(parseOrderNumber('abc')).toBeNull();
    expect(parseOrderNumber('0')).toBeNull();
  });

  it('only uses the gateway for the original method', () => {
    expect(apiRefundFor('cash')).toBe(false);
    expect(apiRefundFor('original')).toBe(true);
  });

  it('builds a return record from a refund request', () => {
    const r = toPosReturn(order, request, 9, 'cash', '2026-01-01T10:00:00.000Z');
    expect(r).toMatchObject({ orderId: 55, refundId: 9, total: 25, restocked: true });
    expect(r.items).toEqual([{ productId: 99, name: 'Widget', quantity: 1, amount: 25 }]);
  });

  it('saves returns, marks a full return and filters by range', () => {
    localStorage.setItem(RECENT_TRANSACTIONS_KEY, JSON.stringify([{ id: 55 }, { id: 56 }]));
    const r = toPosReturn(order, request, 9, 'cash', '2026-01-01T10:00:00.000Z');
    saveReturn(r, true);
    expect(loadReturns()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(RECENT_TRANSACTIONS_KEY)!)).toEqual([
      { id: 55, refunded: true },
      { id: 56 },
    ]);
    const t = new Date('2026-01-01T00:00:00.000Z').getTime();
    expect(returnsInRange([r], t, t + 86400000)).toHaveLength(1);
    expect(returnsInRange([r], t + 86400000, t + 2 * 86400000)).toHaveLength(0);
    localStorage.setItem(POS_RETURNS_KEY, 'garbage');
    expect(loadReturns()).toEqual([]);
  });

  it('builds a negative refund receipt', () => {
    const r = toPosReturn(order, request, 9, 'cash');
    const receipt = buildReturnReceipt(r, 'Shop');
    expect(receipt.kind).toBe('refund');
    expect(receipt.total).toBe(-25);
    expect(receipt.lines[0]?.total).toBe(-25);
    const html = renderReceiptHtml(receipt);
    expect(html).toContain('ВЪЗСТАНОВЯВАНЕ');
    expect(html).not.toContain('Благодарим');
  });
});
