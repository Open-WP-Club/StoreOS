import { vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OrdersPage from '../OrdersPage';

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

vi.mock('../../components/BulkActionsBar', () => ({
  default: function MockBulkActionsBar({ selectedCount, onClearSelection }) {
    return (
      <div data-testid="bulk-actions-bar">
        <span>{selectedCount} selected</span>
        <button onClick={onClearSelection}>Clear</button>
      </div>
    );
  },
}));

vi.mock('../../components/OrderTableRow', () => ({
  default: function MockOrderTableRow({ order, isSelected, onSelect }) {
    return (
      <tr data-testid={`order-row-${order.id}`}>
        <td>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(order.id)}
            data-testid={`order-checkbox-${order.id}`}
          />
        </td>
        <td>#{order.id}</td>
        <td>{order.billing?.first_name} {order.billing?.last_name}</td>
        <td>{order.status}</td>
        <td>{order.total}</td>
      </tr>
    );
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

// Stable reference so the mocked useCache selector doesn't return a new array
// on every render (matches real Zustand's stable-until-updated semantics).
const EMPTY_ORDERS_MOCK = [];

const mockOrders = [
  {
    id: 1001,
    status: 'processing',
    date_created: '2024-01-15T10:30:00',
    total: '150.00',
    currency: 'USD',
    billing: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
    },
    line_items: [{ name: 'Product A', quantity: 2 }],
    payment_method_title: 'Credit Card',
  },
  {
    id: 1002,
    status: 'pending',
    date_created: '2024-01-14T09:00:00',
    total: '75.00',
    currency: 'USD',
    billing: {
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
    },
    line_items: [{ name: 'Product B', quantity: 1 }],
    payment_method_title: 'PayPal',
  },
  {
    id: 1003,
    status: 'completed',
    date_created: '2024-01-13T14:00:00',
    total: '200.00',
    currency: 'USD',
    billing: {
      first_name: 'Bob',
      last_name: 'Johnson',
      email: 'bob@example.com',
    },
    line_items: [{ name: 'Product C', quantity: 3 }],
    payment_method_title: 'Bank Transfer',
  },
];

const mockStore = {
  id: 'store-1',
  name: 'Test Store',
  url: 'https://test.com',
  consumerKey: 'ck_test',
  consumerSecret: 'cs_test',
};

describe('OrdersPage', () => {
  const renderOrdersPage = (initialSearch = '') => {
    const route = initialSearch ? `/orders?search=${initialSearch}` : '/orders';
    return render(
      <MemoryRouter initialEntries={[route]}>
        <OrdersPage />
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
          orders: {
            data: mockOrders,
          },
        },
      };
      return selector(state);
    });

    // Mock WooCommerceService
    WooCommerceService.mockImplementation(function () { return {
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
      deleteOrder: vi.fn().mockResolvedValue({ success: true }),
    }; });
  });

  describe('No Store Selected', () => {
    it('should show empty state when no store is configured', () => {
      useStoreConfig.mockReturnValue(vi.fn(() => null));

      renderOrdersPage();

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No store selected')).toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    it('should render page header with title', () => {
      renderOrdersPage();

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
    });
  });

  describe('Stats Cards', () => {
    it('should render stats cards with order counts', () => {
      renderOrdersPage();

      expect(screen.getByTestId('stat-card-total-orders')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-pending')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-processing')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-completed')).toBeInTheDocument();
    });

    it('should show correct total orders count', () => {
      renderOrdersPage();

      const totalCard = screen.getByTestId('stat-card-total-orders');
      expect(within(totalCard).getByText('3')).toBeInTheDocument();
    });

    it('should show correct pending count', () => {
      renderOrdersPage();

      const pendingCard = screen.getByTestId('stat-card-pending');
      expect(within(pendingCard).getByText('1')).toBeInTheDocument();
    });

    it('should show correct processing count', () => {
      renderOrdersPage();

      const processingCard = screen.getByTestId('stat-card-processing');
      expect(within(processingCard).getByText('1')).toBeInTheDocument();
    });

    it('should show correct completed count', () => {
      renderOrdersPage();

      const completedCard = screen.getByTestId('stat-card-completed');
      expect(within(completedCard).getByText('1')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', () => {
      renderOrdersPage();

      expect(
        screen.getByPlaceholderText(/search by order id, customer name, or email/i)
      ).toBeInTheDocument();
    });

    it('should filter orders by search term', async () => {
      const user = userEvent.setup();
      renderOrdersPage();

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByTestId('order-row-1001')).toBeInTheDocument();
        expect(screen.queryByTestId('order-row-1002')).not.toBeInTheDocument();
      });
    });

    it('should initialize with search term from URL', () => {
      renderOrdersPage('John');

      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toHaveValue('John');
    });
  });

  describe('Advanced Filters', () => {
    it('should toggle advanced filters visibility', async () => {
      const user = userEvent.setup();
      renderOrdersPage();

      const filterButton = screen.getByTitle('Toggle advanced filters');
      await user.click(filterButton);

      expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
      expect(screen.getByLabelText(/order status/i)).toBeInTheDocument();
    });

    it('should filter by status', async () => {
      const user = userEvent.setup();
      renderOrdersPage();

      // Open filters
      const filterButton = screen.getByTitle('Toggle advanced filters');
      await user.click(filterButton);

      // Select status
      const statusSelect = screen.getByLabelText(/order status/i);
      await user.selectOptions(statusSelect, 'completed');

      await waitFor(() => {
        expect(screen.getByTestId('order-row-1003')).toBeInTheDocument();
        expect(screen.queryByTestId('order-row-1001')).not.toBeInTheDocument();
      });
    });

    it('should show clear all button when filters are active', async () => {
      const user = userEvent.setup();
      renderOrdersPage();

      const filterButton = screen.getByTitle('Toggle advanced filters');
      await user.click(filterButton);

      const statusSelect = screen.getByLabelText(/order status/i);
      await user.selectOptions(statusSelect, 'pending');

      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('should clear all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderOrdersPage();

      const filterButton = screen.getByTitle('Toggle advanced filters');
      await user.click(filterButton);

      const statusSelect = screen.getByLabelText(/order status/i);
      await user.selectOptions(statusSelect, 'pending');

      const clearButton = screen.getByText('Clear All');
      await user.click(clearButton);

      expect(statusSelect).toHaveValue('all');
    });
  });

  describe('Orders Table', () => {
    it('should render orders in table', () => {
      renderOrdersPage();

      expect(screen.getByTestId('order-row-1001')).toBeInTheDocument();
      expect(screen.getByTestId('order-row-1002')).toBeInTheDocument();
      expect(screen.getByTestId('order-row-1003')).toBeInTheDocument();
    });

    it('should show loading or empty message when list is empty', () => {
      useCache.mockImplementation((selector) => {
        const state = {
          setCachedData: vi.fn(),
          cache: {
            orders: { data: EMPTY_ORDERS_MOCK },
          },
        };
        return selector(state);
      });

      renderOrdersPage();

      // When orders are empty and loading, shows loading state
      // The actual "No orders found" appears after filtering with data
      const loadingText = screen.queryByText('Loading orders...');
      const noOrdersText = screen.queryByText('No orders found');

      expect(loadingText || noOrdersText).toBeTruthy();
    });
  });

  describe('Order Selection', () => {
    it('should select individual order', async () => {
      const user = userEvent.setup();
      renderOrdersPage();

      const checkbox = screen.getByTestId('order-checkbox-1001');
      await user.click(checkbox);

      expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('should select all orders on page', async () => {
      const user = userEvent.setup();
      renderOrdersPage();

      // Find and click the select all checkbox in the header
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      expect(screen.getByText('3 selected')).toBeInTheDocument();
    });

    it('should clear selection when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderOrdersPage();

      // Select an order
      const checkbox = screen.getByTestId('order-checkbox-1001');
      await user.click(checkbox);

      expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument();

      // Clear selection
      const clearButton = within(screen.getByTestId('bulk-actions-bar')).getByText('Clear');
      await user.click(clearButton);

      expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should render pagination component', () => {
      renderOrdersPage();

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('should show correct total items', () => {
      renderOrdersPage();

      expect(screen.getByText('Total: 3')).toBeInTheDocument();
    });
  });

  describe('Export', () => {
    it('should render export button', () => {
      renderOrdersPage();

      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });

  describe('Refresh', () => {
    it('should render refresh button', () => {
      renderOrdersPage();

      expect(screen.getByTitle('Refresh orders')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading', () => {
      useCache.mockImplementation((selector) => {
        const state = {
          setCachedData: vi.fn(),
          cache: {
            orders: { data: EMPTY_ORDERS_MOCK },
          },
        };
        return selector(state);
      });

      renderOrdersPage();

      // Since orders is empty initially, loading should be true
      expect(screen.getByText('Loading orders...')).toBeInTheDocument();
    });
  });

  describe('Filter Preset Manager', () => {
    it('should render filter preset manager', () => {
      renderOrdersPage();

      expect(screen.getByTestId('filter-preset-manager')).toBeInTheDocument();
    });
  });
});
