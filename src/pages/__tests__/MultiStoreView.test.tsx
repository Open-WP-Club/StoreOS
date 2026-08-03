import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MultiStoreView from '../MultiStoreView';
import { useStoreConfig, useCache } from '../../stores';
import WooCommerceService from '../../services/woocommerce';
import { createMockStore, createMockOrder, createMockProduct, createMockBilling } from '../../__test_utils__';

// Mock react-router-dom Link
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
  useSettings: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = { lowStockThreshold: 5 };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../services/woocommerce');

// Stable mock refs for useToast (used in component)
const mockShowToast = vi.fn();
const mockRemoveToast = vi.fn();

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    showToast: mockShowToast,
    removeToast: mockRemoveToast,
  }),
}));

vi.mock('../../components/ToastContainer', () => ({
  default: function MockToastContainer() {
    return <div data-testid="toast-container" />;
  },
}));

// Stable mock refs for cache methods (used in useCallback deps)
const mockGetCachedOrders = vi.fn();
const mockGetCachedProducts = vi.fn();
const mockSetCurrentStore = vi.fn();

describe('MultiStoreView', () => {
  const store1 = createMockStore({ name: 'Store Alpha' });
  const store2 = createMockStore({ name: 'Store Beta' });

  const ordersStore1 = [
    createMockOrder({
      status: 'completed',
      total: '100.00',
      date_created: new Date().toISOString(),
      billing: createMockBilling({ first_name: 'Alice', last_name: 'Smith', email: 'alice@example.com' }),
    }),
    createMockOrder({
      status: 'processing',
      total: '50.00',
      date_created: new Date().toISOString(),
      billing: createMockBilling({ first_name: 'Bob', last_name: 'Jones', email: 'bob@example.com' }),
    }),
  ];

  const ordersStore2 = [
    createMockOrder({
      status: 'pending',
      total: '75.00',
      date_created: new Date().toISOString(),
      billing: createMockBilling({ first_name: 'Charlie', last_name: 'Brown', email: 'charlie@example.com' }),
    }),
  ];

  const productsStore1 = [
    createMockProduct({ stock_quantity: 3 }), // low stock
    createMockProduct({ stock_quantity: 50 }),
  ];

  const productsStore2 = [
    createMockProduct({ stock_quantity: 0 }), // out of stock (low stock)
  ];

  beforeEach(() => {
    mockGetCachedOrders.mockImplementation((storeId: string) => {
      if (storeId === store1.id) return Promise.resolve(ordersStore1);
      if (storeId === store2.id) return Promise.resolve(ordersStore2);
      return Promise.resolve(null);
    });

    mockGetCachedProducts.mockImplementation((storeId: string) => {
      if (storeId === store1.id) return Promise.resolve(productsStore1);
      if (storeId === store2.id) return Promise.resolve(productsStore2);
      return Promise.resolve(null);
    });

    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        stores: [store1, store2],
        setCurrentStore: mockSetCurrentStore,
      };
      return selector ? selector(state) : state;
    });

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        getCachedOrders: mockGetCachedOrders,
        getCachedProducts: mockGetCachedProducts,
      };
      return selector ? selector(state) : state;
    });

    (WooCommerceService as unknown as Mock).mockImplementation(function () { return {
      getAllOrders: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getAllProducts: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateOrder: vi.fn().mockResolvedValue({ success: true, data: {} }),
    }; });
  });

  it('should render multi-store dashboard heading', async () => {
    render(<MultiStoreView />);

    await waitFor(() => {
      expect(screen.getByText('Multi-Store Dashboard')).toBeInTheDocument();
    });
  });

  it('should display aggregated metrics from all stores', async () => {
    render(<MultiStoreView />);

    await waitFor(() => {
      expect(screen.getByText('Total Orders')).toBeInTheDocument();
      expect(screen.getByText('Pending Orders')).toBeInTheDocument();
      expect(screen.getByText('Total Products')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Items')).toBeInTheDocument();
    });
  });

  it('should show store overview cards', async () => {
    render(<MultiStoreView />);

    await waitFor(() => {
      expect(screen.getByText('Store Overview')).toBeInTheDocument();
      // Store names appear in overview cards and in order table badges
      expect(screen.getAllByText('Store Alpha').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Store Beta').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should show the unified orders table', async () => {
    render(<MultiStoreView />);

    await waitFor(() => {
      expect(screen.getByText('All Orders')).toBeInTheDocument();
      expect(screen.getByText('Refresh All')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    // Keep the promises pending forever
    mockGetCachedOrders.mockReturnValue(new Promise(() => {}));
    mockGetCachedProducts.mockReturnValue(new Promise(() => {}));

    render(<MultiStoreView />);

    expect(screen.getByText(/Loading data from all stores/)).toBeInTheDocument();
  });

  it('should show no stores message when stores array is empty', async () => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        stores: [],
        setCurrentStore: mockSetCurrentStore,
      };
      return selector ? selector(state) : state;
    });

    render(<MultiStoreView />);

    await waitFor(() => {
      // When stores is empty, loadAllStoresData sets error='No stores configured'
      // which renders the error UI path
      expect(screen.getByText('No stores configured')).toBeInTheDocument();
    });
  });

  it('should display recent order activity section', async () => {
    render(<MultiStoreView />);

    await waitFor(() => {
      expect(screen.getByText('Recent Order Activity')).toBeInTheDocument();
    });
  });
});
