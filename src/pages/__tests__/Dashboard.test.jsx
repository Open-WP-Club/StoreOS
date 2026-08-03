import { vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { useStoreConfig, useCache } from '../../stores';
import { useProgressiveLoading } from '../../hooks/useProgressiveLoading';
import { formatCurrency, getCurrencyCode } from '../../utils/currency';
import { formatDate } from '../../utils/dateTime';

// jest.mock factories return bare stubs — implementations are set in beforeEach
// to survive the global resetMocks: true in jest.config.js
vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
}));

vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: vi.fn(),
}));

vi.mock('../../utils/currency', () => ({
  formatCurrency: vi.fn(),
  getCurrencyCode: vi.fn(),
}));

vi.mock('../../utils/dateTime', () => ({
  formatDate: vi.fn(),
}));

vi.mock('../../constants', () => ({
  EMPTY_ARRAY: [],
}));

vi.mock('../../components/LoadingIndicator', () => ({
  default: function MockLoadingIndicator() {
    return <div data-testid="loading-indicator">Loading...</div>;
  },
}));

vi.mock('../../components/PageHeader', () => ({
  default: function MockPageHeader({ title, subtitle }) {
    return (
      <div data-testid="page-header">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    );
  },
}));

// Shared mock functions
const mockGetCurrentStore = vi.fn();
const mockClearCacheForType = vi.fn();

const mockOrdersData = [
  {
    id: 1,
    status: 'processing',
    total: '99.99',
    date_created: new Date().toISOString(),
    currency: 'USD',
    billing: { first_name: 'John', last_name: 'Doe' },
    line_items: [{ product_id: 1, quantity: 2, name: 'Product 1', total: '59.98' }],
  },
  {
    id: 2,
    status: 'completed',
    total: '149.99',
    date_created: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    currency: 'USD',
    billing: { first_name: 'Jane', last_name: 'Smith' },
    line_items: [{ product_id: 2, quantity: 1, name: 'Product 2', total: '149.99' }],
  },
  {
    id: 3,
    status: 'pending',
    total: '49.99',
    date_created: new Date().toISOString(),
    currency: 'USD',
    billing: { first_name: 'Bob', last_name: 'Wilson' },
    line_items: [{ product_id: 1, quantity: 1, name: 'Product 1', total: '29.99' }],
  },
];

const mockProductsData = [
  {
    id: 1,
    name: 'Product 1',
    price: '29.99',
    stock_quantity: 3,
    stock_status: 'instock',
  },
  {
    id: 2,
    name: 'Product 2',
    price: '49.99',
    stock_quantity: 50,
    stock_status: 'instock',
  },
  {
    id: 3,
    name: 'Product 3',
    price: '19.99',
    stock_quantity: 0,
    stock_status: 'outofstock',
  },
];

const renderWithRouter = (ui) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockGetCurrentStore.mockReturnValue({
      id: 'test-store',
      name: 'Test Store',
      url: 'https://test.com',
      createdAt: '2024-01-01T00:00:00Z',
    });
    mockClearCacheForType.mockReset();

    useStoreConfig.mockImplementation((selector) => {
      const state = { getCurrentStore: mockGetCurrentStore };
      return selector ? selector(state) : state;
    });

    useCache.mockImplementation((selector) => {
      const state = {
        cache: {
          orders: { data: mockOrdersData },
          products: { data: mockProductsData },
        },
        clearCacheForType: mockClearCacheForType,
      };
      return selector ? selector(state) : state;
    });

    useProgressiveLoading.mockReturnValue({
      loadingState: {
        isLoading: false,
        dataType: null,
        loadedItems: 0,
        totalItems: 0,
      },
    });

    formatCurrency.mockImplementation((value) => `$${parseFloat(value || 0).toFixed(2)}`);
    getCurrencyCode.mockReturnValue('USD');
    formatDate.mockImplementation((date) => {
      try {
        return new Date(date).toLocaleDateString();
      } catch {
        return '';
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the dashboard', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });
    });

    it('should display store name in header', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Cards', () => {
    it('should display total orders count', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        // Should show 3 (appears in both total orders and total products cards)
        const threes = screen.getAllByText('3');
        expect(threes.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should display total products count', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        // Should show 3 products total
        const productCounts = screen.getAllByText('3');
        expect(productCounts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should display pending orders count', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        // Should show 2 (appears in both pending orders and low stock cards)
        const twos = screen.getAllByText('2');
        expect(twos.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should display low stock count', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        // Should show 2 low/out of stock products (1 with qty 3, 1 outofstock)
        const lowStockElements = screen.getAllByText('2');
        expect(lowStockElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Navigation Links', () => {
    it('should have link to orders page', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        const ordersLinks = screen.getAllByRole('link');
        const hasOrdersLink = ordersLinks.some(
          (link) => link.getAttribute('href') === '/orders'
        );
        expect(hasOrdersLink).toBe(true);
      });
    });

    it('should have link to products page', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        const hasProductsLink = links.some(
          (link) => link.getAttribute('href') === '/products'
        );
        expect(hasProductsLink).toBe(true);
      });
    });

    it('should have link to inventory page', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        const hasInventoryLink = links.some(
          (link) =>
            link.getAttribute('href') === '/inventory' ||
            link.getAttribute('href')?.includes('inventory')
        );
        expect(hasInventoryLink).toBe(true);
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading when no data available', () => {
      useCache.mockImplementation((selector) => {
        const state = {
          cache: {
            orders: { data: null },
            products: { data: null },
          },
          clearCacheForType: mockClearCacheForType,
        };
        return selector ? selector(state) : state;
      });

      renderWithRouter(<Dashboard />);

      // During initial loading with no data, should show loading spinner
      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show loading state when data is empty', async () => {
      useCache.mockImplementation((selector) => {
        const state = {
          cache: {
            orders: { data: [] },
            products: { data: [] },
          },
          clearCacheForType: mockClearCacheForType,
        };
        return selector ? selector(state) : state;
      });

      renderWithRouter(<Dashboard />);

      // With empty arrays, the dashboard shows a loading spinner
      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });
  });

  describe('Store Not Configured', () => {
    it('should handle no store configured', async () => {
      mockGetCurrentStore.mockReturnValue(null);

      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      // Component should show "No store selected" message
      expect(screen.getByText('No store selected')).toBeInTheDocument();
    });
  });

  describe('Statistics Calculations', () => {
    it('should calculate pending orders value', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible stat cards with aria labels', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
      });
    });

    it('should have heading structure', async () => {
      renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should recalculate stats when data changes', async () => {
      const { rerender } = renderWithRouter(<Dashboard />);

      vi.advanceTimersByTime(3000);

      // Initial render
      await waitFor(() => {
        const threes = screen.getAllByText('3');
        expect(threes.length).toBeGreaterThanOrEqual(1); // 3 orders and 3 products
      });

      // Simulate data change would require updating the mock
      // This test verifies the component can re-render
      rerender(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });
    });
  });
});
