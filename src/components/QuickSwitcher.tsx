import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Clock,
  Package,
  ShoppingCart,
  BarChart3,
  Store,
  Settings,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStoreConfig, useCache, useSearch } from '../stores';
import { useKeyboardShortcut, getShortcutDisplay } from '../hooks/useKeyboardShortcut';
import { searchProducts, searchOrders } from '../utils/searchService';
import type { WooCommerceProduct, WooCommerceOrder } from '../types';
import { EMPTY_ARRAY } from '../constants';

interface QuickAction {
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  action: () => void;
  category: string;
}

/**
 * QuickSwitcher - CMD+K / CTRL+K overlay for global navigation and search
 */
function QuickSwitcher(): React.ReactElement | null {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const productsFromCache = useCache(
    (state) => (state.cache.products?.data as WooCommerceProduct[] | undefined) || EMPTY_ARRAY
  );
  const ordersFromCache = useCache(
    (state) => (state.cache.orders?.data as WooCommerceOrder[] | undefined) || EMPTY_ARRAY
  );
  const recentSearches = useSearch((state) => state.recentSearches);
  const addRecentSearch = useSearch((state) => state.addRecentSearch);

  const currentStore = getCurrentStore();

  // Register keyboard shortcut
  useKeyboardShortcut(['cmd+k', 'ctrl+k'], () => {
    setIsOpen((prev) => !prev);
  });

  // Focus input when opened - resetting state when modal opens is intentional for proper modal reset
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Quick actions (shown when query is empty)
  const quickActions: QuickAction[] = [
    { icon: Package, label: 'Products', action: () => navigate('/products'), category: 'Navigate' },
    {
      icon: ShoppingCart,
      label: 'Orders',
      action: () => navigate('/orders'),
      category: 'Navigate',
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      action: () => navigate('/analytics'),
      category: 'Navigate',
    },
    {
      icon: Store,
      label: 'Multi-Store View',
      action: () => navigate('/multi-store'),
      category: 'Navigate',
    },
    { icon: Settings, label: 'Settings', action: () => navigate('/setup'), category: 'Navigate' },
  ];

  // Search results
  const getSearchResults = (): QuickAction[] => {
    if (query.trim() === '') {
      // Show quick actions and recent searches
      const recentItems: QuickAction[] = recentSearches.slice(0, 5).map((search) => ({
        icon: Clock,
        label: search.query,
        sublabel: `${search.type} - Recent search`,
        action: () => {
          navigate(`/${search.type}?search=${encodeURIComponent(search.query)}`);
          setIsOpen(false);
        },
        category: 'Recent',
      }));

      return [...quickActions, ...recentItems];
    }

    // Search products
    const productResults: QuickAction[] = searchProducts(productsFromCache, query, {
      minScore: 0.4,
    })
      .slice(0, 5)
      .map((product) => ({
        icon: Package,
        label: product.name,
        sublabel: `${product.sku || 'No SKU'} - $${product.price}`,
        action: () => {
          navigate(`/products/${product.id}`);
          addRecentSearch({ query: product.name, type: 'products', storeId: currentStore?.id ?? null });
          setIsOpen(false);
        },
        category: 'Products',
      }));

    // Search orders
    const orderResults: QuickAction[] = searchOrders(ordersFromCache, query, { minScore: 0.4 })
      .slice(0, 5)
      .map((order) => ({
        icon: ShoppingCart,
        label: `Order #${order.id}`,
        sublabel: `${order.billing?.first_name} ${order.billing?.last_name} - $${order.total}`,
        action: () => {
          navigate(`/orders/${order.id}`);
          addRecentSearch({
            query: `#${order.id}`,
            type: 'orders',
            storeId: currentStore?.id ?? null,
          });
          setIsOpen(false);
        },
        category: 'Orders',
      }));

    return [...productResults, ...orderResults];
  };

  const results = getSearchResults();

  // Group results by category
  const groupedResults = results.reduce<Record<string, QuickAction[]>>((acc, item) => {
    const categoryArray = acc[item.category] ?? [];
    categoryArray.push(item);
    acc[item.category] = categoryArray;
    return acc;
  }, {});

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close quick switcher"
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setIsOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-start justify-center p-4 pt-[10vh]">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search products, orders, or navigate..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 text-lg"
            />
            <button
              onClick={() => setIsOpen(false)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No results found</p>
                {query && <p className="text-sm mt-1">Try searching for products or orders</p>}
              </div>
            ) : (
              Object.entries(groupedResults).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50">
                    {category}
                  </div>
                  {items.map((item) => {
                    const globalIndex = results.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={globalIndex}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-l-2 border-transparent'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}
                          >
                            {item.label}
                          </div>
                          {item.sublabel && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {item.sublabel}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer with shortcuts hint */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs">
                    ↑↓
                  </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs">
                    ↵
                  </kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs">
                    ESC
                  </kbd>
                  Close
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs">
                  {getShortcutDisplay(['cmd+k', 'ctrl+k'])}+K
                </kbd>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickSwitcher;
