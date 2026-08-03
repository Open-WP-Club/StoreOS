import { renderHook, act } from '@testing-library/react';
import { useTableSelection } from '../useTableSelection';

describe('useTableSelection', () => {
  const createItems = (count) =>
    Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

  describe('initial state', () => {
    it('should have empty selection initially', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      expect(result.current.selectedIds).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isPartiallySelected).toBe(false);
    });
  });

  describe('handleSelectItem', () => {
    it('should select an item', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(1);
      });

      expect(result.current.selectedIds).toEqual([1]);
      expect(result.current.selectedCount).toBe(1);
    });

    it('should deselect an already selected item', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(1);
      });

      act(() => {
        result.current.handleSelectItem(1);
      });

      expect(result.current.selectedIds).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
    });

    it('should select multiple items', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(1);
        result.current.handleSelectItem(3);
        result.current.handleSelectItem(5);
      });

      expect(result.current.selectedIds).toContain(1);
      expect(result.current.selectedIds).toContain(3);
      expect(result.current.selectedIds).toContain(5);
      expect(result.current.selectedCount).toBe(3);
    });
  });

  describe('handleSelectAll', () => {
    it('should select all items when checked', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      const event = { target: { checked: true } };

      act(() => {
        result.current.handleSelectAll(event);
      });

      expect(result.current.selectedIds).toEqual([1, 2, 3, 4, 5]);
      expect(result.current.isAllSelected).toBe(true);
    });

    it('should deselect all items when unchecked', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      // First select all
      act(() => {
        result.current.handleSelectAll({ target: { checked: true } });
      });

      // Then deselect all
      act(() => {
        result.current.handleSelectAll({ target: { checked: false } });
      });

      expect(result.current.selectedIds).toEqual([]);
      expect(result.current.isAllSelected).toBe(false);
    });
  });

  describe('selectAll', () => {
    it('should select all items programmatically', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selectedIds).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('clearSelection', () => {
    it('should clear all selected items', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.selectAll();
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedIds).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('isAllSelected', () => {
    it('should be true when all items are selected', () => {
      const items = createItems(3);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(1);
        result.current.handleSelectItem(2);
        result.current.handleSelectItem(3);
      });

      expect(result.current.isAllSelected).toBe(true);
    });

    it('should be false when not all items are selected', () => {
      const items = createItems(3);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(1);
        result.current.handleSelectItem(2);
      });

      expect(result.current.isAllSelected).toBe(false);
    });

    it('should be false for empty items array', () => {
      const { result } = renderHook(() => useTableSelection([]));

      expect(result.current.isAllSelected).toBe(false);
    });
  });

  describe('isPartiallySelected', () => {
    it('should be true when some but not all items are selected', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(1);
        result.current.handleSelectItem(2);
      });

      expect(result.current.isPartiallySelected).toBe(true);
    });

    it('should be false when no items are selected', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      expect(result.current.isPartiallySelected).toBe(false);
    });

    it('should be false when all items are selected', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.isPartiallySelected).toBe(false);
    });
  });

  describe('isSelected', () => {
    it('should return true for selected item', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(3);
      });

      expect(result.current.isSelected(3)).toBe(true);
    });

    it('should return false for non-selected item', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(3);
      });

      expect(result.current.isSelected(1)).toBe(false);
    });
  });

  describe('getSelectedItems', () => {
    it('should return selected items from current items', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(1);
        result.current.handleSelectItem(3);
      });

      const selected = result.current.getSelectedItems();

      expect(selected).toHaveLength(2);
      expect(selected.map((i) => i.id)).toEqual([1, 3]);
    });

    it('should return selected items from allItems when provided', () => {
      const pageItems = createItems(5); // Items 1-5
      const allItems = createItems(10); // Items 1-10

      const { result } = renderHook(() =>
        useTableSelection(pageItems, allItems)
      );

      // Select items that exist in both pageItems and allItems
      act(() => {
        result.current.handleSelectItem(1);
        result.current.handleSelectItem(3);
      });

      // Also manually add an ID from allItems that's not in pageItems
      act(() => {
        result.current.setSelectedIds([1, 3, 8]);
      });

      const selected = result.current.getSelectedItems();

      // Should find all 3 items from allItems
      expect(selected).toHaveLength(3);
      expect(selected.map((i) => i.id)).toContain(1);
      expect(selected.map((i) => i.id)).toContain(3);
      expect(selected.map((i) => i.id)).toContain(8);
    });

    it('should return empty array when nothing is selected', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      expect(result.current.getSelectedItems()).toEqual([]);
    });
  });

  describe('setSelectedIds', () => {
    it('should set selected IDs directly', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.setSelectedIds([1, 2, 4]);
      });

      expect(result.current.selectedIds).toEqual([1, 2, 4]);
    });
  });

  describe('items change behavior', () => {
    it('should update isAllSelected when items change', () => {
      const initialItems = createItems(3);
      const { result, rerender } = renderHook(
        ({ items }) => useTableSelection(items),
        { initialProps: { items: initialItems } }
      );

      // Select all initial items
      act(() => {
        result.current.selectAll();
      });

      expect(result.current.isAllSelected).toBe(true);

      // Add more items
      const newItems = createItems(5);
      rerender({ items: newItems });

      // isAllSelected should now be false since we only have 3 selected out of 5
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isPartiallySelected).toBe(true);
    });

    it('should maintain selection when items change', () => {
      const initialItems = createItems(5);
      const { result, rerender } = renderHook(
        ({ items }) => useTableSelection(items),
        { initialProps: { items: initialItems } }
      );

      act(() => {
        result.current.handleSelectItem(1);
        result.current.handleSelectItem(2);
      });

      const newItems = createItems(10);
      rerender({ items: newItems });

      // Selection should be maintained
      expect(result.current.selectedIds).toEqual([1, 2]);
    });
  });

  describe('edge cases', () => {
    it('should handle selecting non-existent item IDs', () => {
      const items = createItems(5);
      const { result } = renderHook(() => useTableSelection(items));

      act(() => {
        result.current.handleSelectItem(999);
      });

      // Should add the ID even if item doesn't exist
      expect(result.current.selectedIds).toContain(999);
    });

    it('should handle empty items with selections', () => {
      const { result } = renderHook(() => useTableSelection([]));

      act(() => {
        result.current.setSelectedIds([1, 2, 3]);
      });

      expect(result.current.selectedIds).toEqual([1, 2, 3]);
      expect(result.current.isAllSelected).toBe(false); // No items means not all selected
    });
  });
});
