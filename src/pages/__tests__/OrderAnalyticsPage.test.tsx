import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OrderAnalyticsPage from '../OrderAnalyticsPage';
import { createMockOrder } from '../../__test_utils__';
import { useCache } from '../../stores';

vi.mock('../../stores', () => ({
  useCache: vi.fn(),
  useStoreConfig: vi.fn(),
  useTheme: vi.fn((selector?: (state: unknown) => unknown) => selector ? selector({ theme: 'light' }) : { theme: 'light' }),
}));

vi.mock('../../hooks/useReportExport', () => ({
  useReportExport: () => ({
    handleExportCSV: vi.fn(),
    handleExportPDF: vi.fn(),
    handlePrint: vi.fn(),
  }),
}));

vi.mock('../../utils/currency', () => ({
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
  getCurrencyCode: () => 'USD',
}));

// Stable mock ref for getCachedData (used in useCallback deps)
const mockGetCachedData = vi.fn();

describe('OrderAnalyticsPage', () => {
  const now = new Date();

  const orders = [
    createMockOrder({
      status: 'completed',
      total: '100.00',
      date_created: now.toISOString(),
      date_completed: now.toISOString(),
      payment_method_title: 'Credit Card',
    }),
    createMockOrder({
      status: 'processing',
      total: '50.00',
      date_created: now.toISOString(),
      payment_method_title: 'PayPal',
    }),
    createMockOrder({
      status: 'pending',
      total: '30.00',
      date_created: now.toISOString(),
      payment_method_title: 'Credit Card',
    }),
    createMockOrder({
      status: 'cancelled',
      total: '20.00',
      date_created: now.toISOString(),
    }),
  ];

  beforeEach(() => {
    mockGetCachedData.mockImplementation((type: string) => {
      if (type === 'orders') return Promise.resolve(orders);
      return Promise.resolve(null);
    });

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        getCachedData: mockGetCachedData,
      };
      return selector ? selector(state) : state;
    });
  });

  it('should render order analytics page with heading', async () => {
    render(<OrderAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Order Analytics')).toBeInTheDocument();
    });
  });

  it('should show key metric cards', async () => {
    render(<OrderAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Orders')).toBeInTheDocument();
      // "Processing" and "Pending" appear in both metric cards and status breakdown
      expect(screen.getAllByText('Processing').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should display status breakdown section', async () => {
    render(<OrderAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Detailed Status Breakdown')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    mockGetCachedData.mockReturnValue(new Promise(() => {}));

    render(<OrderAnalyticsPage />);

    expect(screen.getByText('Loading order analytics...')).toBeInTheDocument();
  });

  it('should handle null orders gracefully', async () => {
    mockGetCachedData.mockResolvedValue(null);

    render(<OrderAnalyticsPage />);

    await waitFor(() => {
      // Should render with zero-state after loading completes, not crash
      expect(screen.getByText('Order Analytics')).toBeInTheDocument();
    });
  });

  it('should display time range selector', async () => {
    render(<OrderAnalyticsPage />);

    await waitFor(() => {
      const select = screen.getByLabelText(/Time Range/i);
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('30');
    });
  });
});
