import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FinancialAnalyticsPage from '../FinancialAnalyticsPage';
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

describe('FinancialAnalyticsPage', () => {
  const now = new Date();

  const orders = [
    createMockOrder({
      status: 'completed',
      total: '150.00',
      shipping_total: '10.00',
      total_tax: '15.00',
      discount_total: '5.00',
      date_created: now.toISOString(),
      payment_method_title: 'Credit Card',
    }),
    createMockOrder({
      status: 'completed',
      total: '250.00',
      shipping_total: '15.00',
      total_tax: '25.00',
      discount_total: '10.00',
      date_created: now.toISOString(),
      payment_method_title: 'PayPal',
    }),
    createMockOrder({
      status: 'refunded',
      total: '50.00',
      shipping_total: '0.00',
      total_tax: '0.00',
      discount_total: '0.00',
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

  it('should render financial analytics page with heading', async () => {
    render(<FinancialAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Financial Analytics')).toBeInTheDocument();
    });
  });

  it('should show key financial metric cards', async () => {
    render(<FinancialAnalyticsPage />);

    await waitFor(() => {
      // "Total Revenue" and "Net Revenue" appear both in cards and summary table
      expect(screen.getAllByText('Total Revenue').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Net Revenue').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Avg. Transaction')).toBeInTheDocument();
      expect(screen.getByText('Profit Margin')).toBeInTheDocument();
    });
  });

  it('should show financial breakdown cards', async () => {
    render(<FinancialAnalyticsPage />);

    await waitFor(() => {
      // These labels appear in both breakdown cards and summary table
      expect(screen.getAllByText('Shipping Revenue').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Tax Collected').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Discounts Given')).toBeInTheDocument();
      expect(screen.getAllByText('Refunds').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should display financial summary table', async () => {
    render(<FinancialAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Financial Summary')).toBeInTheDocument();
      expect(screen.getByText('Gross Revenue')).toBeInTheDocument();
    });
  });

  it('should show chart sections', async () => {
    render(<FinancialAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Revenue by Payment Method')).toBeInTheDocument();
      expect(screen.getByText('Revenue Composition')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    mockGetCachedData.mockReturnValue(new Promise(() => {}));

    render(<FinancialAnalyticsPage />);

    expect(screen.getByText('Loading financial analytics...')).toBeInTheDocument();
  });

  it('should handle null orders gracefully', async () => {
    mockGetCachedData.mockResolvedValue(null);

    render(<FinancialAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Financial Analytics')).toBeInTheDocument();
    });
  });
});
