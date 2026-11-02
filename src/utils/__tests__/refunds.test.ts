import { describe, it, expect } from 'vitest';
import { getRefundableItems, buildRefundRequest } from '../refunds';
import { createMockLineItem } from '../../__test_utils__/mockFactories';
import type { OrderRefundDetail } from '../../types';

const item = createMockLineItem({
  id: 7,
  name: 'Widget',
  quantity: 4,
  total: '100.00',
  total_tax: '20.00',
  taxes: [{ id: 1, total: '20.00', subtotal: '20.00' }],
});

const prior: OrderRefundDetail = {
  id: 1,
  reason: '',
  total: '-30.00',
  line_items: [
    {
      id: 99,
      quantity: -1,
      total: '-25.00',
      total_tax: '-5.00',
      meta_data: [{ id: 1, key: '_refunded_item_id', value: '7' }],
    },
  ],
};

describe('refunds', () => {
  it('subtracts previous refunds from remaining', () => {
    const [row] = getRefundableItems([item], [prior]);
    expect(row).toMatchObject({ remainingQty: 3, remainingTotal: 75, remainingTax: 15 });
  });

  it('builds a pro-rata request with tax and restock', () => {
    const rows = getRefundableItems([item], []);
    const r = buildRefundRequest(rows, { 7: { quantity: 2 } }, { restock: true, reason: ' dmg ' });
    expect(r).toEqual({
      ok: true,
      total: 60,
      request: {
        amount: '60.00',
        reason: 'dmg',
        api_restock: true,
        line_items: [
          { id: 7, quantity: 2, refund_total: '50.00', refund_tax: [{ id: 1, refund_total: '10.00' }] },
        ],
      },
    });
  });

  it('refunds exact remainder on last units', () => {
    const rows = getRefundableItems([item], [prior]);
    const r = buildRefundRequest(rows, { 7: { quantity: 3 } }, { restock: false });
    expect(r.ok && r.total).toBe(90);
  });

  it('rejects over-refund by quantity and by amount', () => {
    const rows = getRefundableItems([item], [prior]);
    expect(buildRefundRequest(rows, { 7: { quantity: 4 } }, { restock: true }).ok).toBe(false);
    const byAmount = buildRefundRequest(rows, { 7: { quantity: 1, amount: 80 } }, { restock: true });
    expect(byAmount).toMatchObject({ ok: false });
  });

  it('rejects empty selection', () => {
    const rows = getRefundableItems([item], []);
    expect(buildRefundRequest(rows, {}, { restock: true }).ok).toBe(false);
  });

  it('allows amount-only refund (qty 0)', () => {
    const rows = getRefundableItems([item], []);
    const r = buildRefundRequest(rows, { 7: { quantity: 0, amount: 10 } }, { restock: false });
    expect(r.ok).toBe(true);
  });
});
