import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, X, Package, ShoppingCart, Users } from 'lucide-react';
import { useStoreConfig, useCache, useSearch } from '../stores';
import { universalSearch, type UniversalSearchResult } from '../utils/searchService';
import type { WooCommerceProduct, WooCommerceOrder, WooCommerceCustomer, RecentSearch } from '../types';
import { EMPTY_ARRAY } from '../constants';

interface GlobalSearchProps {
  placeholder?: string;
  compact?: boolean;
}

type CategoryType = 'products' | 'orders' | 'customers';

interface SearchCategory {
  type: CategoryType;
  label: string;
  icon: React.ReactNode;
  results: UniversalSearchResult[];
}

/**
 * GlobalSearch - Universal search across products, orders, and customers
 */
function GlobalSearch({
  placeholder = 'Search products, orders, customers... (⌘K)',
  compact = false,
}: GlobalSearchProps): React.ReactElement {
  const navigate = useNavigate();
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const productsFromCache = useCache(
    (state) => (state.cache.products?.data as WooCommerceProduct[]) || EMPTY_ARRAY
  );
  const ordersFromCache = useCache(
    (state) => (state.cache.orders?.data as WooCommerceOrder[]) || EMPTY_ARRAY
  );
  const customersFromCache = useCache(
    (state) => (state.cache.customers?.data as WooCommerceCustomer[]) || EMPTY_ARRAY
  );
  const recentSearches = useSearch((state) => state.recentSearches);
  const addRecentSearch = useSearch((state) => state.addRecentSearch);
  const removeRecentSearch = useSearch((state) => state.removeRecentSearch);

  const currentStore = getCurrentStore();

  // Perform universal search
  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return { products: [], orders: [], customers: [] };
    }
    return universalSearch(query, productsFromCache, ordersFromCache, customersFromCache, 5);
  }, [query, productsFromCache, ordersFromCache, customersFromCache]);

  // Build categorized results for display
  const categories: SearchCategory[] = useMemo(() => {
    const cats: SearchCategory[] = [];

    if (searchResults.products.length > 0) {
      cats.push({
        type: 'products',
        label: 'Products',
        icon: <Package className="h-4 w-4" />,
        results: searchResults.products,
      });
    }

    if (searchResults.orders.length > 0) {
      cats.push({
        type: 'orders',
        label: 'Orders',
        icon: <ShoppingCart className="h-4 w-4" />,
        results: searchResults.orders,
      });
    }

    if (searchResults.customers.length > 0) {
      cats.push({
        type: 'customers',
        label: 'Customers',
        icon: <Users className="h-4 w-4" />,
        results: searchResults.customers,
      });
    }

    return cats;
  }, [searchResults]);

  // Flatten all results for keyboard navigation
  const flatResults = useMemo(() => {
    const items: { type: 'result'; data: UniversalSearchResult; category: CategoryType }[] = [];
    categories.forEach((cat) => {
      cat.results.forEach((result) => {
        items.push({ type: 'result', data: result, category: cat.type });
      });
    });
    return items;
  }, [categories]);

  // Get recent searches for this store
  const relevantRecentSearches = useMemo(() => {
    return recentSearches
      .filter((s) => s.storeId === currentStore?.id)
      .slice(0, 5);
  }, [recentSearches, currentStore?.id]);

  // Total selectable items (results or recent searches)
  const totalItems = query.trim() ? flatResults.length : relevantRecentSearches.length;

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selection when results change
  const prevResultsKeyRef = useRef({ totalItems, query });
  useEffect(() => {
    if (prevResultsKeyRef.current.totalItems !== totalItems || prevResultsKeyRef.current.query !== query) {
      prevResultsKeyRef.current = { totalItems, query };
      setSelectedIndex(0);
    }
  }, [totalItems, query]);

  // Keyboard shortcut to open search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResultClick = useCallback((result: UniversalSearchResult): void => {
    // Save to recent searches
    addRecentSearch({
      query: result.title,
      type: 'global',
      storeId: currentStore?.id ?? null,
    });

    // Navigate to the appropriate page
    switch (result.type) {
      case 'product':
        navigate(`/products/${result.id}/edit`);
        break;
      case 'order':
        navigate(`/orders/${result.id}`);
        break;
      case 'customer':
        navigate(`/customers?search=${encodeURIComponent(result.title)}`);
        break;
    }

    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  }, [addRecentSearch, currentStore?.id, navigate]);

  const handleRecentSearchClick = useCallback((search: RecentSearch): void => {
    setQuery(search.query);
    // Don't close - let user see results
  }, []);

  const handleSearch = useCallback((searchQuery: string): void => {
    if (!searchQuery || searchQuery.trim() === '') return;

    addRecentSearch({
      query: searchQuery,
      type: 'global',
      storeId: currentStore?.id ?? null,
    });

    // Navigate to products page with search (default behavior)
    navigate(`/products?search=${encodeURIComponent(searchQuery)}`);

    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  }, [addRecentSearch, currentStore?.id, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!isOpen && e.key !== 'Enter') {
      setIsOpen(true);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (totalItems > 0) {
          setSelectedIndex((prev) => (prev + 1) % totalItems);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (totalItems > 0) {
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (query.trim()) {
          if (flatResults.length > 0 && selectedIndex >= 0 && selectedIndex < flatResults.length) {
            const selectedResult = flatResults[selectedIndex];
            if (selectedResult) handleResultClick(selectedResult.data);
          } else {
            handleSearch(query);
          }
        } else if (relevantRecentSearches.length > 0 && selectedIndex >= 0) {
          const selected = relevantRecentSearches[selectedIndex];
          if (selected) {
            setQuery(selected.query);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  const handleRemoveRecentSearch = (e: React.MouseEvent, searchId: string): void => {
    e.stopPropagation();
    removeRecentSearch(searchId);
  };

  const hasResults = categories.length > 0;
  const showDropdown = isOpen && (hasResults || (query.trim() === '' && relevantRecentSearches.length > 0));

  // Track which index we're on as we render categories
  let currentIndex = 0;

  return (
    <div className={`relative ${compact ? 'w-full' : 'w-full max-w-md'}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto"
        >
          {/* Recent searches when no query */}
          {query.trim() === '' && relevantRecentSearches.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Recent Searches
              </div>
              {relevantRecentSearches.map((search, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={search.id}
                    role="option"
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => handleRecentSearchClick(search)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRecentSearchClick(search)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-900 dark:text-white truncate">
                        {search.query}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleRemoveRecentSearch(e, search.id)}
                      className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                      aria-label={`Remove recent search: ${search.query}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Categorized search results */}
          {hasResults && (
            <div className="py-1">
              {categories.map((category) => (
                <div key={category.type}>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2">
                    {category.icon}
                    {category.label}
                  </div>
                  {category.results.map((result) => {
                    const itemIndex = currentIndex++;
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <div
                        key={`${result.type}-${result.id}`}
                        role="option"
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => handleResultClick(result)}
                        onKeyDown={(e) => e.key === 'Enter' && handleResultClick(result)}
                        className={`px-3 py-2 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {result.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {result.subtitle}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-xs text-gray-400">
                            {result.type === 'product' && <Package className="h-4 w-4" />}
                            {result.type === 'order' && <ShoppingCart className="h-4 w-4" />}
                            {result.type === 'customer' && <Users className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Show "Search for..." option at the bottom */}
              {query.trim() && (
                <div
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onClick={() => handleSearch(query)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                  className="px-3 py-2 cursor-pointer border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Search className="h-4 w-4" />
                    <span>Search for &ldquo;{query}&rdquo;</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No results message */}
          {query.trim() && !hasResults && (
            <div className="py-4 px-3 text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No results found for &ldquo;{query}&rdquo;
              </div>
              <div
                role="option"
                aria-selected={false}
                tabIndex={0}
                onClick={() => handleSearch(query)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                className="mt-2 cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Search in all products
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
