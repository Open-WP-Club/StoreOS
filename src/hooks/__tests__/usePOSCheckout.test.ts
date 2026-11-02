import { vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePOSCheckout } from '../usePOSCheckout';
import {
  createMockStore,
  createMockCustomer,
  createMockProduct,
} from '../../__test_utils__/mockFactories';
import type { WooCommerceStore, WooCommerceCustomer } from '../../types';
import WooCommerceService from '../../services/woocommerce';
import { useStoreConfig } from '../../stores';
import { usePOSStore } from '../../stores/posStore';
import useOffline from '../../stores/offlineStore';
import { CLIENT_ID_META } from '../../utils/posOfflineSale';

// ============================================
// Mocks
// ============================================

vi.mock('../../services/woocommerce');
vi.mock('../../stores');
vi.mock('../../stores/posStore');
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => mockToast }));

// ============================================
// Setup
// ============================================

let mockActiveStore: WooCommerceStore | undefined;
const mockGetCustomers = vi.fn();
const mockCreateOrder = vi.fn();
const mockClearCart = vi.fn();
const mockGetDiscountAmount = vi.fn(() => 0);
let mockCart: Array<{ product: { id: number }; quantity: number }> = [];
let mockPaymentMethod = 'cash';
let mockDiscountType = 'percent' as const;
let mockDiscountValue = 0;

