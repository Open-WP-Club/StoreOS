import { useState, useMemo, useCallback } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  scrollToTop?: boolean;
}

interface UsePaginationResult<T> {
  currentPage: number;
  pageSize: number;
  paginatedItems: T[];
  totalPages: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;
  resetPage: () => void;
}

/**
 * usePagination - Reusable pagination logic for tables
 *
 * @param items - Array of items to paginate
 * @param options - Pagination options
 * @returns Pagination state and handlers
 *
 * @example
 * const { paginatedItems, currentPage, handlePageChange } = usePagination(products);
 */
export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {}
): UsePaginationResult<T> {
  const {
    initialPage = 1,
    initialPageSize = 25,
    scrollToTop = true,
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, pageSize]);

  const handlePageChange = useCallback((page: number): void => {
    setCurrentPage(page);
    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollToTop]);

  const handlePageSizeChange = useCallback((size: number): void => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  const resetPage = useCallback((): void => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    pageSize,
    paginatedItems,
    totalPages,
    totalItems,
    setCurrentPage,
    setPageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPage,
  };
}

export default usePagination;
