import { vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKPIs } from '../useKPIs';
import { useCachedOrders, useCachedProducts } from '../../stores';
import { calculateAllKPIs } from '../../utils/kpiCalculator';
import { getCurrencyCode } from '../../utils/currency';

// ============================================
// Mocks
// ============================================

vi.mock('../../stores', () => ({
  useCachedOrders: vi.fn(),
  useCachedProducts: vi.fn(),
}));

vi.mock('../../utils/kpiCalculator', () => ({
  calculateAllKPIs: vi.fn(),
}));

vi.mock('../../utils/currency', () => ({
  getCurrencyCode: vi.fn(),
}));

// ============================================
// Setup
// ============================================

const mockKPIs = { revenue: { total: 100 } };

beforeEach(() => {
  (useCachedOrders as Mock).mockReturnValue([]);
  (useCachedProducts as Mock).mockReturnValue([]);
  (getCurrencyCode as Mock).mockReturnValue('USD');
  (calculateAllKPIs as Mock).mockReturnValue(mockKPIs);
});

// ============================================
// Tests
// ============================================

describe('useKPIs', () => {
  it('returns null kpis when no data', () => {
    const { result } = renderHook(() => useKPIs());

    expect(result.current.kpis).toBeNull();
    expect(result.current.hasData).toBe(false);
    expect(calculateAllKPIs).not.toHaveBeenCalled();
  });

  it('returns kpis when orders exist', () => {
    const mockOrders = [{ id: 1, total: '50.00' }, { id: 2, total: '75.00' }];
    (useCachedOrders as Mock).mockReturnValue(mockOrders);

    const { result } = renderHook(() => useKPIs());

    expect(result.current.kpis).toEqual(mockKPIs);
    expect(result.current.hasData).toBe(true);
    expect(calculateAllKPIs).toHaveBeenCalledWith(mockOrders, [], 30);
  });

  it('returns hasData=true when products exist', () => {
    const mockProducts = [{ id: 1, name: 'Test Product' }];
    (useCachedProducts as Mock).mockReturnValue(mockProducts);

    const { result } = renderHook(() => useKPIs());

    expect(result.current.hasData).toBe(true);
    expect(result.current.kpis).toEqual(mockKPIs);
    expect(calculateAllKPIs).toHaveBeenCalledWith([], mockProducts, 30);
  });

  it('setPeriod changes the period', () => {
    const mockOrders = [{ id: 1, total: '50.00' }];
    (useCachedOrders as Mock).mockReturnValue(mockOrders);

    const { result } = renderHook(() => useKPIs());

    expect(result.current.period).toBe(30);

    act(() => {
      result.current.setPeriod(7);
    });

    expect(result.current.period).toBe(7);
    expect(calculateAllKPIs).toHaveBeenCalledWith(mockOrders, [], 7);
  });

  it('uses getCurrencyCode when orders exist', () => {
    const mockOrders = [{ id: 1, total: '50.00', currency: 'EUR' }];
    (useCachedOrders as Mock).mockReturnValue(mockOrders);
    (getCurrencyCode as Mock).mockReturnValue('EUR');

    const { result } = renderHook(() => useKPIs());

    expect(getCurrencyCode).toHaveBeenCalledWith(mockOrders);
    expect(result.current.currencyCode).toBe('EUR');
  });

  it('returns USD as default currency when no orders', () => {
    const { result } = renderHook(() => useKPIs());

    expect(getCurrencyCode).not.toHaveBeenCalled();
    expect(result.current.currencyCode).toBe('USD');
  });

  it('loading is always false', () => {
    const { result } = renderHook(() => useKPIs());
    expect(result.current.loading).toBe(false);

    // Even with data present, loading should be false
    (useCachedOrders as Mock).mockReturnValue([{ id: 1 }]);
    const { result: resultWithData } = renderHook(() => useKPIs());
    expect(resultWithData.current.loading).toBe(false);
  });
});
