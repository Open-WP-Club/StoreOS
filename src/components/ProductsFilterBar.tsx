import React, { ChangeEvent, ReactElement } from 'react';
import { RefreshCw, Filter, X, Trash2, Edit } from 'lucide-react';
import FilterPresetManager from './FilterPresetManager';
import ExportMenu from './ExportMenu';
import type { FilterPreset } from '../types';
import type { ProductFilters } from '../hooks/useProductFilters';

interface ProductsFilterBarProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onSearchParamsUpdate: (value: string) => void;
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  hasActiveFilters: boolean;
  filteredProductsCount: number;
  totalProductsCount: number;
  onClearAllFilters: () => void;
  onApplyPreset: (presetFilters: Record<string, unknown>) => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  selectedProductIds: number[];
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Search bar, advanced filters, bulk action toolbar, and export controls.
 */
export function ProductsFilterBar({
  searchTerm,
  onSearchTermChange,
  onSearchParamsUpdate,
  filters,
  onFiltersChange,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  hasActiveFilters,
  filteredProductsCount,
  totalProductsCount,
  onClearAllFilters,
  onApplyPreset,
  onExportCSV,
  onExportPDF,
  onRefresh,
  isLoading,
  selectedProductIds,
  onBulkEdit,
  onBulkDelete,
  onClearSelection,
  showToast,
}: ProductsFilterBarProps): ReactElement {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 transition-colors">
      <div className="flex flex-col gap-4">
        {/* Search Bar and Actions */}
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by product name, SKU, or ID..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                onSearchTermChange(value);
                onSearchParamsUpdate(value);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={onToggleAdvancedFilters}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              hasActiveFilters
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Toggle advanced filters"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                Active
              </span>
            )}
          </button>
          <FilterPresetManager
            type="products"
            currentFilters={filters as unknown as Record<string, unknown>}
            onApplyPreset={onApplyPreset}
            onSaveSuccess={(preset: FilterPreset) =>
              showToast(`Preset "${preset.name}" saved`, 'success')
            }
          />
          <ExportMenu onExportCSV={onExportCSV} onExportPDF={onExportPDF} />
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title="Refresh products"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Advanced Filters
              </h3>
              {(hasActiveFilters || searchTerm) && (
                <button
                  onClick={onClearAllFilters}
                  className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="stock-status-filter"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Stock Status
                </label>
                <select
                  id="stock-status-filter"
                  value={filters.stockStatus}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    onFiltersChange({ ...filters, stockStatus: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Stock Status</option>
                  <option value="instock">In Stock</option>
                  <option value="outofstock">Out of Stock</option>
                  <option value="onbackorder">On Backorder</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="product-status-filter"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Product Status
                </label>
                <select
                  id="product-status-filter"
                  value={filters.status}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    onFiltersChange({ ...filters, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="publish">Published</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price Range
                </span>
                <div className="flex gap-2">
                  <input
                    id="price-min"
                    type="number"
                    placeholder="Min"
                    aria-label="Minimum price"
                    value={filters.priceMin}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      onFiltersChange({ ...filters, priceMin: e.target.value })
                    }
                    className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    id="price-max"
                    type="number"
                    placeholder="Max"
                    aria-label="Maximum price"
                    value={filters.priceMax}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      onFiltersChange({ ...filters, priceMax: e.target.value })
                    }
                    className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stock Quantity
                </span>
                <div className="flex gap-2">
                  <input
                    id="stock-min"
                    type="number"
                    placeholder="Min"
                    aria-label="Minimum stock quantity"
                    value={filters.stockMin}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      onFiltersChange({ ...filters, stockMin: e.target.value })
                    }
                    className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    id="stock-max"
                    type="number"
                    placeholder="Max"
                    aria-label="Maximum stock quantity"
                    value={filters.stockMax}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      onFiltersChange({ ...filters, stockMax: e.target.value })
                    }
                    className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {filteredProductsCount}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {totalProductsCount}
              </span>{' '}
              products
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedProductIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
          <span className="text-sm font-medium text-blue-900">
            {selectedProductIds.length} product{selectedProductIds.length !== 1 ? 's' : ''}{' '}
            selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onBulkEdit}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Edit className="w-4 h-4" />
              Bulk Edit
            </button>
            <button
              onClick={onBulkDelete}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
            <button
              onClick={onClearSelection}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductsFilterBar;
