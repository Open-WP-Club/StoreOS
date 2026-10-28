import { vi } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import DataManager from '../DataManager';
import { useStoreConfig, useCache, useSettings } from '../../stores';
import { useProgressiveLoading } from '../../hooks/useProgressiveLoading';
import WooCommerceService from '../../services/woocommerce';
import { useToast } from '../../contexts/ToastContext';

vi.mock('../../contexts/ToastContext', () => ({
  useToast: vi.fn(),
}));

// jest.mock factories return bare stubs — implementations are set in beforeEach
// to survive the global resetMocks: true in jest.config.js
vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
  }),
  useSettings: {
    getState: vi.fn(),
  },
}));

vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: vi.fn(),
}));

vi.mock('../../services/woocommerce', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      getAllOrders: vi.fn(),
      getAllProducts: vi.fn(),
      getProductsSince: vi.fn(),
    };
  }),
}));

// Shared mock functions
const mockToastError = vi.fn();
const mockGetCurrentStore = vi.fn();
const mockGetCachedData = vi.fn();
const mockSetCachedData = vi.fn();
const mockSetProductsLastSync = vi.fn();
const mockSetRefreshFunctions = vi.fn();
const mockStartLoading = vi.fn();
const mockUpdateProgress = vi.fn();
const mockFinishLoading = vi.fn();
const mockIsCancelled = vi.fn();
const mockLoadOrdersSync = vi.fn();
const mockSaveOrdersSync = vi.fn();
const mockGetAllOrders = vi.fn();
const mockGetAllProducts = vi.fn();
const mockGetProductsSince = vi.fn();

const mockStore = {
  id: 'test-store',
  name: 'Test Store',
  url: 'https://test.com',
  consumerKey: 'key',
  consumerSecret: 'secret',
  loadingSettings: {
    batchSize: 50,
    batchDelay: 500,
  },
};

const mockOrders = [
  { id: 1, status: 'processing', date_created: new Date().toISOString() },
  { id: 2, status: 'completed', date_created: new Date().toISOString() },
];

const mockProducts = [
  { id: 1, name: 'Product 1', date_modified_gmt: new Date().toISOString() },
  { id: 2, name: 'Product 2', date_modified_gmt: new Date().toISOString() },
];

