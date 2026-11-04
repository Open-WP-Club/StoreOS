import { buildFrame, encodeCp1251, cleanText, cmdSale, CMD } from '../fiscalProtocol';
import { validateSale } from '../fiscal';

describe('control characters in text', () => {
  it('replaces every control byte with a space', () => {
    expect(cleanText('a\tb\nc\r\x00d\x1fe\x7ff')).toBe('a b c  d e f');
    expect(encodeCp1251('a\tb')[1]).toBe(0x09); // separators survive encoding
  });

  it('item names cannot inject separators or frame bytes', () => {
    const data = cmdSale({ name: 'x\ty\x05z\x03', taxGroup: 'Б', price: 1, quantity: 1 });
    const f = buildFrame(0x20, CMD.SALE, data);
    // <01><LEN><SEQ><CMD> data <05><BCC x4><03>
    const payload = f.subarray(4, f.length - 6);
    expect(payload.toString('latin1').split('\t')).toHaveLength(7); // 6 fields + trailing empty
    expect(payload.includes(0x05)).toBe(false);
    expect(payload.includes(0x03)).toBe(false);
    expect(payload.toString('latin1').startsWith('x y z ')).toBe(true);
  });
});

describe('validateSale', () => {
  const line = { name: 'A', taxGroup: 'Б', price: 1, quantity: 1, discount: 0 };
  const pay = { method: 'cash', amount: 1 };

  it('accepts a well-formed sale', () => {
    expect(validateSale({ lines: [line], payments: [pay] })).toBeNull();
  });
  it('rejects tax groups outside the allowlist', () => {
    for (const taxGroup of ['X', 'Б\t9', '', 'БВ', 5]) {
      expect(validateSale({ lines: [{ ...line, taxGroup }], payments: [pay] })).toBe(
        'invalid line'
      );
    }
  });
  it('rejects non-finite / negative / string numbers', () => {
    for (const bad of [NaN, Infinity, -1, '1']) {
      expect(validateSale({ lines: [{ ...line, price: bad }], payments: [pay] })).toBe(
        'invalid line'
      );
      expect(validateSale({ lines: [line], payments: [{ ...pay, amount: bad }] })).toBe(
        'invalid payment'
      );
    }
    expect(validateSale({ lines: [{ ...line, quantity: 0 }], payments: [pay] })).toBe(
      'invalid line'
    );
  });
  it('rejects other payment methods', () => {
    expect(validateSale({ lines: [line], payments: [{ method: 'other', amount: 1 }] })).toBe(
      'invalid payment'
    );
  });
});
