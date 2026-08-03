import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';

describe('usePagination', () => {
  // Mock window.scrollTo
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  const createItems = (count) =>
    Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

  describe('initial state', () => {
    it('should return correct initial values', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items));

      expect(result.current.currentPage).toBe(1);
      expect(result.current.pageSize).toBe(25);
      expect(result.current.totalItems).toBe(100);
      expect(result.current.totalPages).toBe(4);
    });

    it('should use custom initial page', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { initialPage: 2 })
      );

      expect(result.current.currentPage).toBe(2);
    });

    it('should use custom initial page size', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { initialPageSize: 10 })
      );

      expect(result.current.pageSize).toBe(10);
      expect(result.current.totalPages).toBe(10);
    });
  });

  describe('paginatedItems', () => {
    it('should return first page items by default', () => {
      const items = createItems(50);
      const { result } = renderHook(() =>
        usePagination(items, { initialPageSize: 10 })
      );

      expect(result.current.paginatedItems).toHaveLength(10);
      expect(result.current.paginatedItems[0].id).toBe(1);
      expect(result.current.paginatedItems[9].id).toBe(10);
    });

    it('should return correct items for specific page', () => {
      const items = createItems(50);
      const { result } = renderHook(() =>
        usePagination(items, { initialPage: 2, initialPageSize: 10 })
      );

      expect(result.current.paginatedItems).toHaveLength(10);
      expect(result.current.paginatedItems[0].id).toBe(11);
      expect(result.current.paginatedItems[9].id).toBe(20);
    });

    it('should handle last page with fewer items', () => {
      const items = createItems(25);
      const { result } = renderHook(() =>
        usePagination(items, { initialPage: 3, initialPageSize: 10 })
      );

      expect(result.current.paginatedItems).toHaveLength(5);
      expect(result.current.paginatedItems[0].id).toBe(21);
      expect(result.current.paginatedItems[4].id).toBe(25);
    });

    it('should handle empty items array', () => {
      const { result } = renderHook(() => usePagination([]));

      expect(result.current.paginatedItems).toHaveLength(0);
      expect(result.current.totalItems).toBe(0);
      expect(result.current.totalPages).toBe(0);
    });
  });

  describe('handlePageChange', () => {
    it('should change current page', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items));

      act(() => {
        result.current.handlePageChange(3);
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should update paginated items', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { initialPageSize: 10 })
      );

      act(() => {
        result.current.handlePageChange(3);
      });

      expect(result.current.paginatedItems[0].id).toBe(21);
    });

    it('should scroll to top by default', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items));

      act(() => {
        result.current.handlePageChange(2);
      });

      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: 'smooth',
      });
    });

    it('should not scroll to top when disabled', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { scrollToTop: false })
      );

      act(() => {
        result.current.handlePageChange(2);
      });

      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('handlePageSizeChange', () => {
    it('should change page size', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items));

      act(() => {
        result.current.handlePageSizeChange(50);
      });

      expect(result.current.pageSize).toBe(50);
      expect(result.current.totalPages).toBe(2);
    });

    it('should reset to first page', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { initialPage: 3 })
      );

      act(() => {
        result.current.handlePageSizeChange(50);
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should update paginated items correctly', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { initialPageSize: 10 })
      );

      act(() => {
        result.current.handlePageSizeChange(20);
      });

      expect(result.current.paginatedItems).toHaveLength(20);
    });
  });

  describe('resetPage', () => {
    it('should reset to first page', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { initialPage: 5 })
      );

      expect(result.current.currentPage).toBe(5);

      act(() => {
        result.current.resetPage();
      });

      expect(result.current.currentPage).toBe(1);
    });
  });

  describe('setCurrentPage', () => {
    it('should set current page directly', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items));

      act(() => {
        result.current.setCurrentPage(4);
      });

      expect(result.current.currentPage).toBe(4);
    });
  });

  describe('setPageSize', () => {
    it('should set page size directly without resetting page', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { initialPage: 2 })
      );

      act(() => {
        result.current.setPageSize(50);
      });

      expect(result.current.pageSize).toBe(50);
      // setPageSize doesn't reset page (unlike handlePageSizeChange)
      expect(result.current.currentPage).toBe(2);
    });
  });

  describe('totalPages calculation', () => {
    it('should calculate correctly for even division', () => {
      const items = createItems(100);
      const { result } = renderHook(() =>
        usePagination(items, { initialPageSize: 25 })
      );

      expect(result.current.totalPages).toBe(4);
    });

    it('should round up for uneven division', () => {
      const items = createItems(101);
      const { result } = renderHook(() =>
        usePagination(items, { initialPageSize: 25 })
      );

      expect(result.current.totalPages).toBe(5);
    });

    it('should return 1 page for items less than page size', () => {
      const items = createItems(5);
      const { result } = renderHook(() =>
        usePagination(items, { initialPageSize: 25 })
      );

      expect(result.current.totalPages).toBe(1);
    });

    it('should return 0 pages for empty array', () => {
      const { result } = renderHook(() => usePagination([]));

      expect(result.current.totalPages).toBe(0);
    });
  });

  describe('items change', () => {
    it('should update paginated items when source items change', () => {
      const initialItems = createItems(50);
      const { result, rerender } = renderHook(({ items }) => usePagination(items), {
        initialProps: { items: initialItems },
      });

      expect(result.current.totalItems).toBe(50);

      const newItems = createItems(100);
      rerender({ items: newItems });

      expect(result.current.totalItems).toBe(100);
    });

    it('should maintain current page when items change', () => {
      const initialItems = createItems(100);
      const { result, rerender } = renderHook(({ items }) => usePagination(items), {
        initialProps: { items: initialItems },
      });

      act(() => {
        result.current.handlePageChange(3);
      });

      const newItems = createItems(200);
      rerender({ items: newItems });

      expect(result.current.currentPage).toBe(3);
    });
  });
});
