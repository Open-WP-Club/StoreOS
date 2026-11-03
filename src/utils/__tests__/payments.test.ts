import { describe, it, expect } from 'vitest';
import { summarizePayments, methodTotals, paymentTitle } from '../payments';
import { buildReceipt, renderReceiptHtml } from '../receipt';

describe('summarizePayments', () => {
  it('cash + card exact', () => {
    const s = summarizePayments(
      [
        { method: 'cash', amount: 20 },
        { method: 'card', amount: 30.5 },
      ],
      50.5
    );
    expect(s).toMatchObject({ valid: true, change: 0, remaining: 0, tendered: 20 });
  });

  it('gives change from cash only and records cash net of change', () => {
    const s = summarizePayments(
      [
        { method: 'card', amount: 30 },
        { method: 'cash', amount: 50 },
      ],
      45.1
    );
    expect(s.valid).toBe(true);
    expect(s.change).toBe(34.9);
    expect(s.applied).toEqual([
      { method: 'card', amount: 30 },
      { method: 'cash', amount: 15.1 },
    ]);
  });

  it('is invalid when short or when card overpays', () => {
    expect(summarizePayments([{ method: 'cash', amount: 10 }], 10.01)).toMatchObject({
      valid: false,
      remaining: 0.01,
    });
    expect(summarizePayments([{ method: 'card', amount: 12 }], 10).valid).toBe(false);
    // change would exceed what cash can give back
    expect(
      summarizePayments(
        [
          { method: 'card', amount: 9 },
          { method: 'cash', amount: 5 },
        ],
        10
      ).valid
    ).toBe(true);
    expect(
      summarizePayments(
        [
          { method: 'card', amount: 12 },
          { method: 'cash', amount: 5 },
        ],
        10
      ).valid
    ).toBe(false);
  });

  it('has no float drift on 0.1 + 0.2', () => {
    const s = summarizePayments(
      [
        { method: 'card', amount: 0.1 },
        { method: 'cash', amount: 0.2 },
      ],
      0.3
    );
    expect(s).toMatchObject({ valid: true, remaining: 0, change: 0 });
  });

  it('title and report totals by method', () => {
    expect(
      paymentTitle([
        { method: 'cash', amount: 1 },
        { method: 'card', amount: 2 },
      ])
    ).toBe('Каса + Карта');
    expect(
      methodTotals({
        paymentMethod: 'Каса + Карта',
        total: 30,
        payments: [
          { method: 'cash', amount: 10 },
          { method: 'card', amount: 20 },
        ],
      })
    ).toEqual([
      { label: 'Каса', amount: 10 },
      { label: 'Карта', amount: 20 },
    ]);
    // legacy transaction without payments
    expect(methodTotals({ paymentMethod: 'Каса', total: 7 })).toEqual([
      { label: 'Каса', amount: 7 },
    ]);
  });
});

describe('receipt with discounts and split payments', () => {
  it('shows line discount and payment breakdown', () => {
    const r = buildReceipt({
      storeName: 'S',
      items: [{ name: 'A', quantity: 2, price: 10, discount: 2 }],
      discount: 2,
      total: 18,
      paymentMethod: 'Каса + Карта',
      payments: [
        { method: 'cash', amount: 8 },
        { method: 'card', amount: 10 },
      ],
    });
    expect(r.lines[0]).toMatchObject({ total: 20, discount: 2 });
    const html = renderReceiptHtml(r);
    expect(html).toContain('Каса');
    expect(html).toContain('Карта');
    expect(html).not.toContain('Плащане');
    expect(html).toContain('Отстъпка');
  });
});
