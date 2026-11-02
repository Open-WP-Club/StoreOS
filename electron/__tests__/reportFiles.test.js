import path from 'path';
import { sanitizeReportFilename as s, resolveReportPath as r } from '../reportFiles';

describe('sanitizeReportFilename', () => {
  it('accepts plain csv/pdf names', () => {
    expect(s('sales-Store (1)-2026-01-02.csv')).toBe('sales-Store (1)-2026-01-02.csv');
    expect(s('report.PDF')).toBe('report.PDF');
  });
  it('rejects traversal, separators, bad ext and non-strings', () => {
    const bad = [
      '../x.csv',
      '..\\x.csv',
      'a/b.csv',
      'a\\b.csv',
      '/etc/passwd',
      '.hidden.csv',
      'a..b.csv',
      'x.exe',
      'x',
      '',
      '  ',
      'x.csv\0',
      'C:\\x.csv',
      'a'.repeat(200) + '.csv',
      5,
      null,
    ];
    for (const b of bad) expect(s(b)).toBeNull();
  });
});

describe('resolveReportPath', () => {
  const dir = path.resolve('/tmp/reports');
  it('joins inside the dir', () => {
    expect(r(dir, 'a.csv')).toBe(path.join(dir, 'a.csv'));
  });
  it('rejects traversal and relative dirs', () => {
    expect(r(dir, '../a.csv')).toBeNull();
    expect(r('reports', 'a.csv')).toBeNull();
    expect(r(null, 'a.csv')).toBeNull();
  });
});