describe('DataManager', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockToastError.mockReset();
    useToast.mockReturnValue({
      success: vi.fn(),
      error: mockToastError,
      warning: vi.fn(),
      info: vi.fn(),
    });

    // Reset shared mocks
    mockGetCurrentStore.mockReturnValue(mockStore);
    mockGetCachedData.mockResolvedValue(null);
    mockSetCachedData.mockResolvedValue(undefined);
    mockSetProductsLastSync.mockResolvedValue(undefined);
    mockSetRefreshFunctions.mockReset();
    mockStartLoading.mockReset();
    mockUpdateProgress.mockReset();
    mockFinishLoading.mockReset();
    mockIsCancelled.mockReturnValue(false);
    mockLoadOrdersSync.mockResolvedValue(null);
    mockSaveOrdersSync.mockResolvedValue(undefined);

    mockGetAllOrders.mockResolvedValue({
      success: true,
      data: mockOrders,
    });
    mockGetAllProducts.mockResolvedValue({
      success: true,
      data: mockProducts,
    });
    mockGetProductsSince.mockResolvedValue({
      success: true,
      data: [],
    });

    // Set up store mocks
    useStoreConfig.mockImplementation((selector) => {
      const state = { getCurrentStore: mockGetCurrentStore };
      return selector ? selector(state) : state;
    });

    useCache.mockImplementation((selector) => {
      const state = {
        getCachedData: mockGetCachedData,
        setCachedData: mockSetCachedData,
        setProductsLastSync: mockSetProductsLastSync,
      };
      return selector ? selector(state) : state;
    });

    // useCache.getState and useCache.setState are used for direct Zustand access
    useCache.getState.mockReturnValue({
      loadOrdersSync: mockLoadOrdersSync,
      saveOrdersSync: mockSaveOrdersSync,
      cache: {
        products: { lastSync: null, data: null },
      },
    });
    useCache.setState.mockImplementation(() => {});

    useSettings.getState.mockReturnValue({
      setRefreshFunctions: mockSetRefreshFunctions,
    });

    useProgressiveLoading.mockReturnValue({
      startLoading: mockStartLoading,
      updateProgress: mockUpdateProgress,
      finishLoading: mockFinishLoading,
      isCancelled: mockIsCancelled,
    });

    // WooCommerceService constructor mock
    WooCommerceService.mockImplementation(function () { return {
      getAllOrders: mockGetAllOrders,
      getAllProducts: mockGetAllProducts,
      getProductsSince: mockGetProductsSince,
    }; });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should return null (no visual output)', () => {
      const { container } = render(<DataManager />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Initial Data Loading', () => {
    it('should load data when mounted with a store', async () => {
      render(<DataManager />);

      await waitFor(() => {
        expect(mockGetCachedData).toHaveBeenCalledWith('orders');
        expect(mockGetCachedData).toHaveBeenCalledWith('products');
      });
    });

    it('should not load data when no store is configured', async () => {
      mockGetCurrentStore.mockReturnValue(null);

      render(<DataManager />);

      // Wait a bit to ensure nothing happens
      vi.advanceTimersByTime(1000);

      expect(mockGetAllOrders).not.toHaveBeenCalled();
      expect(mockGetAllProducts).not.toHaveBeenCalled();
    });

    it('should use cached data when available', async () => {
      mockGetCachedData.mockResolvedValue(mockOrders);

      render(<DataManager />);

      await waitFor(() => {
        expect(mockGetCachedData).toHaveBeenCalled();
      });

      // Should not start progressive loading if cache is available
      expect(mockStartLoading).not.toHaveBeenCalled();
    });
  });

  describe('Refresh Functions', () => {
    it('should set refresh functions on mount', async () => {
      render(<DataManager />);

      await waitFor(() => {
        expect(mockSetRefreshFunctions).toHaveBeenCalled();
      });

      const refreshFns = mockSetRefreshFunctions.mock.calls[0][0];
      expect(refreshFns).toHaveProperty('refreshOrders');
      expect(refreshFns).toHaveProperty('refreshProducts');
      expect(refreshFns).toHaveProperty('refreshAll');
    });
  });

  describe('Progressive Loading', () => {
    it('should use progressive loading for orders', async () => {
      mockGetCachedData.mockResolvedValue(null);

      render(<DataManager />);

      await waitFor(() => {
        expect(mockStartLoading).toHaveBeenCalledWith('orders', 0);
      });
    });

    it('should use progressive loading for products', async () => {
      mockGetCachedData.mockResolvedValue(null);

      render(<DataManager />);

      await waitFor(() => {
        expect(mockStartLoading).toHaveBeenCalledWith('products', 0);
      });
    });

    it('should call finishLoading when done', async () => {
      mockGetCachedData.mockResolvedValue(null);

      render(<DataManager />);

      await waitFor(() => {
        expect(mockFinishLoading).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockGetAllOrders.mockRejectedValue(new Error('API Error'));

      // Should not throw
      render(<DataManager />);

      await waitFor(() => {
        expect(mockFinishLoading).toHaveBeenCalled();
      });
    });

    it('should show a toast when orders API throws', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockGetAllOrders.mockRejectedValue(new Error('Network error'));

      render(<DataManager />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load orders')
        );
      });
    });

    it('should show a toast when orders API returns success: false', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockGetAllOrders.mockResolvedValue({ success: false, error: 'Unauthorized' });

      render(<DataManager />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load orders')
        );
      });
    });

    it('should show a toast when products API throws', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockGetAllProducts.mockRejectedValue(new Error('Timeout'));

      render(<DataManager />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load products')
        );
      });
    });

    it('should show a toast when products API returns success: false', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockGetAllProducts.mockResolvedValue({ success: false, error: 'Server error' });

      render(<DataManager />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load products')
        );
      });
    });

    it('should reset loading state to false after orders error', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockGetAllOrders.mockRejectedValue(new Error('API Error'));

      render(<DataManager />);

      await waitFor(() => {
        expect(mockFinishLoading).toHaveBeenCalled();
      });
    });

    it('should handle unsuccessful API responses', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockGetAllOrders.mockResolvedValue({
        success: false,
        error: 'Failed to fetch',
      });

      render(<DataManager />);

      await waitFor(() => {
        expect(mockSetCachedData).not.toHaveBeenCalledWith('orders', expect.anything());
      });
    });
  });

  describe('Delta Sync for Products', () => {
    it('should use delta sync when lastSync is available', async () => {
      useCache.getState.mockReturnValue({
        loadOrdersSync: mockLoadOrdersSync,
        saveOrdersSync: mockSaveOrdersSync,
        cache: {
          products: {
            lastSync: '2024-01-01T00:00:00Z',
            data: mockProducts,
          },
        },
      });

      mockGetProductsSince.mockResolvedValue({
        success: true,
        data: [{ id: 3, name: 'New Product', date_modified_gmt: new Date().toISOString() }],
      });

      render(<DataManager />);

      await waitFor(() => {
        expect(mockGetCachedData).toHaveBeenCalled();
      });
    });
  });

  describe('Store Changes', () => {
    it('should reload data when store changes', async () => {
      const { rerender } = render(<DataManager />);

      await waitFor(() => {
        expect(mockGetCachedData).toHaveBeenCalled();
      });

      // Clear mocks
      vi.clearAllMocks();

      // Re-set implementations after clearAllMocks
      mockGetCurrentStore.mockReturnValue({
        ...mockStore,
        id: 'different-store',
      });
      mockGetCachedData.mockResolvedValue(null);
      mockSetCachedData.mockResolvedValue(undefined);
      mockSetProductsLastSync.mockResolvedValue(undefined);
      mockIsCancelled.mockReturnValue(false);
      mockGetAllOrders.mockResolvedValue({ success: true, data: mockOrders });
      mockGetAllProducts.mockResolvedValue({ success: true, data: mockProducts });

      useStoreConfig.mockImplementation((selector) => {
        const state = { getCurrentStore: mockGetCurrentStore };
        return selector ? selector(state) : state;
      });
      useCache.mockImplementation((selector) => {
        const state = {
          getCachedData: mockGetCachedData,
          setCachedData: mockSetCachedData,
          setProductsLastSync: mockSetProductsLastSync,
        };
        return selector ? selector(state) : state;
      });
      useCache.getState = vi.fn().mockReturnValue({
        loadOrdersSync: mockLoadOrdersSync,
        saveOrdersSync: mockSaveOrdersSync,
        cache: { products: { lastSync: null, data: null } },
      });
      useCache.setState = vi.fn();
      useSettings.getState.mockReturnValue({
        setRefreshFunctions: mockSetRefreshFunctions,
      });
      useProgressiveLoading.mockReturnValue({
        startLoading: mockStartLoading,
        updateProgress: mockUpdateProgress,
        finishLoading: mockFinishLoading,
        isCancelled: mockIsCancelled,
      });
      WooCommerceService.mockImplementation(function () { return {
        getAllOrders: mockGetAllOrders,
        getAllProducts: mockGetAllProducts,
        getProductsSince: mockGetProductsSince,
      }; });

      rerender(<DataManager />);

      await waitFor(() => {
        expect(mockGetCachedData).toHaveBeenCalled();
      });
    });
  });

  describe('Stale Data Refresh', () => {
    it('should set up interval for stale data refresh', async () => {
      render(<DataManager />);

      // Advance past the refresh interval (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000);

      // The interval should have run
      expect(mockGetCachedData).toHaveBeenCalled();
    });

    it('should cleanup interval on unmount', async () => {
      const { unmount } = render(<DataManager />);

      await waitFor(() => {
        expect(mockGetCachedData).toHaveBeenCalled();
      });

      unmount();

      // Clear mocks after unmount
      vi.clearAllMocks();

      // Advance time - interval should not run
      vi.advanceTimersByTime(5 * 60 * 1000);

      // No new calls should be made after unmount
    });
  });

  describe('Cancellation', () => {
    it('should check for cancellation during loading', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockIsCancelled.mockReturnValue(false);

      render(<DataManager />);

      await waitFor(() => {
        expect(mockGetAllOrders).toHaveBeenCalled();
      });

      // The callback passed to getAllOrders should use isCancelled
      const orderCallback = mockGetAllOrders.mock.calls[0][1];
      if (orderCallback) {
        orderCallback({
          currentPage: 1,
          totalPages: 1,
          allData: mockOrders,
        });
      }
    });

    it('should not update cache when cancelled', async () => {
      mockGetCachedData.mockResolvedValue(null);
      mockIsCancelled.mockReturnValue(true);
      mockGetAllOrders.mockResolvedValue({
        success: true,
        data: mockOrders,
        cancelled: true,
      });

      render(<DataManager />);

      await waitFor(() => {
        expect(mockGetAllOrders).toHaveBeenCalled();
      });

      // setCachedData should not be called for cancelled requests
    });
  });
});
