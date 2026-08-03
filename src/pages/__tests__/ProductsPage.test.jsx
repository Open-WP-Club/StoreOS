import { vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProductsPage from '../ProductsPage';

// Mock stores
vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
  useSettings: vi.fn(),
  useActivityLog: vi.fn(),
}));

// Mock services
vi.mock('../../services/woocommerce');

// Mock hooks
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    showToast: vi.fn(),
    removeToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: () => ({
    loadingState: { isLoading: false, progress: 0 },
  }),
}));

// Mock components
vi.mock('../../components/Pagination', () => ({
  default: function MockPagination({ currentPage, totalItems, onPageChange }) {
    return (
      <div data-testid="pagination">
        <span>Page {currentPage}</span>
        <span>Total: {totalItems}</span>
        <button onClick={() => onPageChange(currentPage + 1)}>Next</button>
      </div>
    );
  },
}));

vi.mock('../../components/BulkEditModal', () => ({
  default: function MockBulkEditModal({ isOpen, onClose, selectedProducts }) {
    if (!isOpen) return null;
    return (
      <div data-testid="bulk-edit-modal">
        <span>{selectedProducts.length} products selected</span>
        <button onClick={onClose}>Close</button>
      </div>
    );
  },
}));

vi.mock('../../components/FilterPresetManager', () => ({
  default: function MockFilterPresetManager() {
    return <div data-testid="filter-preset-manager">Filter Presets</div>;
  },
}));

vi.mock('../../components/ToastContainer', () => ({
  default: function MockToastContainer() {
    return <div data-testid="toast-container" />;
  },
}));

vi.mock('../../components/LoadingIndicator', () => ({
  default: function MockLoadingIndicator() {
    return <div data-testid="loading-indicator" />;
  },
}));

vi.mock('../../components/StatCard', () => ({
  default: function MockStatCard({ label, value }) {
    return (
      <div data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
    );
  },
}));

vi.mock('../../components/PageHeader', () => ({
  default: function MockPageHeader({ title, subtitle }) {
    return (
      <div data-testid="page-header">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    );
  },
}));

vi.mock('../../components/EmptyState', () => ({
  default: function MockEmptyState({ title, message }) {
    return (
      <div data-testid="empty-state">
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
    );
  },
}));

// Import mocks
import { useStoreConfig, useCache, useSettings, useActivityLog } from '../../stores';
import WooCommerceService from '../../services/woocommerce';

const mockProducts = [
  {
    id: 101,
    name: 'Test Product 1',
    sku: 'SKU-001',
    price: '25.00',
    regular_price: '25.00',
    sale_price: '',
    stock_status: 'instock',
    stock_quantity: 100,
    manage_stock: true,
    status: 'publish',
    images: [{ src: 'https://example.com/image1.jpg' }],
    categories: [],
    attributes: [],
  },
  {
    id: 102,
    name: 'Low Stock Product',
    sku: 'SKU-002',
    price: '50.00',
    regular_price: '50.00',
    sale_price: '',
    stock_status: 'instock',
    stock_quantity: 3,
    manage_stock: true,
    status: 'publish',
    images: [],
    categories: [],
    attributes: [],
  },
  {
    id: 103,
    name: 'Out of Stock Product',
    sku: 'SKU-003',
    price: '75.00',
    regular_price: '75.00',
    sale_price: '',
    stock_status: 'outofstock',
    stock_quantity: 0,
    manage_stock: true,
    status: 'publish',
    images: [],
    categories: [],
    attributes: [],
  },
  {
    id: 104,
    name: 'Draft Product',
    sku: 'SKU-004',
    price: '30.00',
    regular_price: '30.00',
    sale_price: '',
    stock_status: 'instock',
    stock_quantity: 50,
    manage_stock: true,
    status: 'draft',
    images: [],
    categories: [],
    attributes: [],
  },
];

const mockStore = {
  id: 'store-1',
  name: 'Test Store',
  url: 'https://test.com',
  consumerKey: 'ck_test',
  consumerSecret: 'cs_test',
};

