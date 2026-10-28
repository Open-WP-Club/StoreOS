import { vi, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], showToast, removeToast: vi.fn() }),
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

import WooCommerceService from '../../services/woocommerce';

const mkCoupon = (id: number) => ({
  id,
  code: `CODE${id}`,
  amount: '10.00',
  discount_type: 'percent',
  description: '',
  date_expires: null,
  usage_count: 0,
  usage_limit: null,
});
const coupons = [1, 2, 3].map(mkCoupon);
const batchCoupons = vi.fn();
const setCachedData = vi.fn();
const logActivity = vi.fn();

describe('CouponsPage bulk delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const store = createMockStore();
    (useStoreConfig as unknown as Mock).mockImplementation((sel?: (s: unknown) => unknown) => {
      const state = { getCurrentStore: () => store };
      return sel ? sel(state) : state;
    });
    (useCache as unknown as Mock).mockImplementation((sel?: (s: unknown) => unknown) => {
      const state = {
        cache: { coupons: { data: coupons } },
        getCachedData: vi.fn().mockResolvedValue(coupons),
        setCachedData,
        clearCacheForType: vi.fn(),
      };
      return sel ? sel(state) : state;
    });
    (useActivityLog as unknown as Mock).mockImplementation((sel?: (s: unknown) => unknown) => {
      const state = { logActivity };
      return sel ? sel(state) : state;
    });
    (WooCommerceService as unknown as Mock).mockImplementation(function () {
      return { batchCoupons };
    });
  });

  const selectAndDelete = async () => {
    render(
      <MemoryRouter>
        <CouponsPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Select coupon CODE1'));
    fireEvent.click(screen.getByLabelText('Select coupon CODE2'));
    fireEvent.click(screen.getByText('Delete selected (2)'));
    await waitFor(() => expect(showToast).toHaveBeenCalled());
  };

  it('deletes selected coupons through batchCoupons and updates cache + activity log', async () => {
    batchCoupons.mockResolvedValue({ success: true, data: { delete: [{ id: 1 }, { id: 2 }] } });
    await selectAndDelete();
    expect(window.confirm).toHaveBeenCalled();
    expect(batchCoupons).toHaveBeenCalledWith({ delete: [1, 2] });
    expect(setCachedData).toHaveBeenCalledWith('coupons', [coupons[2]]);
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'coupon_deleted' }));
    expect(showToast).toHaveBeenCalledWith('Deleted 2 coupons', 'success');
  });

  it('does nothing when the confirm dialog is cancelled', async () => {
    (window.confirm as Mock).mockReturnValue(false);
    render(
      <MemoryRouter>
        <CouponsPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Select coupon CODE1'));
    fireEvent.click(screen.getByText('Delete selected (1)'));
    expect(batchCoupons).not.toHaveBeenCalled();
  });

  it('reports partial failure and keeps the failed coupon', async () => {
    batchCoupons.mockResolvedValue({
      success: true,
      data: { delete: [{ id: 1 }, { id: 2, error: { code: 'x', message: 'no' } }] },
    });
    await selectAndDelete();
    expect(setCachedData).toHaveBeenCalledWith('coupons', [coupons[1], coupons[2]]);
    expect(showToast).toHaveBeenCalledWith('1 of 2 coupons failed to delete', 'warning');
  });

  it('shows an error and keeps the cache when the batch request fails', async () => {
    batchCoupons.mockResolvedValue({ success: false, error: 'boom' });
    await selectAndDelete();
    expect(setCachedData).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Failed to delete coupons: boom', 'error');
  });
});