const mockSaveRecentTransaction = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockActiveStore = createMockStore();
  mockCart = [];
  mockPaymentMethod = 'cash';
  mockDiscountType = 'percent';
  mockDiscountValue = 0;
  mockGetDiscountAmount.mockReturnValue(0);

  (useStoreConfig as unknown as Mock).mockImplementation(
    (selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockActiveStore };
      return selector ? selector(state) : state;
    }
  );

  (usePOSStore as unknown as Mock).mockImplementation(() => ({
    cart: mockCart,
    clearCart: mockClearCart,
    paymentMethod: mockPaymentMethod,
    discountType: mockDiscountType,
    discountValue: mockDiscountValue,
    getDiscountAmount: mockGetDiscountAmount,
  }));

  (WooCommerceService as Mock).mockImplementation(function () {
    return {
      getCustomers: mockGetCustomers,
      createOrder: mockCreateOrder,
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================
// Tests
// ============================================

describe('usePOSCheckout', () => {
  describe('customer search', () => {
    it('searches customers after 300ms debounce', async () => {
      const customers = [createMockCustomer()];
      mockGetCustomers.mockResolvedValue({ success: true, data: customers });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      act(() => {
        result.current.setCustomerSearchTerm('john');
      });

      expect(mockGetCustomers).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockGetCustomers).toHaveBeenCalledWith(expect.objectContaining({ search: 'john' }));
      });
    });

    it('does not search when term is less than 2 characters', () => {
      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      act(() => {
        result.current.setCustomerSearchTerm('j');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockGetCustomers).not.toHaveBeenCalled();
    });

    it('clears customers when term is less than 2 characters', () => {
      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      act(() => {
        result.current.setCustomerSearchTerm('j');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.customers).toHaveLength(0);
    });

    it('shows an error toast when customer search fails', async () => {
      mockGetCustomers.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      act(() => {
        result.current.setCustomerSearchTerm('john');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.loadingCustomers).toBe(false);
      });

      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('клиенти'));
    });

    it('selects customer and clears search', () => {
      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));
      const customer = createMockCustomer();

      act(() => {
        result.current.handleSelectCustomer(customer as WooCommerceCustomer);
      });

      expect(result.current.selectedCustomer?.id).toBe(customer.id);
      expect(result.current.showCustomerSearch).toBe(false);
      expect(result.current.customerSearchTerm).toBe('');
    });

    it('clears selected customer', () => {
      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));
      const customer = createMockCustomer();

      act(() => {
        result.current.handleSelectCustomer(customer as WooCommerceCustomer);
      });

      act(() => {
        result.current.clearCustomer();
      });

      expect(result.current.selectedCustomer).toBeNull();
    });
  });

  describe('handleCheckout', () => {
    it('creates order with cart items', async () => {
      const product = createMockProduct({ id: 42 });
      mockCart = [{ product: product as unknown as { id: number }, quantity: 2 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 100 } });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          payment_method: 'cash',
          payment_method_title: 'Каса',
          set_paid: true,
          line_items: [{ product_id: 42, quantity: 2 }],
        })
      );

      expect(mockSaveRecentTransaction).toHaveBeenCalledWith(100);
      expect(mockClearCart).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('100'));
    });

    it('does nothing with empty cart', async () => {
      mockCart = [];

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it('does nothing without store', async () => {
      mockActiveStore = undefined;
      mockCart = [{ product: { id: 1 }, quantity: 1 }];

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it('maps payment method "card" to "Карта"', async () => {
      mockPaymentMethod = 'card';
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_title: 'Карта',
        })
      );
    });

    it('maps payment method "other" to "Друго"', async () => {
      mockPaymentMethod = 'other';
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_title: 'Друго',
        })
      );
    });

    it('includes discount fee_lines when discount > 0', async () => {
      mockDiscountValue = 10;
      mockDiscountType = 'percent';
      mockGetDiscountAmount.mockReturnValue(5);
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          fee_lines: [
            expect.objectContaining({
              name: 'Отстъпка 10%',
              total: '-5',
            }),
          ],
        })
      );
    });

    it('does not include fee_lines when discount is 0', async () => {
      mockDiscountValue = 0;
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      const orderData = mockCreateOrder.mock.calls[0]![0];
      expect(orderData.fee_lines).toBeUndefined();
    });

    it('includes customer_id when customer selected', async () => {
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });
      const customer = createMockCustomer({ id: 55 });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      act(() => {
        result.current.handleSelectCustomer(customer as WooCommerceCustomer);
      });

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 55,
        })
      );
    });

    it('includes customer_note when order note is set', async () => {
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      act(() => {
        result.current.setOrderNote('  Please rush  ');
      });

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_note: 'Please rush',
        })
      );
    });

    it('does not include customer_note for empty/whitespace note', async () => {
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      act(() => {
        result.current.setOrderNote('   ');
      });

      await act(async () => {
        await result.current.handleCheckout();
      });

      const orderData = mockCreateOrder.mock.calls[0]![0];
      expect(orderData.customer_note).toBeUndefined();
    });

    it('clears state after successful checkout', async () => {
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });
      const customer = createMockCustomer();

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      act(() => {
        result.current.handleSelectCustomer(customer as WooCommerceCustomer);
        result.current.setOrderNote('test note');
        result.current.setShowCheckout(true);
      });

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockClearCart).toHaveBeenCalled();
      expect(result.current.selectedCustomer).toBeNull();
      expect(result.current.orderNote).toBe('');
      expect(result.current.showCheckout).toBe(false);
    });

    it('shows error toast on API failure', async () => {
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: false, error: 'Server error' });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Server error'));
    });

    it('shows generic error toast on exception', async () => {
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockRejectedValue(new Error('Network failed'));

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Грешка'));
    });

    it('resets processingOrder flag after completion', async () => {
      mockCart = [{ product: { id: 1 }, quantity: 1 }];
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 1 } });

      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));

      await act(async () => {
        await result.current.handleCheckout();
      });

      expect(result.current.processingOrder).toBe(false);
    });
  });

  describe('offline sales', () => {
    beforeEach(() => {
      useOffline.setState({ isOnline: true, pendingOperations: [] });
      mockCart = [{ product: { id: 7 }, quantity: 1 }];
    });

    it('always tags the order with a client id', async () => {
      mockCreateOrder.mockResolvedValue({ success: true, data: { id: 5 } });
      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));
      await act(async () => {
        await result.current.handleCheckout();
      });
      const sent = mockCreateOrder.mock.calls[0]![0];
      expect(sent.meta_data[0].key).toBe(CLIENT_ID_META);
      expect(sent.meta_data[0].value).toMatch(/[0-9a-f-]{36}/);
    });

    it('queues the sale without calling the API when offline', async () => {
      useOffline.setState({ isOnline: false });
      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));
      await act(async () => {
        await result.current.handleCheckout();
      });
      expect(mockCreateOrder).not.toHaveBeenCalled();
      const ops = useOffline.getState().pendingOperations;
      expect(ops).toHaveLength(1);
      expect(ops[0]!.type).toBe('create_order');
      expect(ops[0]!.storeId).toBe(mockActiveStore!.id);
      expect(mockSaveRecentTransaction).toHaveBeenCalledWith(0, ops[0]!.data.clientId);
      expect(mockClearCart).toHaveBeenCalled();
      expect(mockToast.warning).toHaveBeenCalled();
    });

    it('queues with the SAME client id when the request fails with a network error', async () => {
      mockCreateOrder.mockResolvedValue({ success: false, error: 'x', code: 'offline' });
      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));
      await act(async () => {
        await result.current.handleCheckout();
      });
      const queued = useOffline.getState().pendingOperations[0]!.data as {
        clientId: string;
        order: { meta_data: Array<{ value: string }> };
      };
      expect(queued.order.meta_data[0]!.value).toBe(queued.clientId);
      expect(mockCreateOrder.mock.calls[0]![0].meta_data[0].value).toBe(queued.clientId);
    });

    it('does not queue on a server-side rejection', async () => {
      mockCreateOrder.mockResolvedValue({ success: false, error: 'bad product' });
      const { result } = renderHook(() => usePOSCheckout(mockSaveRecentTransaction));
      await act(async () => {
        await result.current.handleCheckout();
      });
      expect(useOffline.getState().pendingOperations).toHaveLength(0);
      expect(mockClearCart).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalled();
    });
  });
});
