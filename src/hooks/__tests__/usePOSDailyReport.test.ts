import { vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePOSDailyReport } from '../usePOSDailyReport';
import { useStoreConfig } from '../../stores';
import { usePOSStore } from '../../stores/posStore';
import WooCommerceService from '../../services/woocommerce';
import { createMockStore } from '../../__test_utils__';

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
}));
vi.mock('../../stores/posStore', () => ({
  usePOSStore: vi.fn(),
}));
vi.mock('../../services/woocommerce');

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();

describe('usePOSDailyReport', () => {
  const mockStore = createMockStore({ currencySymbol: '$' });
  const mockRefundOrder = vi.fn();

  beforeEach(() => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockStore };
      return selector ? selector(state) : state;
    });

    (usePOSStore as unknown as Mock).mockReturnValue({
      cart: [
        { product: { id: 1, name: 'Test Product' }, quantity: 2, price: 10 },
      ],
      paymentMethod: 'cash',
      getTotal: () => 20,
      getItemCount: () => 2,
    });

    (WooCommerceService as Mock).mockImplementation(function () { return {
      refundOrder: mockRefundOrder,
    }; });

    // Clear localStorage
    localStorage.clear();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    expect(result.current.showRecentTransactions).toBe(false);
    expect(result.current.recentTransactions).toEqual([]);
    expect(result.current.showDailyReport).toBe(false);
    expect(result.current.processingRefund).toBe(false);
  });

  it('should save a recent transaction', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.saveRecentTransaction(100);
    });

    expect(result.current.recentTransactions).toHaveLength(1);
    expect(result.current.recentTransactions[0]).toMatchObject({
      id: 100,
      total: 20,
      itemCount: 2,
      paymentMethod: 'Каса',
    });
  });

  it('should persist transactions to localStorage', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.saveRecentTransaction(101);
    });

    const stored = JSON.parse(localStorage.getItem('pos_recent_transactions') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(101);
  });

  it('should load transactions from localStorage', () => {
    const existingTx = [
      { id: 50, total: 30, itemCount: 1, items: [], paymentMethod: 'Каса', timestamp: new Date().toISOString() },
    ];
    localStorage.setItem('pos_recent_transactions', JSON.stringify(existingTx));

    const { result } = renderHook(() => usePOSDailyReport());

    // After effect runs
    expect(result.current.recentTransactions).toHaveLength(1);
    expect(result.current.recentTransactions[0]!.id).toBe(50);
  });

  it('should limit to 50 recent transactions', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.saveRecentTransaction(i);
      }
    });

    expect(result.current.recentTransactions.length).toBeLessThanOrEqual(50);
  });

  it('should get today transactions', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.saveRecentTransaction(200);
    });

    const todayTx = result.current.getTodayTransactions();
    expect(todayTx).toHaveLength(1);
    expect(todayTx[0]!.id).toBe(200);
  });

  it('should calculate daily report stats', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.saveRecentTransaction(300);
    });

    const stats = result.current.getDailyReportStats();
    expect(stats.totalSales).toBe(20);
    expect(stats.orderCount).toBe(1);
    expect(stats.averageOrder).toBe(20);
    expect(stats.byPaymentMethod['Каса']).toBeDefined();
    expect(stats.byPaymentMethod['Каса']!.count).toBe(1);
  });

  it('should return empty stats when no transactions', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    const stats = result.current.getDailyReportStats();
    expect(stats.totalSales).toBe(0);
    expect(stats.orderCount).toBe(0);
    expect(stats.averageOrder).toBe(0);
  });

  it('should handle refund successfully', async () => {
    mockRefundOrder.mockResolvedValue({ success: true, data: { id: 1, amount: '20.00' } });

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.saveRecentTransaction(400);
    });

    const tx = result.current.recentTransactions[0]!;

    await act(async () => {
      await result.current.handleRefund(tx);
    });

    expect(mockRefundOrder).toHaveBeenCalledWith(400, 20, 'POS Refund');
    expect(result.current.recentTransactions[0]!.refunded).toBe(true);
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('400'));
    alertSpy.mockRestore();
  });

  it('should handle refund failure', async () => {
    mockRefundOrder.mockResolvedValue({ success: false, error: 'Refund failed' });

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.saveRecentTransaction(500);
    });

    const tx = result.current.recentTransactions[0]!;

    await act(async () => {
      await result.current.handleRefund(tx);
    });

    expect(result.current.recentTransactions[0]!.refunded).toBeFalsy();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Refund failed'));
    alertSpy.mockRestore();
  });

  it('should toggle modals', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.setShowRecentTransactions(true);
    });
    expect(result.current.showRecentTransactions).toBe(true);

    act(() => {
      result.current.setShowDailyReport(true);
    });
    expect(result.current.showDailyReport).toBe(true);
  });

  it('should export daily report CSV', () => {
    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.saveRecentTransaction(600);
    });

    // Mock the link element only for the click call, not for all createElement calls
    const originalCreateElement = document.createElement.bind(document);
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        const el = originalCreateElement('a');
        el.click = clickSpy;
        return el;
      }
      return originalCreateElement(tag);
    }) as typeof document.createElement);

    act(() => {
      result.current.exportDailyReportCSV();
    });

    expect(clickSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();

    (document.createElement as Mock).mockRestore();
  });

  it('should map card payment method correctly', () => {
    (usePOSStore as unknown as Mock).mockReturnValue({
      cart: [{ product: { id: 1, name: 'P' }, quantity: 1, price: 15 }],
      paymentMethod: 'card',
      getTotal: () => 15,
      getItemCount: () => 1,
    });

    const { result } = renderHook(() => usePOSDailyReport());

    act(() => {
      result.current.saveRecentTransaction(700);
    });

    expect(result.current.recentTransactions[0]!.paymentMethod).toBe('Карта');
  });
});
