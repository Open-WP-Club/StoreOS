import React, { ReactElement, KeyboardEvent } from 'react';
import {
  Search,
  X,
  Plus,
  Package,
  Loader2,
  ChevronDown,
  Folder,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { formatPrice } from '../utils/currency';
import type { WooCommerceProduct } from '../types';

interface POSProductGridProps {
  products: WooCommerceProduct[];
  filteredProducts: WooCommerceProduct[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalProducts: number;
  loadError: string | null;
  retryCountdown: number;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  categorySearch: string;
  onCategorySearchChange: (term: string) => void;
  showCategoryDropdown: boolean;
  onToggleCategoryDropdown: () => void;
  onCloseCategoryDropdown: () => void;
  categories: string[];
  filteredCategories: string[];
  categoryDropdownRef: React.RefObject<HTMLDivElement | null>;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  infiniteScrollEnabled: boolean;
  onLoadMore: () => void;
  onProductClick: (product: WooCommerceProduct) => void;
  onCancelRetry: () => void;
  onRetry: () => void;
}

/**
 * POS product grid with search, category filter, and infinite scroll.
 */
export function POSProductGrid({
  products,
  filteredProducts,
  loading,
  loadingMore,
  hasMore,
  totalProducts,
  loadError,
  retryCountdown,
  searchTerm,
  onSearchTermChange,
  onSearchKeyDown,
  selectedCategory,
  onSelectCategory,
  categorySearch,
  onCategorySearchChange,
  showCategoryDropdown,
  onToggleCategoryDropdown,
  onCloseCategoryDropdown,
  categories: _categories,
  filteredCategories,
  categoryDropdownRef,
  loadMoreRef,
  infiniteScrollEnabled,
  onLoadMore,
  onProductClick,
  onCancelRetry,
  onRetry,
}: POSProductGridProps): ReactElement {
  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      {/* Search & Category Filter */}
      <div className="flex gap-2 mb-4">
        {/* Search */}
        <div className="w-3/4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Търси продукт..."
            className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => onSearchTermChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Dropdown */}
        <div className="relative w-1/4" ref={categoryDropdownRef}>
          <button
            onClick={onToggleCategoryDropdown}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-gray-400" />
              <span className="font-medium truncate">
                {selectedCategory === 'all' ? 'Всички' : selectedCategory}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                showCategoryDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showCategoryDropdown && (
            <div className="absolute top-full left-0 mt-2 w-full sm:w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => onCategorySearchChange(e.target.value)}
                    placeholder="Търси категория..."
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  {categorySearch && (
                    <button
                      onClick={() => onCategorySearchChange('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    onSelectCategory('all');
                    onCloseCategoryDropdown();
                    onCategorySearchChange('');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span className="font-medium">Всички категории</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {products.filter((p) => p.status === 'publish').length}
                  </span>
                </button>

                {filteredCategories.length > 0 ? (
                  filteredCategories.map((cat) => {
                    const count = products.filter(
                      (p) => p.status === 'publish' && p.categories?.some((c) => c.name === cat)
                    ).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          onSelectCategory(cat);
                          onCloseCategoryDropdown();
                          onCategorySearchChange('');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          selectedCategory === cat
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Folder className="w-4 h-4" />
                        <span className="font-medium truncate">{cat}</span>
                        <span className="ml-auto text-xs text-gray-400">{count}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Няма намерени категории</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : loadError && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
            <AlertCircle className="w-16 h-16 mb-4 text-red-400" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Грешка при зареждане
            </p>
            <p className="text-sm text-center mb-4 max-w-md">{loadError}</p>
            {retryCountdown > 0 ? (
              <div className="text-center">
                <p className="text-sm mb-3">
                  Нов опит след <span className="font-bold text-blue-600">{retryCountdown}</span> секунди
                </p>
                <button
                  onClick={onCancelRetry}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
                >
                  Отказ
                </button>
              </div>
            ) : (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Опитай отново
              </button>
            )}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Package className="w-16 h-16 mb-4" />
            <p>Няма намерени продукти</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              Показани {products.length} от {totalProducts} продукта
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredProducts.map((product) => {
                const price = parseFloat(product.sale_price || product.price || '0');
                const regularPrice = parseFloat(product.regular_price || product.price || '0');
                const onSale = product.sale_price && parseFloat(product.sale_price) > 0;
                const isVariable = product.type === 'variable';

                return (
                  <button
                    key={product.id}
                    onClick={() => onProductClick(product)}
                    className="bg-white dark:bg-gray-800 rounded-xl p-3 text-left hover:shadow-lg hover:scale-[1.02] transition-all border border-gray-200 dark:border-gray-700 group relative"
                  >
                    {isVariable && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 text-xs rounded font-medium">
                        Варианти
                      </div>
                    )}
                    <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-700 mb-2 overflow-hidden">
                      {product.images?.[0]?.src ? (
                        <img
                          src={product.images[0].src}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                      {product.name}
                    </h3>
                    {product.sku && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        SKU: {product.sku}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-600">
                        {formatPrice(price)}
                      </span>
                      {onSale && (
                        <span className="text-xs text-gray-400 line-through">
                          {formatPrice(regularPrice)}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && !searchTerm && selectedCategory === 'all' && (
              <div ref={loadMoreRef} className="flex justify-center py-6">
                {infiniteScrollEnabled ? (
                  loadingMore && (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Зареждане...</span>
                    </div>
                  )
                ) : (
                  <button
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Зареждане...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Зареди още продукти
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {!hasMore && products.length > 0 && !searchTerm && selectedCategory === 'all' && (
              <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
                Всички {totalProducts} продукта са заредени
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default POSProductGrid;
