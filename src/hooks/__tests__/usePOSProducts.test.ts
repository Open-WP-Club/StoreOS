import { vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePOSProducts } from '../usePOSProducts';
import { useStoreConfig, useCache } from '../../stores';
import WooCommerceService from '../../services/woocommerce';
import { createMockStore, createMockProduct } from '../../__test_utils__';
import type { WooCommerceProduct } from '../../types';
import type { KeyboardEvent } from 'react';
import useOffline from '../../stores/offlineStore';

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
}));
vi.mock('../../services/woocommerce');
const mockToast = { error: vi.fn(), success: vi.fn() };
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => mockToast }));

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
  unobserve: vi.fn(),
}));

describe('usePOSProducts', () => {
  const mockStore = createMockStore({
    loadingSettings: {
      batchSize: 50,
      batchDelay: 500,
      retryDelaySeconds: 5,
      posInfiniteScroll: true,
    },
  });
  const mockGetProducts = vi.fn();
  const mockAddToCart = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    (useStoreConfig as unknown as Mock).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = { getCurrentStore: () => mockStore };
        return selector ? selector(state) : state;
      }
    );

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: null } } };
      return selector ? selector(state) : state;
    });

    (WooCommerceService as Mock).mockImplementation(function () {
      return {
        getProducts: mockGetProducts,
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with loading state', async () => {
    mockGetProducts.mockResolvedValue({ success: true, data: [], headers: {} });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    expect(result.current.loading).toBe(true);

    // Wait for async effects to settle
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should load products from API', async () => {
    const products = [
      createMockProduct({ id: 1, name: 'P1', status: 'publish', stock_status: 'instock' }),
      createMockProduct({ id: 2, name: 'P2', status: 'publish', stock_status: 'instock' }),
    ];
    mockGetProducts.mockResolvedValue({
      success: true,
      data: products,
      headers: { 'x-wp-total': '2', 'x-wp-totalpages': '1' },
    });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toHaveLength(2);
    expect(result.current.totalProducts).toBe(2);
  });

  it('should use cache when available', async () => {
    const cachedProducts = [
      createMockProduct({ id: 1, status: 'publish', stock_status: 'instock' }),
      createMockProduct({ id: 2, status: 'publish', stock_status: 'instock' }),
    ] as WooCommerceProduct[];

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: cachedProducts } } };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toHaveLength(2);
    expect(mockGetProducts).not.toHaveBeenCalled();
  });

  it('should filter products by search term', async () => {
    const products = [
      createMockProduct({ id: 1, name: 'Apple', status: 'publish', stock_status: 'instock' }),
      createMockProduct({ id: 2, name: 'Banana', status: 'publish', stock_status: 'instock' }),
    ] as WooCommerceProduct[];

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: products } } };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setSearchTerm('apple');
    });

    expect(result.current.filteredProducts).toHaveLength(1);
    expect(result.current.filteredProducts[0]!.name).toBe('Apple');
  });

  it('should filter out out-of-stock products', async () => {
    const products = [
      createMockProduct({ id: 1, status: 'publish', stock_status: 'instock' }),
      createMockProduct({ id: 2, status: 'publish', stock_status: 'outofstock' }),
    ] as WooCommerceProduct[];

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: products } } };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.filteredProducts).toHaveLength(1);
  });

  it('should extract categories from products', async () => {
    const products = [
      createMockProduct({
        id: 1,
        status: 'publish',
        stock_status: 'instock',
        categories: [{ id: 1, name: 'Drinks', slug: 'drinks' }],
      }),
      createMockProduct({
        id: 2,
        status: 'publish',
        stock_status: 'instock',
        categories: [{ id: 2, name: 'Food', slug: 'food' }],
      }),
    ] as WooCommerceProduct[];

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: products } } };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.categories).toContain('Drinks');
    expect(result.current.categories).toContain('Food');
  });

  it('should filter by selected category', async () => {
    const products = [
      createMockProduct({
        id: 1,
        name: 'Cola',
        status: 'publish',
        stock_status: 'instock',
        categories: [{ id: 1, name: 'Drinks', slug: 'drinks' }],
      }),
      createMockProduct({
        id: 2,
        name: 'Pizza',
        status: 'publish',
        stock_status: 'instock',
        categories: [{ id: 2, name: 'Food', slug: 'food' }],
      }),
    ] as WooCommerceProduct[];

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: products } } };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setSelectedCategory('Drinks');
    });

    expect(result.current.filteredProducts).toHaveLength(1);
    expect(result.current.filteredProducts[0]!.name).toBe('Cola');
  });

  it('should handle API error with retry countdown', async () => {
    mockGetProducts.mockResolvedValue({ success: false, error: 'API Error' });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.loadError).toBe('API Error');
    expect(result.current.retryCountdown).toBeGreaterThan(0);
  });

  it('should cancel retry', async () => {
    mockGetProducts.mockResolvedValue({ success: false, error: 'API Error' });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loadError).toBe('API Error');
    });

    act(() => {
      result.current.cancelRetry();
    });

    expect(result.current.retryCountdown).toBe(0);
    expect(result.current.loadError).toBeNull();
  });

  it('should handle barcode scan (Enter key) and add to cart', async () => {
    const products = [
      createMockProduct({
        id: 1,
        name: 'Product',
        sku: 'BAR123',
        status: 'publish',
        stock_status: 'instock',
      }),
    ] as WooCommerceProduct[];

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: products } } };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setSearchTerm('BAR123');
    });

    act(() => {
      result.current.handleSearchKeyDown({ key: 'Enter' } as KeyboardEvent<HTMLInputElement>);
    });

    expect(mockAddToCart).toHaveBeenCalledWith(expect.objectContaining({ sku: 'BAR123' }));
  });

  describe('barcode API fallback', () => {
    const scan = async (code: string): Promise<void> => {
      const { result } = renderHook(() => usePOSProducts(mockAddToCart));
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setSearchTerm(code));
      act(() =>
        result.current.handleSearchKeyDown({ key: 'Enter' } as KeyboardEvent<HTMLInputElement>)
      );
    };

    beforeEach(() => {
      useOffline.setState({ isOnline: true });
      mockGetProducts.mockResolvedValue({ success: true, data: [], headers: {} });
    });

    it('adds a variation found by SKU via the API', async () => {
      const variation = createMockProduct({ id: 99, sku: 'VAR-1', parent_id: 5 });
      mockGetProducts.mockImplementation(async (params: { sku?: string }) => ({
        success: true,
        data: params.sku ? [variation] : [],
        headers: {},
      }));
      await scan('VAR-1');
      await waitFor(() => expect(mockAddToCart).toHaveBeenCalledWith(variation));
      expect(mockGetProducts).toHaveBeenCalledWith({ sku: 'VAR-1' });
    });

    it('toasts when the SKU is not found', async () => {
      await scan('NOPE');
      await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
      expect(mockAddToCart).not.toHaveBeenCalled();
    });

    it('toasts on API error', async () => {
      mockGetProducts.mockResolvedValue({ success: false, error: 'boom' });
      await scan('ERR');
      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('boom'))
      );
    });

    it('skips the API lookup when offline', async () => {
      useOffline.setState({ isOnline: false });
      await scan('OFF');
      expect(mockGetProducts).not.toHaveBeenCalledWith({ sku: 'OFF' });
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it('should not load when no store configured', async () => {
    (useStoreConfig as unknown as Mock).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = { getCurrentStore: () => undefined };
        return selector ? selector(state) : state;
      }
    );

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetProducts).not.toHaveBeenCalled();
  });

  it('should toggle category dropdown', async () => {
    mockGetProducts.mockResolvedValue({ success: true, data: [], headers: {} });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    // Wait for async effects to settle first
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setShowCategoryDropdown(true);
    });

    expect(result.current.showCategoryDropdown).toBe(true);
  });

  it('should filter categories by search term', async () => {
    const products = [
      createMockProduct({
        id: 1,
        status: 'publish',
        stock_status: 'instock',
        categories: [{ id: 1, name: 'Electronics', slug: 'electronics' }],
      }),
      createMockProduct({
        id: 2,
        status: 'publish',
        stock_status: 'instock',
        categories: [{ id: 2, name: 'Clothing', slug: 'clothing' }],
      }),
    ] as WooCommerceProduct[];

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: products } } };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => usePOSProducts(mockAddToCart));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setCategorySearch('elec');
    });

    expect(result.current.filteredCategories).toContain('Electronics');
    expect(result.current.filteredCategories).not.toContain('Clothing');
  });
});
