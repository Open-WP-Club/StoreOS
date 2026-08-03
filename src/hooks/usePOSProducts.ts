import { useState, useEffect, useMemo, useCallback, useRef, KeyboardEvent, RefObject } from 'react';
import { useStoreConfig, useCache } from '../stores';
import WooCommerceService from '../services/woocommerce';
import type { WooCommerceProduct } from '../types';

const PRODUCTS_PER_PAGE = 20;
const EMPTY_PRODUCTS: WooCommerceProduct[] = [];
const NOT_SYNCED = Symbol('not-synced');

interface UsePOSProductsResult {
  products: WooCommerceProduct[];
  filteredProducts: WooCommerceProduct[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalProducts: number;
  loadError: string | null;
  retryCountdown: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  categorySearch: string;
  setCategorySearch: (term: string) => void;
  showCategoryDropdown: boolean;
  setShowCategoryDropdown: (show: boolean) => void;
  categories: string[];
  filteredCategories: string[];
  categoryDropdownRef: RefObject<HTMLDivElement | null>;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  infiniteScrollEnabled: boolean;
  loadProducts: (page: number, append?: boolean) => Promise<void>;
  loadMoreProducts: () => void;
  cancelRetry: () => void;
  handleSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Hook for POS product loading, pagination, infinite scroll, search, categories, and retry logic.
 */
export function usePOSProducts(
  addToCart: (product: WooCommerceProduct) => void
): UsePOSProductsResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const productsFromCache = useCache((state) => state.cache.products?.data ?? EMPTY_PRODUCTS);
  const currentStore = getCurrentStore();

  const retryDelaySeconds = currentStore?.loadingSettings?.retryDelaySeconds ?? 60;
  const infiniteScrollEnabled = currentStore?.loadingSettings?.posInfiniteScroll !== false;

  const [products, setProducts] = useState<WooCommerceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Clear retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
    };
  }, []);

  // Start retry countdown
  const startRetryCountdown = useCallback((seconds: number, retryFn: () => void): void => {
    setRetryCountdown(seconds);

    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
    }

    retryTimerRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          if (retryTimerRef.current) {
            clearInterval(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          retryFn();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const cancelRetry = useCallback((): void => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setRetryCountdown(0);
    setLoadError(null);
  }, []);

  // Ref to the latest loadProducts, so the retry callback below can call it
  // without self-referencing the useCallback it's declared inside of.
  const loadProductsRef = useRef<(page: number, append?: boolean) => Promise<void>>(async () => {});

  const loadProducts = useCallback(async (page: number, append: boolean = false): Promise<void> => {
    if (!currentStore) {
      setLoading(false);
      return;
    }

    setLoadError(null);
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setRetryCountdown(0);

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const service = new WooCommerceService(currentStore);
      const result = await service.getProducts({
        status: 'publish',
        per_page: PRODUCTS_PER_PAGE,
        page,
      });

      if (result.success && result.data) {
        const total = parseInt(result.headers?.['x-wp-total'] || String(result.data.length), 10);
        const totalPages = parseInt(result.headers?.['x-wp-totalpages'] || '1', 10);

        setTotalProducts(total);
        setHasMore(page < totalPages);
        setCurrentPage(page);
        setLoadError(null);

        if (append) {
          setProducts((prev) => [...prev, ...result.data!]);
        } else {
          setProducts(result.data);
        }
      } else {
        const errorMsg = 'error' in result && result.error ? result.error : 'Неуспешно зареждане на продукти';
        setLoadError(errorMsg);
        startRetryCountdown(retryDelaySeconds, () => loadProductsRef.current(page, append));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Грешка при зареждане';
      setLoadError(errorMsg);
      startRetryCountdown(retryDelaySeconds, () => loadProductsRef.current(page, append));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentStore, retryDelaySeconds, startRetryCountdown]);

  useEffect(() => {
    loadProductsRef.current = loadProducts;
  });

  const loadMoreProducts = useCallback((): void => {
    if (!loadingMore && hasMore) {
      loadProducts(currentPage + 1, true);
    }
  }, [loadProducts, currentPage, loadingMore, hasMore]);

  // Render-time adjustment: as soon as the cache (or store) changes -
  // including on mount, via the NOT_SYNCED sentinel - and the cache has
  // data, reflect it immediately instead of via a synchronous setState
  // inside an effect. See https://react.dev/learn/you-might-not-need-an-effect
  const [prevCacheInit, setPrevCacheInit] = useState<
    { store: typeof currentStore; cache: typeof productsFromCache } | typeof NOT_SYNCED
  >(NOT_SYNCED);
  if (
    prevCacheInit === NOT_SYNCED ||
    prevCacheInit.store !== currentStore ||
    prevCacheInit.cache !== productsFromCache
  ) {
    setPrevCacheInit({ store: currentStore, cache: productsFromCache });
    if (productsFromCache.length > 0) {
      setProducts(productsFromCache.slice(0, PRODUCTS_PER_PAGE));
      setHasMore(productsFromCache.length > PRODUCTS_PER_PAGE);
      setTotalProducts(productsFromCache.length);
      setLoading(false);
    } else if (!currentStore) {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    if (productsFromCache.length > 0) {
      return;
    }

    if (currentStore) {
      void Promise.resolve().then(() => loadProducts(1));
    }
  }, [currentStore, productsFromCache, loadProducts]);

  // Infinite scroll
  useEffect(() => {
    if (!infiniteScrollEnabled) return;

    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !loadingMore && !loading && !searchTerm && selectedCategory === 'all') {
          loadMoreProducts();
        }
      },
      { root: null, rootMargin: '100px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => { observer.disconnect(); };
  }, [infiniteScrollEnabled, hasMore, loadingMore, loading, searchTerm, selectedCategory, loadMoreProducts]);

  // Categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      p.categories?.forEach((c) => cats.add(c.name));
    });
    return Array.from(cats).sort();
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const term = categorySearch.toLowerCase();
    return categories.filter((cat) => cat.toLowerCase().includes(term));
  }, [categories, categorySearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products.filter((p) => p.status === 'publish' && p.stock_status !== 'outofstock');

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.id.toString() === term
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.categories?.some((c) => c.name === selectedCategory));
    }

    return filtered;
  }, [products, searchTerm, selectedCategory]);

  // Barcode scan handler
  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter' && searchTerm) {
        const product = products.find(
          (p) => p.sku?.toLowerCase() === searchTerm.toLowerCase()
        );
        if (product) {
          addToCart(product);
          setSearchTerm('');
        }
      }
    },
    [searchTerm, products, addToCart]
  );

  return {
    products,
    filteredProducts,
    loading,
    loadingMore,
    hasMore,
    totalProducts,
    loadError,
    retryCountdown,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    categorySearch,
    setCategorySearch,
    showCategoryDropdown,
    setShowCategoryDropdown,
    categories,
    filteredCategories,
    categoryDropdownRef,
    loadMoreRef,
    infiniteScrollEnabled,
    loadProducts,
    loadMoreProducts,
    cancelRetry,
    handleSearchKeyDown,
  };
}

export default usePOSProducts;
