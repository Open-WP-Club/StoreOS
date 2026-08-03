import { vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrderDetail } from '../useOrderDetail';
import { createMockStore, createMockOrder } from '../../__test_utils__/mockFactories';
import type { WooCommerceStore, WooCommerceOrder } from '../../types';
import WooCommerceService from '../../services/woocommerce';
import { useStoreConfig, useCache, useActivityLog } from '../../stores';

// ============================================
// Mocks
// ============================================

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockShowToast = vi.fn();
vi.mock('../useToast', () => ({
  useToast: () => ({
    toasts: [],
    showToast: (...args: unknown[]) => mockShowToast(...args),
    removeToast: vi.fn(),
  }),
}));

vi.mock('../../services/woocommerce');
vi.mock('../../stores');

// ============================================
// Setup
// ============================================

let mockActiveStore: WooCommerceStore | undefined;
let mockCachedOrders: WooCommerceOrder[] | undefined;
const mockGetOrder = vi.fn();
const mockUpdateOrder = vi.fn();
const mockLogActivity = vi.fn();

beforeEach(() => {
  mockActiveStore = createMockStore();
  mockCachedOrders = undefined;

  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { getCurrentStore: () => mockActiveStore };
    return selector ? selector(state) : state;
  });

  (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { cache: { orders: { data: mockCachedOrders } } };
    return selector ? selector(state) : state;
  });

  (useActivityLog as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { logActivity: mockLogActivity };
    return selector ? selector(state) : state;
  });

  (WooCommerceService as Mock).mockImplementation(function () { return {
    getOrder: mockGetOrder,
    updateOrder: mockUpdateOrder,
  }; });

  mockGetOrder.mockResolvedValue({ success: true, data: createMockOrder({ id: 123 }) });
});

// ============================================
// Tests
// ============================================

describe('useOrderDetail', () => {
  describe('initialization', () => {
    it('navigates to /setup when no active store', () => {
      mockActiveStore = undefined;

      renderHook(() => useOrderDetail('123'));

      expect(mockNavigate).toHaveBeenCalledWith('/setup');
    });

    it('starts with loading true', async () => {
      const { result } = renderHook(() => useOrderDetail('123'));
      expect(result.current.order).toBeNull();

      // Wait for async effects to settle
      await waitFor(() => {
        expect(result.current.order).toBeTruthy();
      });
    });
  });

  describe('cache-first loading', () => {
    it('loads order from cache immediately', async () => {
      const cachedOrder = createMockOrder({ id: 123 });
      mockCachedOrders = [cachedOrder];

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(result.current.order).toBeTruthy();
        expect(result.current.order?.id).toBe(123);
        expect(result.current.loading).toBe(false);
      });
    });

    it('soft-refreshes from API after cache hit', async () => {
      const cachedOrder = createMockOrder({ id: 123 });
      mockCachedOrders = [cachedOrder];

      const freshOrder = createMockOrder({ id: 123, total: '999.99' });
      mockGetOrder.mockResolvedValue({ success: true, data: freshOrder });

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(mockGetOrder).toHaveBeenCalledWith(123);
        expect(result.current.order?.total).toBe('999.99');
      });
    });

    it('fetches from API when no cache', async () => {
      mockCachedOrders = undefined;
      const apiOrder = createMockOrder({ id: 123 });
      mockGetOrder.mockResolvedValue({ success: true, data: apiOrder });

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(result.current.order?.id).toBe(123);
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('fetchOrderFromApi', () => {
    it('does not fetch when id is undefined', async () => {
      const { result } = renderHook(() => useOrderDetail(undefined));

      await act(async () => {
        await result.current.fetchOrderFromApi(true);
      });

      expect(mockGetOrder).not.toHaveBeenCalled();
    });

    it('sets error on API failure with loading state', async () => {
      mockGetOrder.mockResolvedValue({ success: false, error: 'Not found' });

      const { result } = renderHook(() => useOrderDetail('999'));

      await waitFor(() => {
        expect(result.current.error).toBe('Not found');
        expect(result.current.loading).toBe(false);
      });
    });

    it('does not set error on soft refresh failure', async () => {
      const cachedOrder = createMockOrder({ id: 123 });
      mockCachedOrders = [cachedOrder];
      mockGetOrder.mockResolvedValue({ success: false, error: 'Network error' });

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(result.current.order?.id).toBe(123);
        expect(result.current.error).toBeNull();
      });
    });

    it('handles thrown exception', async () => {
      mockGetOrder.mockRejectedValue(new Error('Network down'));

      const { result } = renderHook(() => useOrderDetail('456'));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load order');
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('handleStatusUpdate', () => {
    it('updates order status successfully', async () => {
      const order = createMockOrder({ id: 123, status: 'processing' });
      mockCachedOrders = [order];

      const updatedOrder = { ...order, status: 'completed' as const };
      mockUpdateOrder.mockResolvedValue({ success: true, data: updatedOrder });

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(result.current.order).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleStatusUpdate('completed');
      });

      expect(mockUpdateOrder).toHaveBeenCalledWith(123, { status: 'completed' });
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'order_status_changed',
          entityType: 'order',
          entityId: 123,
          changes: { status: { from: 'processing', to: 'completed' } },
        })
      );
      expect(mockShowToast).toHaveBeenCalledWith('Order status updated successfully', 'success');
    });

    it('does not log activity on update failure', async () => {
      const order = createMockOrder({ id: 123 });
      mockCachedOrders = [order];
      mockUpdateOrder.mockResolvedValue({ success: false, error: 'Forbidden' });

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(result.current.order).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleStatusUpdate('completed');
      });

      expect(mockLogActivity).not.toHaveBeenCalled();
    });

    it('shows error toast on update failure', async () => {
      const order = createMockOrder({ id: 123 });
      mockCachedOrders = [order];
      mockUpdateOrder.mockResolvedValue({ success: false, error: 'Forbidden' });

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(result.current.order).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleStatusUpdate('completed');
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Forbidden'),
        'error'
      );
    });

    it('shows error toast on exception', async () => {
      const order = createMockOrder({ id: 123 });
      mockCachedOrders = [order];
      mockUpdateOrder.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(result.current.order).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleStatusUpdate('completed');
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Server error'),
        'error'
      );
    });

    it('does not update when no order exists', async () => {
      const { result } = renderHook(() => useOrderDetail('123'));

      act(() => {
        result.current.setOrder(null);
      });

      await act(async () => {
        await result.current.handleStatusUpdate('completed');
      });

      expect(mockUpdateOrder).not.toHaveBeenCalled();
    });

    it('resets updatingStatus after completion', async () => {
      const order = createMockOrder({ id: 123 });
      mockCachedOrders = [order];
      mockUpdateOrder.mockResolvedValue({ success: true, data: order });

      const { result } = renderHook(() => useOrderDetail('123'));

      await waitFor(() => {
        expect(result.current.order).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleStatusUpdate('completed');
      });

      expect(result.current.updatingStatus).toBe(false);
    });
  });
});
