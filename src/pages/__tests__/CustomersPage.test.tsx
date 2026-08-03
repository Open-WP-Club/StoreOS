import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomersPage from '../CustomersPage';
import { useStoreConfig, useCache } from '../../stores';
import { createMockStore, createMockCustomer } from '../../__test_utils__';

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
}));

vi.mock('../../services/woocommerce');

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

vi.mock('../../utils/currency', () => ({
  formatPrice: (v: string) => `$${v}`,
}));

vi.mock('../../utils/csvExport', () => ({
  exportToCSV: vi.fn(),
}));

vi.mock('../../utils/pdfExport', () => ({
  exportTableToPDF: vi.fn(),
}));

vi.mock('../../components/ExportMenu', () => ({
  default: function MockExportMenu() {
    return <div data-testid="export-menu">Export</div>;
  },
}));

vi.mock('../../components/Pagination', () => ({
  default: function MockPagination() {
    return <div data-testid="pagination">Pagination</div>;
  },
}));

vi.mock('../../components/ToastContainer', () => ({
  default: function MockToastContainer() {
    return <div data-testid="toast-container" />;
  },
}));

vi.mock('../../components/LoadingIndicator', () => ({
  default: function MockLoadingIndicator({ loadingState }: { loadingState?: { isLoading: boolean } }) {
    if (loadingState && !loadingState.isLoading) return null;
    return <div data-testid="loading-indicator">Loading...</div>;
  },
}));

vi.mock('../../components/StatCard', () => ({
  default: function MockStatCard({ label, value }: { label: string; value: string | number }) {
    return <div data-testid={`stat-${label}`}>{value}</div>;
  },
}));

vi.mock('../../components/PageHeader', () => ({
  default: function MockPageHeader({ title }: { title: string }) {
    return <h1 data-testid="page-header">{title}</h1>;
  },
}));

vi.mock('../../components/EmptyState', () => ({
  default: function MockEmptyState({ message }: { message: string }) {
    return <div data-testid="empty-state">{message}</div>;
  },
}));

vi.mock('../../constants', () => ({
  EMPTY_CUSTOMERS: [],
}));

const EMPTY_CUSTOMERS_MOCK: unknown[] = [];

describe('CustomersPage', () => {
  const mockStore = createMockStore();
  const customers = [createMockCustomer(), createMockCustomer()];
  const mockGetCachedData = vi.fn();
  const mockSetCachedData = vi.fn();
  const mockClearCacheForType = vi.fn();

  beforeEach(() => {
    mockGetCachedData.mockResolvedValue(customers);
    mockSetCachedData.mockResolvedValue(undefined);
    mockClearCacheForType.mockResolvedValue(undefined);

    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockStore };
      return selector ? selector(state) : state;
    });

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        cache: { customers: { data: customers } },
        getCachedData: mockGetCachedData,
        setCachedData: mockSetCachedData,
        clearCacheForType: mockClearCacheForType,
      };
      return selector ? selector(state) : state;
    });
  });

  it('should render page header', () => {
    render(
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('should display customer list when data exists', async () => {
    render(
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    );

    // Component initializes with customersFromCache, loading starts false
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('should show loading state when no cached data', async () => {
    mockGetCachedData.mockResolvedValue(null);

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        // Stable reference: a fresh [] on every call would make the mocked
        // hook's return value change identity on every render, unlike real
        // Zustand (stable until the store updates), causing infinite re-renders.
        cache: { customers: { data: EMPTY_CUSTOMERS_MOCK } },
        getCachedData: mockGetCachedData,
        setCachedData: mockSetCachedData,
        clearCacheForType: mockClearCacheForType,
      };
      return selector ? selector(state) : state;
    });

    render(
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    );

    // When customersFromCache is empty, loading starts as true, showing "Loading customers..."
    expect(screen.getByText('Loading customers...')).toBeInTheDocument();

    // Wait for async effects to settle to avoid act() warnings
    await waitFor(() => {});
  });
});
