import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { SEARCH } from '../constants/config';
import type { RecentSearch, FilterPreset } from '../types';

// ============================================
// Types
// ============================================

type SearchType = 'global' | 'orders' | 'products' | 'customers';
type FilterPresetType = 'orders' | 'products';

interface NewSearchInput {
  query: string;
  type?: SearchType;
  storeId?: string | null;
}

interface NewFilterPresetInput {
  name: string;
  type?: FilterPresetType;
  filters?: Record<string, unknown>;
  storeId?: string | null;
}

interface SearchState {
  recentSearches: RecentSearch[];
  maxRecentSearches: number;
  savedFilterPresets: FilterPreset[];
}

interface SearchActions {
  addRecentSearch: (search: NewSearchInput) => void;
  removeRecentSearch: (id: string) => void;
  clearRecentSearches: () => void;
  getRecentSearchesFor: (type?: SearchType | null, storeId?: string | null) => RecentSearch[];
  addFilterPreset: (preset: NewFilterPresetInput) => FilterPreset;
  updateFilterPreset: (id: string, updates: Partial<FilterPreset>) => void;
  deleteFilterPreset: (id: string) => void;
  getFilterPresetsForType: (type: FilterPresetType, storeId?: string | null) => FilterPreset[];
  clearFilterPresets: () => void;
}

type SearchStore = SearchState & SearchActions;

// ============================================
// Store
// ============================================

/**
 * Search Store
 *
 * Manages search history and saved filter presets.
 * Persisted to localStorage for user convenience.
 */
const useSearch = create<SearchStore>()(
  persist(
    immer((set, get) => ({
      // Recent searches state
      recentSearches: [],
      maxRecentSearches: SEARCH.MAX_RECENT_SEARCHES,

      // Saved filter presets
      savedFilterPresets: [],

      // ============================================
      // Recent Searches Management
      // ============================================

      /**
       * Add a search to recent history
       */
      addRecentSearch: (search: NewSearchInput) => {
        const { query, type, storeId } = search;

        // Don't add empty searches
        if (!query || query.trim() === '') return;

        const searchItem: RecentSearch = {
          id: crypto.randomUUID(),
          query: query.trim(),
          type: type || 'global',
          storeId: storeId || null,
          timestamp: new Date().toISOString(),
        };

        set((state) => {
          // Remove duplicate searches (same query + type + store)
          state.recentSearches = state.recentSearches.filter(
            (s) =>
              !(
                s.query === searchItem.query &&
                s.type === searchItem.type &&
                s.storeId === searchItem.storeId
              )
          );

          // Add to beginning and limit
          state.recentSearches.unshift(searchItem);
          state.recentSearches = state.recentSearches.slice(0, state.maxRecentSearches);
        });
      },

      /**
       * Remove a specific search from history
       */
      removeRecentSearch: (id: string) => {
        set((state) => {
          const index = state.recentSearches.findIndex((s) => s.id === id);
          if (index !== -1) state.recentSearches.splice(index, 1);
        });
      },

      /**
       * Clear all recent searches
       */
      clearRecentSearches: () => {
        set({ recentSearches: [] });
      },

      /**
       * Get recent searches for a specific type/store
       */
      getRecentSearchesFor: (type: SearchType | null = null, storeId: string | null = null): RecentSearch[] => {
        const { recentSearches } = get();
        return recentSearches.filter((s) => {
          if (type && s.type !== type) return false;
          if (storeId && s.storeId !== storeId) return false;
          return true;
        });
      },

      // ============================================
      // Filter Presets Management
      // ============================================

      /**
       * Add a new filter preset
       */
      addFilterPreset: (preset: NewFilterPresetInput): FilterPreset => {
        const { name, type, filters, storeId } = preset;

        const presetItem: FilterPreset = {
          id: crypto.randomUUID(),
          name: name.trim(),
          type: type || 'products',
          filters: filters || {},
          storeId: storeId || null,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          state.savedFilterPresets.push(presetItem);
        });

        return presetItem;
      },

      /**
       * Update an existing filter preset
       */
      updateFilterPreset: (id: string, updates: Partial<FilterPreset>) => {
        set((state) => {
          const preset = state.savedFilterPresets.find((p) => p.id === id);
          if (preset) {
            Object.assign(preset, updates);
            preset.updatedAt = new Date().toISOString();
          }
        });
      },

      /**
       * Delete a filter preset
       */
      deleteFilterPreset: (id: string) => {
        set((state) => {
          const index = state.savedFilterPresets.findIndex((p) => p.id === id);
          if (index !== -1) state.savedFilterPresets.splice(index, 1);
        });
      },

      /**
       * Get filter presets for a specific type and optional store
       */
      getFilterPresetsForType: (type: FilterPresetType, storeId: string | null = null): FilterPreset[] => {
        const { savedFilterPresets } = get();

        return savedFilterPresets.filter(
          (preset) =>
            preset.type === type &&
            (preset.storeId === storeId || preset.storeId === 'all' || !storeId)
        );
      },

      /**
       * Clear all filter presets
       */
      clearFilterPresets: () => {
        set({ savedFilterPresets: [] });
      },
    })),
    {
      name: 'woocommerce-search',
      partialize: (state): SearchState => ({
        recentSearches: state.recentSearches,
        savedFilterPresets: state.savedFilterPresets,
        maxRecentSearches: state.maxRecentSearches,
      }),
    }
  )
);

export default useSearch;

// Export types for consumers
export type { SearchState, SearchActions, SearchStore, SearchType, FilterPresetType, NewSearchInput, NewFilterPresetInput };
