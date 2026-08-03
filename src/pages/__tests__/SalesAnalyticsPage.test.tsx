import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SalesAnalyticsPage from '../SalesAnalyticsPage';
import { useCache } from '../../stores';
import { createMockOrder, createMockProduct, createMockLineItem } from '../../__test_utils__';

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

describe('SalesAnalyticsPage', () => {
  const now = new Date();

  const orders = [
    createMockOrder({
      status: 'completed',
      total: '100.00',
      date_created: now.toISOString(),
      line_items: [createMockLineItem({ product_id: 1, name: 'Widget A', quantity: 2, total: '50.00' })],
    }),
    createMockOrder({
      status: 'completed',
      total: '200.00',
      date_created: now.toISOString(),
      line_items: [createMockLineItem({ product_id: 2, name: 'Widget B', quantity: 1, total: '200.00' })],
    }),
    createMockOrder({
      status: 'processing',
      total: '75.00',
      date_created: now.toISOString(),
    }),
  ];

  const products = [
    createMockProduct({ stock_quantity: 10, price: '25.00' }),
    createMockProduct({ stock_quantity: 5, price: '50.00' }),
  ];

  beforeEach(() => {
    mockGetCachedData.mockImplementation((type: string) => {
      if (type === 'orders') return Promise.resolve(orders);
      if (type === 'products') return Promise.resolve(products);
      return Promise.resolve(null);
    });

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        getCachedData: mockGetCachedData,
        cache: {
          orders: { data: orders },
          products: { data: products },
        },
      };
      return selector ? selector(state) : state;
    });
  });

  it('should render sales analytics page with heading', async () => {
    render(<SalesAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sales Analytics')).toBeInTheDocument();
    });
  });

  it('should show key metric cards after loading', async () => {
    render(<SalesAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Sales')).toBeInTheDocument();
      expect(screen.getByText('Average Order Value')).toBeInTheDocument();
      expect(screen.getByText('Completed Orders')).toBeInTheDocument();
      expect(screen.getByText('Pending Revenue')).toBeInTheDocument();
    });
  });

  it('should display time range selector with default value', async () => {
    render(<SalesAnalyticsPage />);

    await waitFor(() => {
      const select = screen.getByLabelText(/Time Range/i);
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('30');
    });
  });

  it('should show loading state initially', () => {
    // Make getCachedData hang to keep loading state
    mockGetCachedData.mockReturnValue(new Promise(() => {}));

    render(<SalesAnalyticsPage />);

    expect(screen.getByText('Loading sales analytics...')).toBeInTheDocument();
  });

  it('should handle no orders data gracefully', async () => {
    mockGetCachedData.mockImplementation((type: string) => {
      if (type === 'orders') return Promise.resolve(null);
      if (type === 'products') return Promise.resolve(products);
      return Promise.resolve(null);
    });

    render(<SalesAnalyticsPage />);

    await waitFor(() => {
      // Should still render the page without errors even with no order data
      expect(screen.getByText('Sales Analytics')).toBeInTheDocument();
    });
  });
});
