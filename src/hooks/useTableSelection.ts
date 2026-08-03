import { useState, useCallback, useMemo, Dispatch, SetStateAction } from 'react';
import type { ChangeEvent } from 'react';

interface UseTableSelectionResult<T extends { id: number }> {
  selectedIds: number[];
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  selectedCount: number;
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
  handleSelectAll: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSelectItem: (itemId: number) => void;
  clearSelection: () => void;
  selectAll: () => void;
  getSelectedItems: () => T[];
  isSelected: (itemId: number) => boolean;
}

/**
 * useTableSelection - Reusable table row selection logic
 *
 * @param items - Array of items with id property (current page items)
 * @param allItems - Optional: all items for getSelectedItems (defaults to items)
 * @returns Selection state and handlers
 *
 * @example
 * const { selectedIds, handleSelectAll, handleSelectItem, clearSelection } = useTableSelection(paginatedProducts, allProducts);
 */
export function useTableSelection<T extends { id: number }>(
  items: T[],
  allItems?: T[]
): UseTableSelectionResult<T> {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const sourceItems = allItems || items;

  const isAllSelected = useMemo(() => {
    return items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  }, [items, selectedIds]);

  const isPartiallySelected = useMemo(() => {
    return selectedIds.length > 0 && !isAllSelected;
  }, [selectedIds.length, isAllSelected]);

  const selectedCount = selectedIds.length;

  const handleSelectAll = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      if (e.target.checked) {
        setSelectedIds(items.map((item) => item.id));
      } else {
        setSelectedIds([]);
      }
    },
    [items]
  );

  const handleSelectItem = useCallback((itemId: number): void => {
    setSelectedIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  }, []);

  const clearSelection = useCallback((): void => {
    setSelectedIds([]);
  }, []);

  const selectAll = useCallback((): void => {
    setSelectedIds(items.map((item) => item.id));
  }, [items]);

  const getSelectedItems = useCallback((): T[] => {
    return sourceItems.filter((item) => selectedIds.includes(item.id));
  }, [sourceItems, selectedIds]);

  const isSelected = useCallback(
    (itemId: number): boolean => {
      return selectedIds.includes(itemId);
    },
    [selectedIds]
  );

  return {
    selectedIds,
    isAllSelected,
    isPartiallySelected,
    selectedCount,
    setSelectedIds,
    handleSelectAll,
    handleSelectItem,
    clearSelection,
    selectAll,
    getSelectedItems,
    isSelected,
  };
}

export default useTableSelection;
