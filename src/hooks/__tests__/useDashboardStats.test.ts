import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardStats } from '../useDashboardStats';
import useSettings from '../../stores/settingsStore';
import { createMockOrder, createMockProduct, createMockLineItem } from '../../__test_utils__/mockFactories';

const NOW = new Date(2026, 10, 18, 12, 0, 0); // Wed
const at = (daysAgo: number, hour = 10): string =>
  new Date(2026, 10, 18 - daysAgo, hour).toISOString().slice(0, 19);

describe('useDashboardStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useSettings.setState({ lowStockThreshold: 5, orderSplitDays: 7 });
  });
  afterEach(() => vi.useRealTimers());

  it('starts empty', () => {
    const { result } = renderHook(() => useDashboardStats());
    expect(result.current.stats.totalOrders).toBe(0);
    expect(result.current.currencyCode).toBe('USD');
    expect(result.current.topProducts).toEqual([]);
  });

  it('ignores missing inputs', () => {
    const { result } = renderHook(() => useDashboardStats());
    act(() => result.current.calculateStats(undefined as never, []));
    expect(result.current.stats.totalOrders).toBe(0);
  });

  it('computes daily, weekly, pending and counts', () => {
    const orders = [
      createMockOrder({ id: 1, status: 'processing', total: '10.00', date_created: at(0), currency: 'EUR' }),
      createMockOrder({ id: 2, status: 'pending', total: '5.50', date_created: at(0, 8) }),
      createMockOrder({ id: 3, status: 'completed', total: '20.00', date_created: at(1) }),
      createMockOrder({ id: 4, status: 'completed', total: '100.00', date_created: at(5) }),
      createMockOrder({ id: 5, status: 'completed', total: '7.00', date_created: at(10) }),
      createMockOrder({ id: 6, status: 'completed', total: '', date_created: at(30) }),
    ];
    const { result } = renderHook(() => useDashboardStats());
    act(() => result.current.calculateStats(orders, []));
    const r = result.current;
    expect(r.dailyStats.today).toEqual({ orders: 2, revenue: 15.5 });
    expect(r.dailyStats.yesterday).toEqual({ orders: 1, revenue: 20 });
    // thisWeek = last 7 days from today midnight; lastWeek = 7 days before that
    expect(r.weeklyStats.thisWeek.orders).toBe(4);
    expect(r.weeklyStats.thisWeek.revenue).toBeCloseTo(135.5);
    expect(r.weeklyStats.lastWeek).toEqual({ orders: 1, revenue: 7 });
    expect(r.pendingOrdersValue).toBeCloseTo(15.5);
    expect(r.stats.pendingOrders).toBe(2);
    expect(r.stats.totalOrders).toBe(6);
    expect(r.currencyCode).toBe('EUR');
  });

  it('honours orderSplitDays', () => {
    useSettings.setState({ orderSplitDays: 2 });
    const orders = [
      createMockOrder({ id: 1, total: '1', date_created: at(1) }),
      createMockOrder({ id: 2, total: '1', date_created: at(4) }),
      createMockOrder({ id: 3, total: '1', date_created: at(6) }),
    ];
    const { result } = renderHook(() => useDashboardStats());
    act(() => result.current.calculateStats(orders, []));
    expect(result.current.weeklyStats.thisWeek.orders).toBe(1);
    expect(result.current.weeklyStats.lastWeek.orders).toBe(1);
  });

  it('ranks top 5 products from completed orders only', () => {
    const li = (pid: number, name: string, qty: number, total: string) =>
      createMockLineItem({ product_id: pid, name, quantity: qty, total });
    const orders = [
      createMockOrder({
        id: 1,
        status: 'completed',
        date_created: at(2),
        line_items: [li(1, 'A', 2, '20'), li(2, 'B', 5, '50'), li(3, 'C', 1, '5')],
      }),
      createMockOrder({
        id: 2,
        status: 'completed',
        date_created: at(2),
        line_items: [li(1, 'A', 4, '40'), li(4, 'D', 1, '1'), li(5, 'E', 1, '1'), li(6, 'F', 1, '1')],
      }),
      createMockOrder({ id: 3, status: 'processing', date_created: at(0), line_items: [li(9, 'Z', 99, '999')] }),
    ];
    const { result } = renderHook(() => useDashboardStats());
    act(() => result.current.calculateStats(orders, []));
    const top = result.current.topProducts;
    expect(top).toHaveLength(5);
    expect(top.map((p) => p.name).slice(0, 2)).toEqual(['A', 'B']);
    expect(top[0]).toEqual({ id: 1, name: 'A', quantitySold: 6, revenue: 60 });
    expect(top.find((p) => p.name === 'Z')).toBeUndefined();
  });

  it('computes inventory value and low stock (<= threshold, null stock ignored)', () => {
    const products = [
      createMockProduct({ id: 1, price: '10', stock_quantity: 3 }),
      createMockProduct({ id: 2, price: '2.5', stock_quantity: 5 }),
      createMockProduct({ id: 3, price: '100', stock_quantity: null }),
      createMockProduct({ id: 4, price: 'abc' as never, stock_quantity: 50 }),
    ];
    const { result } = renderHook(() => useDashboardStats());
    act(() => result.current.calculateStats([], products));
    expect(result.current.inventoryValue).toBeCloseTo(42.5);
    expect(result.current.stats.lowStock).toBe(2); // 3 and 5 (boundary inclusive)
    expect(result.current.stats.totalProducts).toBe(4);
  });
});
