import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProductAnalyticsPage from '../ProductAnalyticsPage';
import { createMockOrder, createMockProduct, createMockLineItem } from '../../__test_utils__';
import { useCache } from '../../stores';

vi.mock('../../stores', () => ({
  useCache: vi.fn(),
  useStoreConfig: vi.fn(),
  useTheme: vi.fn((selector?: (state: unknown) => unknown) => selector ? selector({ theme: 'light' }) : { theme: 'light' }),
  useSettings: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = { lowStockThreshold: 5 };
    return selector ? selector(state) : state;
  }),
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

describe('ProductAnalyticsPage', () => {
  const now = new Date();

  const products = [
    createMockProduct({ stock_status: 'instock', stock_quantity: 50, price: '29.99', sale_price: '', sku: 'SKU-1', categories: [{ id: 1, name: 'Electronics', slug: 'electronics' }] }),
    createMockProduct({ stock_status: 'instock', stock_quantity: 3, price: '49.99', sale_price: '39.99', sku: 'SKU-2', categories: [{ id: 2, name: 'Clothing', slug: 'clothing' }] }),
    createMockProduct({ stock_status: 'outofstock', stock_quantity: 0, price: '19.99', sale_price: '', sku: '', categories: [] }),
    createMockProduct({ stock_status: 'instock', stock_quantity: 100, price: '9.99', sale_price: '', sku: 'SKU-4', status: 'draft' }),
  ];

  const orders = [
    createMockOrder({
      status: 'completed',
      total: '100.00',
      date_created: now.toISOString(),
      line_items: [createMockLineItem({ product_id: products[0]!.id, name: products[0]!.name, quantity: 2, total: '59.98' })],
    }),
  ];

  beforeEach(() => {
    mockGetCachedData.mockImplementation((type: string) => {
      if (type === 'products') return Promise.resolve(products);
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

  it('should render product analytics page with heading', async () => {
    render(<ProductAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Product Analytics')).toBeInTheDocument();
    });
  });

  it('should show key inventory metric cards', async () => {
    render(<ProductAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Products')).toBeInTheDocument();
      expect(screen.getByText('In Stock')).toBeInTheDocument();
      expect(screen.getByText('Low Stock')).toBeInTheDocument();
      expect(screen.getByText('Out of Stock')).toBeInTheDocument();
      expect(screen.getByText('Inventory Value')).toBeInTheDocument();
    });
  });

  it('should display additional product quality metrics', async () => {
    render(<ProductAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Avg. Price')).toBeInTheDocument();
      expect(screen.getByText('On Sale')).toBeInTheDocument();
      expect(screen.getByText('No Images')).toBeInTheDocument();
      expect(screen.getByText('Draft/Pending')).toBeInTheDocument();
      expect(screen.getByText('Missing SKU')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    mockGetCachedData.mockReturnValue(new Promise(() => {}));

    render(<ProductAnalyticsPage />);

    expect(screen.getByText('Loading product analytics...')).toBeInTheDocument();
  });

  it('should handle null products gracefully', async () => {
    mockGetCachedData.mockResolvedValue(null);

    render(<ProductAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Product Analytics')).toBeInTheDocument();
    });
  });

  it('should show chart sections', async () => {
    render(<ProductAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Stock Status Distribution')).toBeInTheDocument();
      expect(screen.getByText('Top 10 Categories by Revenue')).toBeInTheDocument();
    });
  });
});
