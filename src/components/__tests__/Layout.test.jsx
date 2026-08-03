import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from '../Layout';

// Mock the store hooks
vi.mock('../../stores', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  })),
  useSettings: vi.fn(() => ({
    autoRefresh: false,
    setAutoRefresh: vi.fn(),
    lowStockThreshold: 5,
  })),
  useCache: vi.fn(() => ({
    clearCacheForType: vi.fn().mockResolvedValue(true),
    getCachedData: vi.fn().mockResolvedValue(null),
  })),
  useShallow: (selector) => selector,
}));

// Mock child components
vi.mock('../StoreSelector', () => ({
  default: function MockStoreSelector() {
    return <div data-testid="store-selector">Store Selector</div>;
  },
}));

vi.mock('../GlobalSearch', () => ({
  default: function MockGlobalSearch({ placeholder, compact }) {
    return (
      <div data-testid="global-search" data-compact={compact}>
        {placeholder}
      </div>
    );
  },
}));

vi.mock('../QuickSwitcher', () => ({
  default: function MockQuickSwitcher() {
    return <div data-testid="quick-switcher">Quick Switcher</div>;
  },
}));

// Mock prefetchAnalyticsPages
vi.mock('../../App', () => ({
  prefetchAnalyticsPages: vi.fn(),
}));

// Import mocks for assertions
import { useTheme, useSettings, useCache } from '../../stores';
import { prefetchAnalyticsPages } from '../../App';

