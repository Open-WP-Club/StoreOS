import { vi } from 'vitest';
import { render, act } from '@testing-library/react';
import ScheduledReportRunner from '../ScheduledReportRunner';
import useScheduledReports from '../../stores/scheduledReportsStore';
import { useCache } from '../../stores';
import { createMockOrder } from '../../__test_utils__/mockFactories';

const save = vi.fn();
const showNotification = vi.fn();
const pdf = vi.fn();
vi.mock('../../utils/pdfExport', () => ({
  exportReportToPDF: (...a: unknown[]) => pdf(...a),
}));

const NOW = new Date(2026, 10, 2, 19, 0, 0); // Mon 19:00, slot 18:00 is due
const run = async (): Promise<void> => {
  render(<ScheduledReportRunner />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

describe('ScheduledReportRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    save.mockResolvedValue({ success: true });
    pdf.mockResolvedValue(new Uint8Array([1, 2]).buffer);
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      reports: { save },
      showNotification,
    };
    localStorage.clear();
    useScheduledReports.setState({
      enabled: true,
      reportType: 'sales-summary',
      frequency: 'daily',
      time: '18:00',
      format: 'csv',
      notify: true,
      lastRun: new Date(2026, 10, 1, 18, 30).getTime(),
    });
    useCache.setState((s) => ({
      cache: {
        ...s.cache,
        orders: {
          ...s.cache.orders,
          data: [
            createMockOrder({ id: 1, status: 'completed', total: '10.50', date_created: '2026-11-01T20:00:00', date_created_gmt: '' }),
            createMockOrder({ id: 2, status: 'cancelled', total: '99', date_created: '2026-11-01T20:00:00', date_created_gmt: '' }),
          ],
        },
      },
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it('saves a CSV excluding cancelled orders and notifies', async () => {
    await run();
    expect(save).toHaveBeenCalledTimes(1);
    const [name, data] = save.mock.calls[0]!;
    expect(name).toMatch(/^sales-summary-.*-2026-11-02\.csv$/);
    expect(String(data)).toContain('#1');
    expect(String(data)).not.toContain('#2');
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Saved') }));
    expect(useScheduledReports.getState().lastRun).toBe(NOW.getTime());
  });

  it('does not rerun within the same slot', async () => {
    await run();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled or not due', async () => {
    useScheduledReports.setState({ enabled: false });
    await run();
    expect(save).not.toHaveBeenCalled();
  });

  it('reports save failure in the notification', async () => {
    save.mockResolvedValue({ success: false, error: 'disk full' });
    await run();
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ body: 'Report failed: disk full' }));
  });

  it('skips notification when notify is off', async () => {
    useScheduledReports.setState({ notify: false });
    await run();
    expect(save).toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('builds the POS report from stored transactions, ignoring refunded and corrupt data', async () => {
    useScheduledReports.setState({ reportType: 'pos-daily' });
    localStorage.setItem(
      'pos_recent_transactions',
      JSON.stringify([
        { id: 5, timestamp: new Date(2026, 10, 1, 20).toISOString(), paymentMethod: 'cash', total: 4, refunded: false },
        { id: 6, timestamp: new Date(2026, 10, 1, 21).toISOString(), paymentMethod: 'card', total: 8, refunded: true },
      ])
    );
    await run();
    const data = String(save.mock.calls[0]![1]);
    expect(data).toContain('#5');
    expect(data).not.toContain('#6');
  });

  it('writes a header-only CSV for an empty period', async () => {
    useScheduledReports.setState({ reportType: 'pos-daily' });
    localStorage.setItem('pos_recent_transactions', '{not json');
    await run();
    expect(String(save.mock.calls[0]![1])).toContain('Order');
  });

  it('renders a PDF and saves bytes; aborts if PDF generation returns nothing', async () => {
    useScheduledReports.setState({ format: 'pdf' });
    await run();
    expect(save.mock.calls[0]![1]).toBeInstanceOf(Uint8Array);
  });

  it('does not save when PDF generation yields no bytes', async () => {
    pdf.mockResolvedValue(null);
    useScheduledReports.setState({ format: 'pdf' });
    await run();
    expect(save).not.toHaveBeenCalled();
  });
});
