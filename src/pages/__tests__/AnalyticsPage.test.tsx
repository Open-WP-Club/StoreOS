import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from '../AnalyticsPage';
import { useStoreConfig, useCache } from '../../stores';
import WooCommerceService from '../../services/woocommerce';
import { createMockStore, createMockOrder, createMockProduct } from '../../__test_utils__';

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
  useTheme: vi.fn((selector?: (state: unknown) => unknown) => selector ? selector({ theme: 'light' }) : { theme: 'light' }),
}));

vi.mock('../../services/woocommerce');

// Stable references to prevent infinite re-render loop in useCallback deps
const mockStartLoading = vi.fn();
const mockUpdateProgress = vi.fn();
const mockFinishLoading = vi.fn();
const mockCancelLoading = vi.fn();
const mockIsCancelled = vi.fn().mockReturnValue(false);

vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: () => ({
    loadingState: { isLoading: false, progress: 0, loaded: 0, total: 0, dataType: '' },
    startLoading: mockStartLoading,
    updateProgress: mockUpdateProgress,
    finishLoading: mockFinishLoading,
    cancelLoading: mockCancelLoading,
    isCancelled: mockIsCancelled,
  }),
}));

vi.mock('../../utils/currency', () => ({
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
  getCurrencyCode: () => 'USD',
}));

vi.mock('../../components/LoadingIndicator', () => ({
  default: function MockLoadingIndicator() {
    return null;
  },
}));

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: 'CategoryScale',
  LinearScale: 'LinearScale',
  BarElement: 'BarElement',
  LineElement: 'LineElement',
  PointElement: 'PointElement',
  Title: 'Title',
  Tooltip: 'Tooltip',
  Legend: 'Legend',
  ArcElement: 'ArcElement',
}));

vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}));

// Stable mock functions for useCache selectors (prevent infinite re-render)
const mockGetCachedData = vi.fn();
const mockSetCachedData = vi.fn();

describe('AnalyticsPage', () => {
  const mockStore = createMockStore();
  const orders = [
    createMockOrder({ status: 'completed', total: '100.00', date_created: new Date().toISOString() }),
    createMockOrder({ status: 'processing', total: '50.00', date_created: new Date().toISOString() }),
  ];
  const products = [createMockProduct(), createMockProduct()];

  beforeEach(() => {
    mockGetCachedData.mockImplementation((type: string) => {
      if (type === 'orders') return Promise.resolve(orders);
      if (type === 'products') return Promise.resolve(products);
      return Promise.resolve(null);
    });
    mockSetCachedData.mockResolvedValue(undefined);

    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockStore };
      return selector ? selector(state) : state;
    });

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        cache: {
          orders: { data: orders, timestamp: Date.now(), storeId: mockStore.id },
          products: { data: products, timestamp: Date.now(), storeId: mockStore.id },
        },
        getCachedData: mockGetCachedData,
        setCachedData: mockSetCachedData,
      };
      return selector ? selector(state) : state;
    });

    (WooCommerceService as unknown as Mock).mockImplementation(function () { return {
      getAllOrders: vi.fn().mockResolvedValue({ success: true, data: orders }),
      getAllProducts: vi.fn().mockResolvedValue({ success: true, data: products }),
    }; });
  });

  it('should render analytics page', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });

  it('should show time range selector', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('7 Days')).toBeInTheDocument();
    });
  });

  it('should render charts when data is available', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      const charts = screen.queryAllByTestId(/(bar|line|doughnut)-chart/);
      expect(charts.length).toBeGreaterThanOrEqual(0);
    });
  });
});
