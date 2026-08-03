import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CustomerAnalyticsPage from '../CustomerAnalyticsPage';
import { useCache } from '../../stores';
import { createMockOrder, createMockBilling } from '../../__test_utils__';

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

describe('CustomerAnalyticsPage', () => {
  const now = new Date();

  const orders = [
    createMockOrder({
      status: 'completed',
      total: '100.00',
      date_created: now.toISOString(),
      billing: createMockBilling({ email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith', country: 'US', city: 'New York' }),
    }),
    createMockOrder({
      status: 'completed',
      total: '200.00',
      date_created: now.toISOString(),
      billing: createMockBilling({ email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith', country: 'US', city: 'New York' }),
    }),
    createMockOrder({
      status: 'completed',
      total: '50.00',
      date_created: now.toISOString(),
      billing: createMockBilling({ email: 'bob@example.com', first_name: 'Bob', last_name: 'Jones', country: 'UK', city: 'London' }),
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

  it('should render customer analytics page with heading', async () => {
    render(<CustomerAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Customer Analytics')).toBeInTheDocument();
    });
  });

  it('should show customer metric cards', async () => {
    render(<CustomerAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Customers')).toBeInTheDocument();
      expect(screen.getByText('New Customers')).toBeInTheDocument();
      expect(screen.getByText('Returning Customers')).toBeInTheDocument();
      expect(screen.getByText('Avg. Customer Value')).toBeInTheDocument();
    });
  });

  it('should display chart sections', async () => {
    render(<CustomerAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Top 10 Countries')).toBeInTheDocument();
      expect(screen.getByText('Customer Order Distribution')).toBeInTheDocument();
    });
  });

  it('should display top customers table', async () => {
    render(<CustomerAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Top 10 Customers by Revenue')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    mockGetCachedData.mockReturnValue(new Promise(() => {}));

    render(<CustomerAnalyticsPage />);

    expect(screen.getByText('Loading customer analytics...')).toBeInTheDocument();
  });

  it('should handle null orders gracefully', async () => {
    mockGetCachedData.mockResolvedValue(null);

    render(<CustomerAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Customer Analytics')).toBeInTheDocument();
    });
  });
});
