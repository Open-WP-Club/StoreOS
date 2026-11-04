import { buildFiscalSale, parseVatMap, vatGroupFor, DEFAULT_VAT_MAP } from '../fiscal';

describe('vat map', () => {
  it('parses and looks up groups', () => {
    expect(vatGroupFor(20, DEFAULT_VAT_MAP)).toBe('Б');
    expect(vatGroupFor(9, '9=В')).toBe('В');
    expect(vatGroupFor(5, DEFAULT_VAT_MAP)).toBeNull();
    expect(parseVatMap('junk,=,20=,x=Б').size).toBe(0);
  });
});

describe('buildFiscalSale', () => {
  const base = {
    vatRate: 20,
    vatMap: DEFAULT_VAT_MAP,
    saleDiscountCents: 0,
    items: [
      { name: 'A', quantity: 2, price: 5, lineDiscountCents: 100 },
      { name: 'B', quantity: 1, price: 3, lineDiscountCents: 0 },
    ],
  };

  it('keeps line discounts and matches the paid total', () => {
    const s = buildFiscalSale({ ...base, payments: [{ method: 'cash', amount: 12 }] });
    expect(s?.lines.map((l) => l.discount)).toEqual([1, 0]);
    expect(s?.lines[0]?.taxGroup).toBe('Б');
  });

  it('spreads a sale discount so the cents add up exactly', () => {
    const s = buildFiscalSale({
      ...base,
      saleDiscountCents: 101,
      payments: [
        { method: 'cash', amount: 5 },
        { method: 'card', amount: 5.99 },
      ],
    });
    const total = s!.lines.reduce(
      (t, l) => t + Math.round(l.price * l.quantity * 100 - l.discount * 100),
      0
    );
    expect(total).toBe(1099);
    expect(s?.payments).toHaveLength(2);
  });

  it('refuses unfiscalizable sales', () => {
    const cash = [{ method: 'cash' as const, amount: 12 }];
    expect(buildFiscalSale({ ...base, vatRate: 7, payments: cash })).toBeNull();
    expect(buildFiscalSale({ ...base, payments: [{ method: 'other', amount: 12 }] })).toBeNull();
    expect(buildFiscalSale({ ...base, payments: [{ method: 'cash', amount: 11 }] })).toBeNull();
  });
});
