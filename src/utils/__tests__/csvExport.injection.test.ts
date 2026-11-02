import { convertToCSV } from '../csvExport';

describe('convertToCSV formula injection', () => {
  const columns = [{ key: 'v', label: 'V' }];

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx'])('prefixes text cell %j', (v) => {
    const row = convertToCSV([{ v }], columns).split('\n')[1] ?? '';
    expect(row.startsWith("'")).toBe(true);
  });

  it('keeps negative numbers and normal text unchanged', () => {
    expect(convertToCSV([{ v: -5 }], columns).split('\n')[1]).toBe('-5');
    expect(convertToCSV([{ v: 'Acme' }], columns).split('\n')[1]).toBe('Acme');
  });

  it('quotes cells with a bare CR so they cannot start a new row', () => {
    const out = convertToCSV([{ v: 'a\r=1+1' }], columns);
    expect(out.split('\n')[1]).toBe('"a\r=1+1"');
  });
});
