import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CouponsPage from '../CouponsPage';
import { createMockStore } from '../../__test_utils__';
import { useStoreConfig, useCache, useActivityLog } from '../../stores';

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
  useActivityLog: vi.fn(),
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
  exportTableToPDF: vi.fn(() => Promise.resolve()),
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
  default: function MockLoadingIndicator() {
    return <div data-testid="loading-indicator">Loading...</div>;
  },
}));

vi.mock('../../components/StatCard', () => ({
  default: function MockStatCard({ label }: { label: string }) {
    return <div data-testid={`stat-${label}`}>{label}</div>;
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
  EMPTY_COUPONS: [],
}));

const mockCoupons = [
  {
    id: 1,
    code: 'SAVE10',
    amount: '10.00',
    discount_type: 'percent',
    description: 'Save 10%',
    date_expires: null,
    usage_count: 5,
    usage_limit: 100,
    individual_use: false,
    free_shipping: false,
    minimum_amount: '0.00',
    maximum_amount: '0.00',
    exclude_sale_items: false,
    date_created: '2025-01-01T00:00:00',
    status: 'publish',
  },
];

const EMPTY_COUPONS_MOCK: unknown[] = [];

describe('CouponsPage', () => {
  const mockStore = createMockStore();
  const mockGetCachedData = vi.fn();
  const mockSetCachedData = vi.fn();
  const mockClearCacheForType = vi.fn();

  beforeEach(() => {
    mockGetCachedData.mockResolvedValue(mockCoupons);
    mockSetCachedData.mockResolvedValue(undefined);
    mockClearCacheForType.mockResolvedValue(undefined);

    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockStore };
      return selector ? selector(state) : state;
    });

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        cache: { coupons: { data: mockCoupons } },
        getCachedData: mockGetCachedData,
        setCachedData: mockSetCachedData,
        clearCacheForType: mockClearCacheForType,
      };
      return selector ? selector(state) : state;
    });

    (useActivityLog as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { logActivity: vi.fn() };
      return selector ? selector(state) : state;
    });
  });

  it('should render page header', () => {
    render(
      <MemoryRouter>
        <CouponsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('should display coupons when data exists', async () => {
    render(
      <MemoryRouter>
        <CouponsPage />
      </MemoryRouter>
    );

    // Component initializes with couponsFromCache which has data, so loading is false
    await waitFor(() => {
      expect(screen.getByText('SAVE10')).toBeInTheDocument();
    });
  });

  it('should show loading when no cached data', async () => {
    mockGetCachedData.mockResolvedValue(null);

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        cache: { coupons: { data: EMPTY_COUPONS_MOCK } },
        getCachedData: mockGetCachedData,
        setCachedData: mockSetCachedData,
        clearCacheForType: mockClearCacheForType,
      };
      return selector ? selector(state) : state;
    });

    render(
      <MemoryRouter>
        <CouponsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Wait for async effects to settle to avoid act() warnings
    await waitFor(() => {});
  });
});
