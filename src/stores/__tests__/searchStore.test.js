import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSearch from '../searchStore';

describe('searchStore', () => {
  let dateNowCounter = 1000000000000;
  const originalDateNow = Date.now;

  beforeEach(() => {
    // Mock Date.now() to return incrementing values
    dateNowCounter = 1000000000000;
    Date.now = vi.fn(() => dateNowCounter++);

    // Reset the store before each test
    useSearch.setState({
      recentSearches: [],
      savedFilterPresets: [],
      maxRecentSearches: 10,
    });
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('recent searches', () => {
    describe('addRecentSearch', () => {
      it('should add a search', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({
            query: 'test query',
            type: 'products',
          });
        });

        expect(result.current.recentSearches).toHaveLength(1);
        expect(result.current.recentSearches[0]).toMatchObject({
          query: 'test query',
          type: 'products',
        });
      });

      it('should add search with default type "global"', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'test' });
        });

        expect(result.current.recentSearches[0].type).toBe('global');
      });

      it('should add search with storeId', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({
            query: 'test',
            type: 'orders',
            storeId: 'store-123',
          });
        });

        expect(result.current.recentSearches[0].storeId).toBe('store-123');
      });

      it('should not add empty queries', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: '' });
          result.current.addRecentSearch({ query: '   ' });
        });

        expect(result.current.recentSearches).toHaveLength(0);
      });

      it('should trim whitespace from query', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: '  test  ' });
        });

        expect(result.current.recentSearches[0].query).toBe('test');
      });

      it('should remove duplicates', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'test', type: 'products' });
          result.current.addRecentSearch({ query: 'test', type: 'products' });
        });

        expect(result.current.recentSearches).toHaveLength(1);
      });

      it('should keep both searches when type differs', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'test', type: 'products' });
          result.current.addRecentSearch({ query: 'test', type: 'orders' });
        });

        expect(result.current.recentSearches).toHaveLength(2);
      });

      it('should keep both searches when storeId differs', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({
            query: 'test',
            type: 'products',
            storeId: 'store-1',
          });
          result.current.addRecentSearch({
            query: 'test',
            type: 'products',
            storeId: 'store-2',
          });
        });

        expect(result.current.recentSearches).toHaveLength(2);
      });

      it('should add new search at the beginning', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'first' });
          result.current.addRecentSearch({ query: 'second' });
        });

        expect(result.current.recentSearches[0].query).toBe('second');
        expect(result.current.recentSearches[1].query).toBe('first');
      });

      it('should limit to maxRecentSearches', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          for (let i = 0; i < 15; i++) {
            result.current.addRecentSearch({ query: `query-${i}` });
          }
        });

        expect(result.current.recentSearches).toHaveLength(10);
      });
    });

    describe('removeRecentSearch', () => {
      it('should remove a specific search', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'first' });
          result.current.addRecentSearch({ query: 'second' });
        });

        const searchIdToRemove = result.current.recentSearches[0].id;

        act(() => {
          result.current.removeRecentSearch(searchIdToRemove);
        });

        expect(result.current.recentSearches).toHaveLength(1);
        expect(result.current.recentSearches[0].query).toBe('first');
      });

      it('should do nothing if id not found', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'test' });
        });

        act(() => {
          result.current.removeRecentSearch('non-existent-id');
        });

        expect(result.current.recentSearches).toHaveLength(1);
      });
    });

    describe('clearRecentSearches', () => {
      it('should clear all searches', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'first' });
          result.current.addRecentSearch({ query: 'second' });
        });

        act(() => {
          result.current.clearRecentSearches();
        });

        expect(result.current.recentSearches).toHaveLength(0);
      });
    });

    describe('getRecentSearchesFor', () => {
      it('should filter by type', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'test1', type: 'products' });
          result.current.addRecentSearch({ query: 'test2', type: 'orders' });
          result.current.addRecentSearch({ query: 'test3', type: 'products' });
        });

        const productSearches = result.current.getRecentSearchesFor('products');

        expect(productSearches).toHaveLength(2);
        productSearches.forEach((s) => expect(s.type).toBe('products'));
      });

      it('should filter by storeId', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({
            query: 'test1',
            storeId: 'store-1',
          });
          result.current.addRecentSearch({
            query: 'test2',
            storeId: 'store-2',
          });
          result.current.addRecentSearch({
            query: 'test3',
            storeId: 'store-1',
          });
        });

        const store1Searches = result.current.getRecentSearchesFor(
          null,
          'store-1'
        );

        expect(store1Searches).toHaveLength(2);
        store1Searches.forEach((s) => expect(s.storeId).toBe('store-1'));
      });

      it('should filter by both type and storeId', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({
            query: 'test1',
            type: 'products',
            storeId: 'store-1',
          });
          result.current.addRecentSearch({
            query: 'test2',
            type: 'orders',
            storeId: 'store-1',
          });
          result.current.addRecentSearch({
            query: 'test3',
            type: 'products',
            storeId: 'store-2',
          });
        });

        const filtered = result.current.getRecentSearchesFor(
          'products',
          'store-1'
        );

        expect(filtered).toHaveLength(1);
        expect(filtered[0].query).toBe('test1');
      });

      it('should return all searches when no filters', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addRecentSearch({ query: 'test1', type: 'products' });
          result.current.addRecentSearch({ query: 'test2', type: 'orders' });
        });

        const allSearches = result.current.getRecentSearchesFor();

        expect(allSearches).toHaveLength(2);
      });
    });
  });

  describe('filter presets', () => {
    describe('addFilterPreset', () => {
      it('should add a preset', () => {
        const { result } = renderHook(() => useSearch());

        let addedPreset;
        act(() => {
          addedPreset = result.current.addFilterPreset({
            name: 'Low Stock',
            type: 'products',
            filters: { stockMin: 10 },
          });
        });

        expect(result.current.savedFilterPresets).toHaveLength(1);
        expect(addedPreset).toMatchObject({
          name: 'Low Stock',
          type: 'products',
          filters: { stockMin: 10 },
        });
      });

      it('should use default type "products"', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({ name: 'Test' });
        });

        expect(result.current.savedFilterPresets[0].type).toBe('products');
      });

      it('should trim preset name', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({ name: '  Low Stock  ' });
        });

        expect(result.current.savedFilterPresets[0].name).toBe('Low Stock');
      });

      it('should include createdAt timestamp', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({ name: 'Test' });
        });

        expect(result.current.savedFilterPresets[0].createdAt).toBeTruthy();
      });
    });

    describe('updateFilterPreset', () => {
      it('should update preset name', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({ name: 'Original' });
        });

        const presetId = result.current.savedFilterPresets[0].id;

        act(() => {
          result.current.updateFilterPreset(presetId, { name: 'Updated' });
        });

        expect(result.current.savedFilterPresets[0].name).toBe('Updated');
      });

      it('should update preset filters', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({
            name: 'Test',
            filters: { status: 'active' },
          });
        });

        const presetId = result.current.savedFilterPresets[0].id;

        act(() => {
          result.current.updateFilterPreset(presetId, {
            filters: { status: 'inactive' },
          });
        });

        expect(result.current.savedFilterPresets[0].filters).toEqual({
          status: 'inactive',
        });
      });

      it('should add updatedAt timestamp', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({ name: 'Test' });
        });

        const presetId = result.current.savedFilterPresets[0].id;

        act(() => {
          result.current.updateFilterPreset(presetId, { name: 'Updated' });
        });

        expect(result.current.savedFilterPresets[0].updatedAt).toBeTruthy();
      });
    });

    describe('deleteFilterPreset', () => {
      it('should delete a preset', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({ name: 'Preset 1' });
          result.current.addFilterPreset({ name: 'Preset 2' });
        });

        const presetIdToDelete = result.current.savedFilterPresets[0].id;

        act(() => {
          result.current.deleteFilterPreset(presetIdToDelete);
        });

        expect(result.current.savedFilterPresets).toHaveLength(1);
        expect(result.current.savedFilterPresets[0].name).toBe('Preset 2');
      });
    });

    describe('getFilterPresetsForType', () => {
      it('should filter by type', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({ name: 'Preset 1', type: 'products' });
          result.current.addFilterPreset({ name: 'Preset 2', type: 'orders' });
          result.current.addFilterPreset({ name: 'Preset 3', type: 'products' });
        });

        const productPresets = result.current.getFilterPresetsForType('products');

        expect(productPresets).toHaveLength(2);
        productPresets.forEach((p) => expect(p.type).toBe('products'));
      });

      it('should filter by storeId', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({
            name: 'Preset 1',
            type: 'products',
            storeId: 'store-1',
          });
          result.current.addFilterPreset({
            name: 'Preset 2',
            type: 'products',
            storeId: 'store-2',
          });
        });

        const store1Presets = result.current.getFilterPresetsForType(
          'products',
          'store-1'
        );

        expect(store1Presets).toHaveLength(1);
        expect(store1Presets[0].name).toBe('Preset 1');
      });

      it('should include presets with storeId "all"', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({
            name: 'Global Preset',
            type: 'products',
            storeId: 'all',
          });
          result.current.addFilterPreset({
            name: 'Store 1 Preset',
            type: 'products',
            storeId: 'store-1',
          });
        });

        const presets = result.current.getFilterPresetsForType(
          'products',
          'store-1'
        );

        expect(presets).toHaveLength(2);
      });
    });

    describe('clearFilterPresets', () => {
      it('should clear all presets', () => {
        const { result } = renderHook(() => useSearch());

        act(() => {
          result.current.addFilterPreset({ name: 'Preset 1' });
          result.current.addFilterPreset({ name: 'Preset 2' });
        });

        act(() => {
          result.current.clearFilterPresets();
        });

        expect(result.current.savedFilterPresets).toHaveLength(0);
      });
    });
  });
});
