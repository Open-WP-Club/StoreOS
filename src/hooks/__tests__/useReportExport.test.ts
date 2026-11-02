import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReportExport } from '../useReportExport';
import { exportToCSV } from '../../utils/csvExport';
import { exportReportToPDF } from '../../utils/pdfExport';

let store: { name?: string } | null = { name: 'Shop' };
vi.mock('../../stores', () => ({
  useStoreConfig: (sel: (s: unknown) => unknown) => sel({ getCurrentStore: () => store }),
}));
vi.mock('../../utils/csvExport', () => ({ exportToCSV: vi.fn() }));
vi.mock('../../utils/pdfExport', () => ({ exportReportToPDF: vi.fn() }));

type Row = { a: string; b: number } & Record<string, unknown>;
const cfg = (data: Row[]) => ({
  reportName: 'My report',
  filenamePrefix: 'rep',
  summaryMetrics: [{ label: 'x', value: '1' }],
  columns: [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B', format: (v: unknown) => `#${v}` },
  ] as never,
  data,
  timeRange: 'Last 7 days',
});

describe('useReportExport', () => {
  beforeEach(() => {
    store = { name: 'Shop' };
    vi.mocked(exportReportToPDF).mockResolvedValue(undefined as never);
  });

  it('CSV: maps columns and builds a dated filename', () => {
    const data = [{ a: 'x', b: 1 }];
    const { result } = renderHook(() => useReportExport<Row>(cfg(data)));
    result.current.handleExportCSV();
    const [rows, cols, filename] = vi.mocked(exportToCSV).mock.calls[0]!;
    expect(rows).toBe(data);
    expect((cols as { key: string; label: string }[]).map((c) => c.label)).toEqual(['A', 'B']);
    expect(filename).toMatch(/^rep-Shop-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('falls back to a generic store name', () => {
    store = null;
    const { result } = renderHook(() => useReportExport<Row>(cfg([{ a: 'x', b: 1 }])));
    result.current.handleExportCSV();
    expect(vi.mocked(exportToCSV).mock.calls[0]![2]).toMatch(/^rep-store-/);
  });

  it('PDF: passes metrics, title, time range and landscape', () => {
    const { result } = renderHook(() => useReportExport<Row>(cfg([{ a: 'x', b: 1 }])));
    result.current.handleExportPDF();
    const [, , metrics, opts] = vi.mocked(exportReportToPDF).mock.calls[0]!;
    expect(metrics).toEqual([{ label: 'x', value: '1' }]);
    expect(opts).toMatchObject({
      title: 'My report',
      storeName: 'Shop',
      timeRange: 'Last 7 days',
      orientation: 'landscape',
    });
    expect(opts!.filename).toMatch(/^rep-Shop-.*\.pdf$/);
  });

  it('PDF failure is swallowed (logged), not thrown', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(exportReportToPDF).mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useReportExport<Row>(cfg([{ a: 'x', b: 1 }])));
    result.current.handleExportPDF();
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    spy.mockRestore();
  });

  it('does nothing for empty data', () => {
    const { result } = renderHook(() => useReportExport<Row>(cfg([])));
    result.current.handleExportCSV();
    result.current.handleExportPDF();
    expect(exportToCSV).not.toHaveBeenCalled();
    expect(exportReportToPDF).not.toHaveBeenCalled();
  });

  it('print calls window.print', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { result } = renderHook(() => useReportExport<Row>(cfg([])));
    result.current.handlePrint();
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });
});
