import { vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { useProductFilters } from '../useProductFilters';
import { createMockProduct } from '../../__test_utils__';
import { searchProducts, applyProductFilters } from '../../utils/searchService';
import type { WooCommerceProduct } from '../../types';

// Mock searchService
vi.mock('../../utils/searchService', () => ({
  searchProducts: vi.fn((products: WooCommerceProduct[], _term: string) => products),
  applyProductFilters: vi.fn((products: WooCommerceProduct[]) => products),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useProductFilters', () => {
  const products = [
    createMockProduct({ id: 1, name: 'Product A', stock_status: 'instock', stock_quantity: 50, price: '10.00' }),
    createMockProduct({ id: 2, name: 'Product B', stock_status: 'outofstock', stock_quantity: 0, price: '20.00' }),
    createMockProduct({ id: 3, name: 'Product C', stock_status: 'instock', stock_quantity: 3, price: '30.00' }),
  ] as WooCommerceProduct[];

  beforeEach(() => {
    // Re-setup mocks since resetMocks clears them
    (searchProducts as Mock).mockImplementation((prods: WooCommerceProduct[]) => prods);
    (applyProductFilters as Mock).mockImplementation((prods: WooCommerceProduct[]) => prods);

    // Mock window.scrollTo
    window.scrollTo = vi.fn();
  });

  it('should initialize with default filter values', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.filters.stockStatus).toBe('all');
    expect(result.current.filters.status).toBe('all');
    expect(result.current.showAdvancedFilters).toBe(false);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(25);
  });

  it('should calculate product stats', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });

    expect(result.current.stats.total).toBe(3);
    expect(result.current.stats.inStock).toBe(2);
    expect(result.current.stats.outOfStock).toBe(1);
    expect(result.current.stats.lowStock).toBe(1); // stock_quantity 3 <= 5
  });

  it('should set search term and reset page', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });

    act(() => {
      result.current.handlePageChange(3);
    });

    expect(result.current.currentPage).toBe(3);

    act(() => {
      result.current.setSearchTerm('test');
    });

    expect(result.current.searchTerm).toBe('test');
    expect(result.current.currentPage).toBe(1);
  });

  it('should change page', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });

    act(() => {
      result.current.handlePageChange(2);
    });

    expect(result.current.currentPage).toBe(2);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('should change page size and reset to page 1', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });

    act(() => {
      result.current.handlePageChange(3);
    });

    act(() => {
      result.current.handlePageSizeChange(50);
    });

    expect(result.current.pageSize).toBe(50);
    expect(result.current.currentPage).toBe(1);
  });

  it('should clear all filters', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });

    act(() => {
      result.current.setFilters({
        stockStatus: 'instock',
        status: 'publish',
        priceMin: '10',
        priceMax: '50',
        stockMin: '1',
        stockMax: '100',
      });
    });

    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.filters.stockStatus).toBe('all');
    expect(result.current.filters.status).toBe('all');
    expect(result.current.filters.priceMin).toBe('');
    expect(result.current.searchTerm).toBe('');
  });

  it('should detect active filters', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });

    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        stockStatus: 'instock',
      });
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('should paginate products', () => {
    // Create many products
    const manyProducts = Array.from({ length: 30 }, (_, i) =>
      createMockProduct({ id: i + 1, name: `Product ${i + 1}`, stock_status: 'instock' })
    ) as WooCommerceProduct[];

    const { result } = renderHook(() => useProductFilters(manyProducts), { wrapper });

    expect(result.current.paginatedProducts).toHaveLength(25); // Default pageSize

    act(() => {
      result.current.handlePageChange(2);
    });

    expect(result.current.paginatedProducts).toHaveLength(5); // Remaining 5
  });

  it('should apply filter preset', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });
    const mockShowToast = vi.fn();

    act(() => {
      result.current.handleApplyPreset(
        { stockStatus: 'instock', status: 'publish', priceMin: '', priceMax: '', stockMin: '', stockMax: '' },
        mockShowToast
      );
    });

    expect(result.current.filters.stockStatus).toBe('instock');
    expect(mockShowToast).toHaveBeenCalledWith('Filter preset applied', 'success');
  });

  it('should toggle advanced filters', () => {
    const { result } = renderHook(() => useProductFilters(products), { wrapper });

    expect(result.current.showAdvancedFilters).toBe(false);

    act(() => {
      result.current.setShowAdvancedFilters(true);
    });

    expect(result.current.showAdvancedFilters).toBe(true);
  });
});
