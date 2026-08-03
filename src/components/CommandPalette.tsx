import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Package,
  ShoppingCart,
  Users,
  Tag,
  BarChart3,
  Store,
  Settings,
  RefreshCw,
  Moon,
  Sun,
  Database,
  Download,
  Plus,
  Home,
  Monitor,
  Box,
  Command,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCache, useTheme } from '../stores';
import { useKeyboardShortcut, getShortcutDisplay } from '../hooks/useKeyboardShortcut';
import { searchProducts, searchOrders } from '../utils/searchService';
import type { WooCommerceProduct, WooCommerceOrder, WooCommerceCustomer, WooCommerceCoupon } from '../types';
import { EMPTY_ARRAY } from '../constants';

interface CommandAction {
  id: string;
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  category: 'Navigation' | 'Actions' | 'Search Results' | 'Recent';
  keywords?: string[];
}

/**
 * CommandPalette - Enhanced command palette with keyboard-first workflow
 * Supports navigation, actions, and search across all data types
 */
function CommandPalette(): React.ReactElement | null {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [mode, setMode] = useState<'commands' | 'search'>('commands');
  const inputRef = useRef<HTMLInputElement>(null);

  const productsFromCache = useCache(
    (state) => (state.cache.products?.data as WooCommerceProduct[] | undefined) || EMPTY_ARRAY
  );
  const ordersFromCache = useCache(
    (state) => (state.cache.orders?.data as WooCommerceOrder[] | undefined) || EMPTY_ARRAY
  );
  const customersFromCache = useCache(
    (state) => (state.cache.customers?.data as WooCommerceCustomer[] | undefined) || EMPTY_ARRAY
  );
  const couponsFromCache = useCache(
    (state) => (state.cache.coupons?.data as WooCommerceCoupon[] | undefined) || EMPTY_ARRAY
  );
  const { theme, toggleTheme } = useTheme();
  const clearCache = useCache((state) => state.clearCache);
  const clearCacheForType = useCache((state) => state.clearCacheForType);

  // Open the palette, resetting query/selection for a fresh session
  const openPalette = useCallback((nextMode: 'commands' | 'search') => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
    setMode(nextMode);
  }, []);

  // Register keyboard shortcut to open palette
  useKeyboardShortcut(['cmd+k', 'ctrl+k'], () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      openPalette('commands');
    }
  });

  // Additional shortcut for quick search mode
  useKeyboardShortcut(['cmd+p', 'ctrl+p'], () => {
    openPalette('search');
  });

  // Quick navigation shortcuts
  useKeyboardShortcut(['g then h', 'alt+h'], () => navigate('/'));
  useKeyboardShortcut(['g then o', 'alt+o'], () => navigate('/orders'));
  useKeyboardShortcut(['g then p', 'alt+p'], () => navigate('/products'));
  useKeyboardShortcut(['g then c', 'alt+c'], () => navigate('/customers'));
  useKeyboardShortcut(['g then u', 'alt+u'], () => navigate('/coupons'));

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Define available commands
  const commands: CommandAction[] = useMemo(() => {
    const navCommands: CommandAction[] = [
      {
        id: 'nav-home',
        icon: Home,
        label: 'Go to Dashboard',
        shortcut: 'G H',
        action: () => { navigate('/'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['home', 'dashboard', 'main'],
      },
      {
        id: 'nav-orders',
        icon: ShoppingCart,
        label: 'Go to Orders',
        shortcut: 'G O',
        action: () => { navigate('/orders'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['orders', 'sales'],
      },
      {
        id: 'nav-products',
        icon: Package,
        label: 'Go to Products',
        shortcut: 'G P',
        action: () => { navigate('/products'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['products', 'items', 'inventory'],
      },
      {
        id: 'nav-customers',
        icon: Users,
        label: 'Go to Customers',
        shortcut: 'G C',
        action: () => { navigate('/customers'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['customers', 'users', 'clients'],
      },
      {
        id: 'nav-coupons',
        icon: Tag,
        label: 'Go to Coupons',
        shortcut: 'G U',
        action: () => { navigate('/coupons'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['coupons', 'discounts', 'promo'],
      },
      {
        id: 'nav-inventory',
        icon: Box,
        label: 'Go to Inventory',
        action: () => { navigate('/inventory'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['inventory', 'stock'],
      },
      {
        id: 'nav-analytics',
        icon: BarChart3,
        label: 'Go to Analytics',
        action: () => { navigate('/analytics'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['analytics', 'reports', 'stats'],
      },
      {
        id: 'nav-pos',
        icon: Monitor,
        label: 'Go to POS',
        action: () => { navigate('/pos'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['pos', 'point of sale', 'register'],
      },
      {
        id: 'nav-multi-store',
        icon: Store,
        label: 'Go to Multi-Store View',
        action: () => { navigate('/multi-store'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['multi', 'store', 'compare'],
      },
      {
        id: 'nav-settings',
        icon: Settings,
        label: 'Go to Settings',
        action: () => { navigate('/settings'); setIsOpen(false); },
        category: 'Navigation',
        keywords: ['settings', 'preferences', 'config'],
      },
    ];

    const actionCommands: CommandAction[] = [
      {
        id: 'action-toggle-theme',
        icon: theme === 'light' ? Moon : Sun,
        label: theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
        action: () => { toggleTheme(); setIsOpen(false); },
        category: 'Actions',
        keywords: ['theme', 'dark', 'light', 'mode'],
      },
      {
        id: 'action-refresh-orders',
        icon: RefreshCw,
        label: 'Refresh Orders',
        action: async () => { await clearCacheForType('orders'); window.location.reload(); },
        category: 'Actions',
        keywords: ['refresh', 'reload', 'orders', 'sync'],
      },
      {
        id: 'action-refresh-products',
        icon: RefreshCw,
        label: 'Refresh Products',
        action: async () => { await clearCacheForType('products'); window.location.reload(); },
        category: 'Actions',
        keywords: ['refresh', 'reload', 'products', 'sync'],
      },
      {
        id: 'action-refresh-customers',
        icon: RefreshCw,
        label: 'Refresh Customers',
        action: async () => { await clearCacheForType('customers'); window.location.reload(); },
        category: 'Actions',
        keywords: ['refresh', 'reload', 'customers', 'sync'],
      },
      {
        id: 'action-clear-cache',
        icon: Database,
        label: 'Clear All Cache',
        action: async () => { await clearCache(); window.location.reload(); },
        category: 'Actions',
        keywords: ['clear', 'cache', 'reset'],
      },
      {
        id: 'action-new-order',
        icon: Plus,
        label: 'Create New Order (POS)',
        action: () => { navigate('/pos'); setIsOpen(false); },
        category: 'Actions',
        keywords: ['new', 'order', 'create', 'pos'],
      },
      {
        id: 'action-new-coupon',
        icon: Plus,
        label: 'Create New Coupon',
        action: () => { navigate('/coupons?action=new'); setIsOpen(false); },
        category: 'Actions',
        keywords: ['new', 'coupon', 'create', 'discount'],
      },
      {
        id: 'action-export',
        icon: Download,
        label: 'Export Current View',
        sublabel: 'Export data from current page',
        action: () => {
          // Trigger export based on current page
          const path = location.pathname;
          if (path.includes('orders')) navigate('/orders?export=true');
          else if (path.includes('products')) navigate('/products?export=true');
          else if (path.includes('customers')) navigate('/customers?export=true');
          else if (path.includes('coupons')) navigate('/coupons?export=true');
          setIsOpen(false);
        },
        category: 'Actions',
        keywords: ['export', 'csv', 'download'],
      },
    ];

    return [...navCommands, ...actionCommands];
  }, [navigate, theme, toggleTheme, clearCache, clearCacheForType, location.pathname]);

  // Search results
  const searchResults = useMemo((): CommandAction[] => {
    if (query.trim().length < 2) return [];

    const results: CommandAction[] = [];
    const searchQuery = query.toLowerCase();

    // Search products
    const productResults = searchProducts(productsFromCache, searchQuery, { minScore: 0.4 })
      .slice(0, 5)
      .map((product): CommandAction => ({
        id: `product-${product.id}`,
        icon: Package,
        label: product.name,
        sublabel: `${product.sku || 'No SKU'} - ${product.price}`,
        action: () => { navigate(`/products/${product.id}`); setIsOpen(false); },
        category: 'Search Results',
      }));
    results.push(...productResults);

    // Search orders
    const orderResults = searchOrders(ordersFromCache, searchQuery, { minScore: 0.4 })
      .slice(0, 5)
      .map((order): CommandAction => ({
        id: `order-${order.id}`,
        icon: ShoppingCart,
        label: `Order #${order.id}`,
        sublabel: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''} - ${order.total}`,
        action: () => { navigate(`/orders/${order.id}`); setIsOpen(false); },
        category: 'Search Results',
      }));
    results.push(...orderResults);

    // Search customers
    const customerResults = customersFromCache
      .filter((c) =>
        c.email?.toLowerCase().includes(searchQuery) ||
        c.first_name?.toLowerCase().includes(searchQuery) ||
        c.last_name?.toLowerCase().includes(searchQuery) ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery)
      )
      .slice(0, 5)
      .map((customer): CommandAction => ({
        id: `customer-${customer.id}`,
        icon: Users,
        label: `${customer.first_name} ${customer.last_name}`,
        sublabel: customer.email,
        action: () => { navigate(`/customers?search=${encodeURIComponent(customer.email)}`); setIsOpen(false); },
        category: 'Search Results',
      }));
    results.push(...customerResults);

    // Search coupons
    const couponResults = couponsFromCache
      .filter((c) =>
        c.code?.toLowerCase().includes(searchQuery) ||
        c.description?.toLowerCase().includes(searchQuery)
      )
      .slice(0, 5)
      .map((coupon): CommandAction => ({
        id: `coupon-${coupon.id}`,
        icon: Tag,
        label: coupon.code,
        sublabel: `${coupon.discount_type} - ${coupon.amount}`,
        action: () => { navigate(`/coupons?search=${encodeURIComponent(coupon.code)}`); setIsOpen(false); },
        category: 'Search Results',
      }));
    results.push(...couponResults);

    return results;
  }, [query, productsFromCache, ordersFromCache, customersFromCache, couponsFromCache, navigate]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (query.trim() === '') {
      return mode === 'search' ? [] : commands;
    }

    const searchTerm = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(searchTerm) ||
        cmd.keywords?.some((k) => k.includes(searchTerm))
    );
  }, [commands, query, mode]);

  // Combine results
  const allResults = useMemo(() => {
    return [...filteredCommands, ...searchResults];
  }, [filteredCommands, searchResults]);

  // Group results by category
  const groupedResults = useMemo(() => {
    return allResults.reduce<Record<string, CommandAction[]>>((acc, item) => {
      const cat = acc[item.category] ?? [];
      cat.push(item);
      acc[item.category] = cat;
      return acc;
    }, {});
  }, [allResults]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, allResults.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + allResults.length) % Math.max(1, allResults.length));
        break;
      case 'Enter':
        e.preventDefault();
        if (allResults[selectedIndex]) {
          allResults[selectedIndex].action();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab':
        e.preventDefault();
        setMode(mode === 'commands' ? 'search' : 'commands');
        break;
    }
  }, [allResults, selectedIndex, mode, setIsOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close command palette"
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setIsOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-start justify-center p-4 pt-[10vh]">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Header with mode tabs */}
          <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setMode('commands')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                mode === 'commands'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Command className="w-4 h-4" />
              Commands
            </button>
            <button
              onClick={() => setMode('search')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                mode === 'search'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            <div className="flex-1" />
            <div className="px-4 text-xs text-gray-400">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Tab</kbd>
              {' '}to switch
            </div>
          </div>

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
              placeholder={mode === 'commands' ? 'Type a command or search...' : 'Search products, orders, customers, coupons...'}
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 text-lg"
            />
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {allResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No results found</p>
                {mode === 'search' && query.length < 2 && (
                  <p className="text-sm mt-1">Type at least 2 characters to search</p>
                )}
              </div>
            ) : (
              Object.entries(groupedResults).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50">
                    {category}
                  </div>
                  {items.map((item) => {
                    const globalIndex = allResults.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-l-2 border-transparent'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${
                            isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium truncate ${
                              isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {item.label}
                          </div>
                          {item.sublabel && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {item.sublabel}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <div className="flex-shrink-0 flex items-center gap-1">
                            {item.shortcut.split(' ').map((key, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-500 dark:text-gray-400">
                                  {key}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
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

export default React.memo(CommandPalette);