describe('Layout', () => {
  const renderLayout = async (initialRoute = '/') => {
    const result = render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<div>Dashboard Content</div>} />
            <Route path="/orders" element={<div>Orders Content</div>} />
            <Route path="/products" element={<div>Products Content</div>} />
            <Route path="/analytics" element={<div>Analytics Content</div>} />
            <Route path="/analytics/sales" element={<div>Sales Analytics</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    // Wait for async effects (getCachedData for health indicators) to settle
    await waitFor(() => {});
    return result;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store mocks with default implementations
    useTheme.mockReturnValue({
      theme: 'light',
      toggleTheme: vi.fn(),
    });

    useSettings.mockReturnValue({
      autoRefresh: false,
      setAutoRefresh: vi.fn(),
      lowStockThreshold: 5,
    });

    useCache.mockReturnValue({
      clearCacheForType: vi.fn().mockResolvedValue(true),
      getCachedData: vi.fn().mockResolvedValue(null),
    });
  });

  describe('Header', () => {
    it('should render the application title', async () => {
      await renderLayout();

      expect(screen.getByText('StoreOS')).toBeInTheDocument();
    });

    it('should render the store selector', async () => {
      await renderLayout();

      expect(screen.getByTestId('store-selector')).toBeInTheDocument();
    });

    it('should render the global search', async () => {
      await renderLayout();

      expect(screen.getByTestId('global-search')).toBeInTheDocument();
    });

    it('should render the quick switcher', async () => {
      await renderLayout();

      expect(screen.getByTestId('quick-switcher')).toBeInTheDocument();
    });

    it('should render API status indicator', async () => {
      await renderLayout();

      // Should show 'online' status by default
      expect(screen.getByText('online')).toBeInTheDocument();
    });
  });

  describe('Theme Toggle', () => {
    it('should render moon icon in light mode', async () => {
      useTheme.mockReturnValue({
        theme: 'light',
        toggleTheme: vi.fn(),
      });

      await renderLayout();

      const themeButton = screen.getByTitle(/switch to dark mode/i);
      expect(themeButton).toBeInTheDocument();
    });

    it('should render sun icon in dark mode', async () => {
      useTheme.mockReturnValue({
        theme: 'dark',
        toggleTheme: vi.fn(),
      });

      await renderLayout();

      const themeButton = screen.getByTitle(/switch to light mode/i);
      expect(themeButton).toBeInTheDocument();
    });

    it('should call toggleTheme when clicked', async () => {
      const user = userEvent.setup();
      const mockToggleTheme = vi.fn();

      useTheme.mockReturnValue({
        theme: 'light',
        toggleTheme: mockToggleTheme,
      });

      await renderLayout();

      const themeButton = screen.getByTitle(/switch to dark mode/i);
      await user.click(themeButton);

      expect(mockToggleTheme).toHaveBeenCalled();
    });
  });

  describe('Auto-Refresh Toggle', () => {
    it('should render auto-refresh button', async () => {
      await renderLayout();

      const autoRefreshButton = screen.getByTitle(/auto-refresh is off/i);
      expect(autoRefreshButton).toBeInTheDocument();
    });

    it('should show active state when auto-refresh is on', async () => {
      useSettings.mockReturnValue({
        autoRefresh: true,
        setAutoRefresh: vi.fn(),
        lowStockThreshold: 5,
      });

      await renderLayout();

      const autoRefreshButton = screen.getByTitle(/auto-refresh is on/i);
      expect(autoRefreshButton).toBeInTheDocument();
    });

    it('should toggle auto-refresh when clicked', async () => {
      const user = userEvent.setup();
      const mockSetAutoRefresh = vi.fn();

      useSettings.mockReturnValue({
        autoRefresh: false,
        setAutoRefresh: mockSetAutoRefresh,
        lowStockThreshold: 5,
      });

      await renderLayout();

      const autoRefreshButton = screen.getByTitle(/auto-refresh is off/i);
      await user.click(autoRefreshButton);

      expect(mockSetAutoRefresh).toHaveBeenCalledWith(true);
    });
  });

  describe('Navigation', () => {
    it('should render navigation links', async () => {
      const user = userEvent.setup();
      await renderLayout();

      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();

      // Orders is under "Sales" collapsible group
      await user.click(screen.getByRole('button', { name: /^sales$/i }));
      expect(screen.getByRole('link', { name: /^orders$/i })).toBeInTheDocument();

      // Products and Inventory are under "Catalog" collapsible group
      await user.click(screen.getByRole('button', { name: /^catalog$/i }));
      expect(screen.getByRole('link', { name: /^products$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^inventory$/i })).toBeInTheDocument();
    });

    it('should highlight active navigation item', async () => {
      const user = userEvent.setup();
      await renderLayout('/orders');

      // Expand Sales group to reveal Orders link
      await user.click(screen.getByRole('button', { name: /^sales$/i }));

      const ordersLink = screen.getByRole('link', { name: /^orders$/i });
      expect(ordersLink).toHaveClass('bg-blue-50');
    });

    it('should navigate to different pages', async () => {
      const user = userEvent.setup();
      await renderLayout('/');

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();

      // Expand Sales group then click Orders
      await user.click(screen.getByRole('button', { name: /^sales$/i }));
      await user.click(screen.getByRole('link', { name: /^orders$/i }));

      expect(screen.getByText('Orders Content')).toBeInTheDocument();
    });
  });

  describe('Analytics Submenu', () => {
    it('should render Analytics menu item', async () => {
      await renderLayout();

      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    it('should expand analytics submenu when clicked', async () => {
      const user = userEvent.setup();
      await renderLayout();

      const analyticsButton = screen.getByRole('button', { name: /analytics/i });
      await user.click(analyticsButton);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      // "Sales" appears as both a nav group button and an analytics submenu link
      expect(screen.getAllByText('Sales').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Financial')).toBeInTheDocument();
    });

    it('should prefetch analytics pages on hover', async () => {
      const user = userEvent.setup();
      await renderLayout();

      const analyticsButton = screen.getByRole('button', { name: /analytics/i });
      await user.hover(analyticsButton);

      expect(prefetchAnalyticsPages).toHaveBeenCalled();
    });

    it('should collapse submenu when clicked again', async () => {
      const user = userEvent.setup();
      await renderLayout();

      const analyticsButton = screen.getByRole('button', { name: /analytics/i });

      // Expand
      await user.click(analyticsButton);
      expect(screen.getByText('Overview')).toBeInTheDocument();

      // Collapse
      await user.click(analyticsButton);
      expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    });
  });

  describe('Quick Sync Actions', () => {
    it('should render quick sync buttons', async () => {
      await renderLayout();

      expect(screen.getByTitle('Refresh orders data')).toBeInTheDocument();
      expect(screen.getByTitle('Refresh products data')).toBeInTheDocument();
      expect(screen.getByTitle('Refresh inventory data')).toBeInTheDocument();
    });

    it('should have clickable orders sync button', async () => {
      const user = userEvent.setup();
      await renderLayout();

      const ordersButton = screen.getByTitle('Refresh orders data');
      expect(ordersButton).toBeInTheDocument();
      expect(ordersButton).not.toBeDisabled();

      // Just verify button is clickable - actual sync triggers page reload
      await user.click(ordersButton);
    });

    it('should have clickable products sync button', async () => {
      const user = userEvent.setup();
      await renderLayout();

      const productsButton = screen.getByTitle('Refresh products data');
      expect(productsButton).toBeInTheDocument();
      expect(productsButton).not.toBeDisabled();

      // Just verify button is clickable - actual sync triggers page reload
      await user.click(productsButton);
    });

    it('should have clickable inventory sync button', async () => {
      const user = userEvent.setup();
      await renderLayout();

      const inventoryButton = screen.getByTitle('Refresh inventory data');
      expect(inventoryButton).toBeInTheDocument();
      expect(inventoryButton).not.toBeDisabled();

      // Just verify button is clickable - actual sync triggers page reload
      await user.click(inventoryButton);
    });
  });

  describe('Health Indicators', () => {
    it('should not show pending orders indicator when count is 0', async () => {
      await renderLayout();

      expect(screen.queryByText(/pending orders/i)).not.toBeInTheDocument();
    });

    it('should not show low stock indicator when count is 0', async () => {
      await renderLayout();

      expect(screen.queryByText(/low stock/i)).not.toBeInTheDocument();
    });

    it('should show pending orders indicator when orders are pending', async () => {
      useCache.mockReturnValue({
        clearCacheForType: vi.fn(),
        getCachedData: vi.fn().mockImplementation((type) => {
          if (type === 'orders') {
            return Promise.resolve([
              { id: 1, status: 'pending' },
              { id: 2, status: 'processing' },
            ]);
          }
          return Promise.resolve(null);
        }),
      });

      await renderLayout();

      await waitFor(() => {
        expect(screen.getByText(/2 Pending Orders/i)).toBeInTheDocument();
      });
    });

    it('should show low stock indicator when products have low stock', async () => {
      useCache.mockReturnValue({
        clearCacheForType: vi.fn(),
        getCachedData: vi.fn().mockImplementation((type) => {
          if (type === 'products') {
            return Promise.resolve([
              { id: 1, stock_quantity: 3, stock_status: 'instock' },
              { id: 2, stock_status: 'outofstock' },
            ]);
          }
          return Promise.resolve(null);
        }),
      });

      await renderLayout();

      await waitFor(() => {
        expect(screen.getByText(/2 Low Stock/i)).toBeInTheDocument();
      });
    });
  });

  describe('Content Area', () => {
    it('should render child route content', async () => {
      await renderLayout('/');

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });

    it('should update content when navigating', async () => {
      const user = userEvent.setup();
      await renderLayout('/');

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();

      // Products is under "Catalog" collapsible group
      await user.click(screen.getByRole('button', { name: /^catalog$/i }));
      await user.click(screen.getByRole('link', { name: /^products$/i }));

      expect(screen.getByText('Products Content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible navigation', async () => {
      await renderLayout();

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have accessible buttons with titles', async () => {
      await renderLayout();

      expect(screen.getByTitle(/switch to/i)).toBeInTheDocument();
      expect(screen.getByTitle(/auto-refresh/i)).toBeInTheDocument();
    });
  });
});