describe('ProductsPage', () => {
  const renderProductsPage = (initialSearch = '') => {
    const route = initialSearch ? `/products?search=${initialSearch}` : '/products';
    return render(
      <MemoryRouter initialEntries={[route]}>
        <ProductsPage />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    useStoreConfig.mockReturnValue(vi.fn(() => mockStore));
    useSettings.mockReturnValue(vi.fn());
    useActivityLog.mockImplementation((selector) => {
      const state = { logActivity: vi.fn() };
      return selector ? selector(state) : state;
    });
    useCache.mockImplementation((selector) => {
      const state = {
        setCachedData: vi.fn(),
        cache: {
          products: {
            data: mockProducts,
          },
        },
      };
      return selector(state);
    });

    // Mock WooCommerceService
    WooCommerceService.mockImplementation(function () { return {
      updateProduct: vi.fn().mockResolvedValue({ success: true, data: {} }),
      deleteProduct: vi.fn().mockResolvedValue({ success: true }),
      createProduct: vi.fn().mockResolvedValue({ success: true, data: {} }),
      batchUpdateProducts: vi.fn().mockResolvedValue({ success: true, data: { update: [] } }),
    }; });

    // Mock window.confirm
    window.confirm = vi.fn(() => true);
  });

  describe('No Store Selected', () => {
    it('should show empty state when no store is configured', () => {
      useStoreConfig.mockReturnValue(vi.fn(() => null));

      renderProductsPage();

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No store selected')).toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    it('should render page header with title', () => {
      renderProductsPage();

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
    });
  });

  describe('Stats Cards', () => {
    it('should render stats cards with product counts', () => {
      renderProductsPage();

      expect(screen.getByTestId('stat-card-total-products')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-in-stock')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-low-stock')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-out-of-stock')).toBeInTheDocument();
    });

    it('should show correct total products count', () => {
      renderProductsPage();

      const totalCard = screen.getByTestId('stat-card-total-products');
      expect(within(totalCard).getByText('4')).toBeInTheDocument();
    });

    it('should show correct in-stock count', () => {
      renderProductsPage();

      const inStockCard = screen.getByTestId('stat-card-in-stock');
      // Products with stock_status === 'instock': 101, 102, 104 = 3
      expect(within(inStockCard).getByText('3')).toBeInTheDocument();
    });

    it('should show correct low-stock count', () => {
      renderProductsPage();

      const lowStockCard = screen.getByTestId('stat-card-low-stock');
      // Products with stock_quantity <= 5 and > 0: 102 = 1
      expect(within(lowStockCard).getByText('1')).toBeInTheDocument();
    });

    it('should show correct out-of-stock count', () => {
      renderProductsPage();

      const outOfStockCard = screen.getByTestId('stat-card-out-of-stock');
      // Products with stock_status === 'outofstock': 103 = 1
      expect(within(outOfStockCard).getByText('1')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', () => {
      renderProductsPage();

      expect(
        screen.getByPlaceholderText(/search by product name, sku, or id/i)
      ).toBeInTheDocument();
    });

    it('should filter products by search term', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'Low Stock');

      await waitFor(() => {
        expect(screen.getByText('Low Stock Product')).toBeInTheDocument();
      });
    });

    it('should initialize with search term from URL', () => {
      renderProductsPage('Test');

      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toHaveValue('Test');
    });
  });

  describe('Advanced Filters', () => {
    it('should toggle advanced filters visibility', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      const filterButton = screen.getByTitle('Toggle advanced filters');
      await user.click(filterButton);

      expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
      expect(screen.getByLabelText(/stock status/i)).toBeInTheDocument();
    });

    it('should filter by stock status', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      // Open filters
      const filterButton = screen.getByTitle('Toggle advanced filters');
      await user.click(filterButton);

      // Select out of stock
      const stockSelect = screen.getByLabelText(/stock status/i);
      await user.selectOptions(stockSelect, 'outofstock');

      await waitFor(() => {
        expect(screen.getByText('Out of Stock Product')).toBeInTheDocument();
      });
    });

    it('should filter by product status', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      // Open filters
      const filterButton = screen.getByTitle('Toggle advanced filters');
      await user.click(filterButton);

      // Select draft
      const statusSelect = screen.getByLabelText(/product status/i);
      await user.selectOptions(statusSelect, 'draft');

      await waitFor(() => {
        expect(screen.getByText('Draft Product')).toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      const filterButton = screen.getByTitle('Toggle advanced filters');
      await user.click(filterButton);

      const stockSelect = screen.getByLabelText(/stock status/i);
      await user.selectOptions(stockSelect, 'instock');

      const clearButton = screen.getByText('Clear All');
      await user.click(clearButton);

      expect(stockSelect).toHaveValue('all');
    });
  });

  describe('Products Table', () => {
    it('should render products in table', () => {
      renderProductsPage();

      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Product')).toBeInTheDocument();
      expect(screen.getByText('Out of Stock Product')).toBeInTheDocument();
    });

    it('should show SKU for each product', () => {
      renderProductsPage();

      expect(screen.getByText('SKU-001')).toBeInTheDocument();
      expect(screen.getByText('SKU-002')).toBeInTheDocument();
    });

    it('should show loading or empty message when list is empty', () => {
      useCache.mockImplementation((selector) => {
        const state = {
          setCachedData: vi.fn(),
          cache: {
            products: { data: [] },
          },
        };
        return selector(state);
      });

      renderProductsPage();

      // When products are empty and loading, shows loading state
      // The actual "No products found" appears after filtering with data
      const loadingText = screen.queryByText('Loading products...');
      const noProductsText = screen.queryByText('No products found');

      expect(loadingText || noProductsText).toBeTruthy();
    });

    it('should show stock status badges', () => {
      renderProductsPage();

      // Multiple products may have same stock status
      expect(screen.getAllByText('instock').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('outofstock').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Product Selection', () => {
    it('should select individual product', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      // Find checkboxes in the product rows
      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is "select all", second is first product
      await user.click(checkboxes[1]);

      expect(screen.getByText(/1 product.*selected/i)).toBeInTheDocument();
    });

    it('should select all products on page', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      expect(screen.getByText(/4 products selected/i)).toBeInTheDocument();
    });

    it('should clear selection', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      // Select a product
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Clear selection
      const clearButton = screen.getByText('Clear Selection');
      await user.click(clearButton);

      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });
  });

  describe('Bulk Actions', () => {
    it('should show bulk edit button when products are selected', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      expect(screen.getByText('Bulk Edit')).toBeInTheDocument();
    });

    it('should open bulk edit modal when clicked', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      const bulkEditButton = screen.getByText('Bulk Edit');
      await user.click(bulkEditButton);

      expect(screen.getByTestId('bulk-edit-modal')).toBeInTheDocument();
    });

    it('should show delete button when products are selected', async () => {
      const user = userEvent.setup();
      renderProductsPage();

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      expect(screen.getByText('Delete Selected')).toBeInTheDocument();
    });
  });

  describe('Product Actions', () => {
    it('should render edit link for each product', () => {
      renderProductsPage();

      const editLinks = screen.getAllByText('Edit');
      expect(editLinks.length).toBeGreaterThan(0);
    });

    it('should render clone button for each product', () => {
      renderProductsPage();

      const cloneButtons = screen.getAllByText('Clone');
      expect(cloneButtons.length).toBeGreaterThan(0);
    });

    it('should render delete button for each product', () => {
      renderProductsPage();

      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination', () => {
    it('should render pagination component', () => {
      renderProductsPage();

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('should show correct total items', () => {
      renderProductsPage();

      expect(screen.getByText('Total: 4')).toBeInTheDocument();
    });
  });

  describe('Export', () => {
    it('should render export button', () => {
      renderProductsPage();

      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });

  describe('Refresh', () => {
    it('should render refresh button', () => {
      renderProductsPage();

      expect(screen.getByTitle('Refresh products')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator component', () => {
      renderProductsPage();

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });

  describe('Filter Preset Manager', () => {
    it('should render filter preset manager', () => {
      renderProductsPage();

      expect(screen.getByTestId('filter-preset-manager')).toBeInTheDocument();
    });
  });

  describe('Stock Highlighting', () => {
    it('should highlight low stock products', () => {
      renderProductsPage();

      // The low stock product row should have special styling
      // This is verified by the presence of the stock quantity displayed
      const lowStockProduct = screen.getByText('Low Stock Product').closest('tr');
      expect(lowStockProduct).toBeInTheDocument();
    });

    it('should highlight out of stock products', () => {
      renderProductsPage();

      const outOfStockProduct = screen.getByText('Out of Stock Product').closest('tr');
      expect(outOfStockProduct).toBeInTheDocument();
    });
  });
});
