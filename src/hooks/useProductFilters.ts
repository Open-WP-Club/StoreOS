import { useState, useCallback, useMemo, useDeferredValue } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchProducts, applyProductFilters } from '../utils/searchService';
import useSettings from '../stores/settingsStore';
import type { Product } from '../types';

export interface ProductFilters {
  stockStatus: string;
  status: string;
  priceMin: string;
  priceMax: string;
  stockMin: string;
  stockMax: string;
}

export interface ProductStats {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

interface UseProductFiltersResult {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: ProductFilters;
  setFilters: (filters: ProductFilters) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (show: boolean) => void;
  hasActiveFilters: boolean;
  filteredProducts: Product[];
  paginatedProducts: Product[];
  stats: ProductStats;
  currentPage: number;
  pageSize: number;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;
  clearAllFilters: () => void;
  handleApplyPreset: (presetFilters: Record<string, unknown>, showToast: (msg: string, type: 'success' | 'error' | 'info') => void) => void;
  searchParams: URLSearchParams;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}

/**
 * Hook for search, filters, pagination, and stats on the Products page.
 */
export function useProductFilters(products: Product[]): UseProductFiltersResult {
  const lowStockThreshold = useSettings((state) => state.lowStockThreshold);
  const [searchParams, setSearchParams] = useSearchParams();
  // Derive searchTerm directly from URL params (no separate state needed)
  const searchTerm = searchParams.get('search') || '';
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [filters, setFilters] = useState<ProductFilters>({
    stockStatus: 'all',
    status: 'all',
    priceMin: '',
    priceMax: '',
    stockMin: '',
    stockMax: '',
  });

  const setSearchTerm = useCallback((term: string) => {
    setSearchParams(term ? { search: term } : {});
    setCurrentPage(1);
  }, [setSearchParams]);

  const stats = useMemo<ProductStats>(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.stock_status === 'instock').length;
    const lowStock = products.filter(
      (p) => p.stock_quantity !== null && p.stock_quantity <= lowStockThreshold && p.stock_quantity > 0
    ).length;
    const outOfStock = products.filter((p) => p.stock_status === 'outofstock').length;
    return { total, inStock, lowStock, outOfStock };
  }, [products, lowStockThreshold]);

  const deferredSearch = useDeferredValue(searchTerm);
  const searchedProducts = useMemo(() => {
    if (deferredSearch.trim() === '') return products;
    return searchProducts(products, deferredSearch, { minScore: 0.3 });
  }, [products, deferredSearch]);

  const filteredProducts = useMemo(() => {
    return applyProductFilters(searchedProducts, filters);
  }, [searchedProducts, filters]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((value) => value !== '' && value !== 'all');
  }, [filters]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number): void => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const clearAllFilters = (): void => {
    setFilters({
      stockStatus: 'all',
      status: 'all',
      priceMin: '',
      priceMax: '',
      stockMin: '',
      stockMax: '',
    });
    setSearchTerm('');
  };

  const handleApplyPreset = (presetFilters: Record<string, unknown>, showToast: (msg: string, type: 'success' | 'error' | 'info') => void): void => {
    setFilters(presetFilters as unknown as ProductFilters);
    showToast('Filter preset applied', 'success');
  };

  return {
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    showAdvancedFilters,
    setShowAdvancedFilters,
    hasActiveFilters,
    filteredProducts,
    paginatedProducts,
    stats,
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    clearAllFilters,
    handleApplyPreset,
    searchParams,
    setSearchParams,
  };
}

export default useProductFilters;
