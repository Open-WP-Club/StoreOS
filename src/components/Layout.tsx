import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sun,
  Moon,
  RefreshCw,
  AlertTriangle,
  ShoppingCart,
  Package,
  LayoutDashboard,
  Store,
  ShoppingBag,
  Settings,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Users,
  Box,
  FileText,
  PieChart,
  Monitor,
  LucideIcon,
  Database,
  Tag,
  Activity,
  HeartPulse,
  FolderTree,
  Layers,
  Receipt,
  MessageSquare,
  Globe,
  Keyboard,
} from 'lucide-react';
import StoreSelector from './StoreSelector';
import GlobalSearch from './GlobalSearch';
import QuickSwitcher from './QuickSwitcher';
import NotificationCenter from './NotificationCenter';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import ErrorBoundary from './ErrorBoundary';
import { useTheme, useSettings, useCache, useShallow } from '../stores';
import { prefetchAnalyticsPages } from '../App';
import type { WooCommerceProduct, WooCommerceOrder } from '../types';
import appIcon from '../../assets/icon.svg';

type ApiStatus = 'online' | 'degraded' | 'offline';
type SyncType = 'orders' | 'products' | 'inventory' | null;

interface HealthIndicators {
  lowStock: number;
  pendingOrders: number;
  apiStatus: ApiStatus;
}

interface NavItem {
  path?: string;
  label: string;
  icon: LucideIcon;
  id?: string;
  submenu?: NavItem[];
}

function Layout(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();

  // Consolidated store selectors with useShallow for optimal re-renders
  const { clearCacheForType, getCachedData } = useCache(
    useShallow((state) => ({
      clearCacheForType: state.clearCacheForType,
      getCachedData: state.getCachedData,
    }))
  );
  const { theme, toggleTheme } = useTheme(
    useShallow((state) => ({
      theme: state.theme,
      toggleTheme: state.toggleTheme,
    }))
  );
  const { autoRefresh, setAutoRefresh, lowStockThreshold } = useSettings(
    useShallow((state) => ({
      autoRefresh: state.autoRefresh,
      setAutoRefresh: state.setAutoRefresh,
      lowStockThreshold: state.lowStockThreshold,
    }))
  );
  const [syncingType, setSyncingType] = useState<SyncType>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Auto-expand the group that contains the active route
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const path = window.location.hash.slice(1) || '/'; // HashRouter: route lives in the hash
    return {
      sales: ['/orders', '/customers', '/coupons', '/reviews'].some((p) => path.startsWith(p)),
      catalog: ['/products', '/inventory', '/categories', '/attributes', '/tax'].some((p) => path.startsWith(p)),
      analytics: path.startsWith('/analytics'),
      store: ['/multi-store', '/store-health', '/activity-log'].some((p) => path.startsWith(p)),
    };
  });
  const [healthIndicators, setHealthIndicators] = useState<HealthIndicators>({
    lowStock: 0,
    pendingOrders: 0,
    apiStatus: 'online',
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ctrl+R or Cmd+R: Refresh current page
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        window.location.reload();
      }

      // Ctrl+N or Cmd+N: Navigate to products page to create new
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        navigate('/products');
      }

      // ? or Ctrl+/: Open keyboard shortcuts help
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (!isTyping && e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Load health indicators
  useEffect(() => {
    const loadHealthIndicators = async (): Promise<void> => {
      try {
        // Get cached products for low stock count
        const products = (await getCachedData('products')) as WooCommerceProduct[] | null;
        if (products) {
          const lowStockCount =
            products.filter(
              (p) => p.stock_quantity !== null && p.stock_quantity <= lowStockThreshold && p.stock_quantity > 0
            ).length + products.filter((p) => p.stock_status === 'outofstock').length;

          setHealthIndicators((prev) => ({
            ...prev,
            lowStock: lowStockCount,
          }));
        }

        // Get cached orders for pending count
        const orders = (await getCachedData('orders')) as WooCommerceOrder[] | null;
        if (orders) {
          const pendingCount = orders.filter(
            (o) => o.status === 'pending' || o.status === 'processing'
          ).length;

          setHealthIndicators((prev) => ({
            ...prev,
            pendingOrders: pendingCount,
          }));
        }

        // Update API status
        setHealthIndicators((prev) => ({
          ...prev,
          apiStatus: 'online',
        }));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading health indicators:', error);
        setHealthIndicators((prev) => ({
          ...prev,
          apiStatus: 'degraded',
        }));
      }
    };

    loadHealthIndicators();

    // Refresh indicators periodically if auto-refresh is enabled
    const tick = (): void => {
      if (document.visibilityState !== 'hidden') loadHealthIndicators();
    };
    const interval = autoRefresh ? setInterval(tick, 60000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [getCachedData, autoRefresh, lowStockThreshold]);

  const navItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/pos', label: 'POS', icon: Monitor },
    {
      label: 'Sales',
      icon: ShoppingCart,
      id: 'sales',
      submenu: [
        { path: '/orders', label: 'Orders', icon: ShoppingCart },
        { path: '/customers', label: 'Customers', icon: Users },
        { path: '/coupons', label: 'Coupons', icon: Tag },
        { path: '/reviews', label: 'Reviews', icon: MessageSquare },
      ],
    },
    {
      label: 'Catalog',
      icon: ShoppingBag,
      id: 'catalog',
      submenu: [
        { path: '/products', label: 'Products', icon: ShoppingBag },
        { path: '/inventory', label: 'Inventory', icon: Package },
        { path: '/categories', label: 'Categories', icon: FolderTree },
        { path: '/attributes', label: 'Attributes', icon: Layers },
        { path: '/tax', label: 'Tax', icon: Receipt },
      ],
    },
    {
      label: 'Analytics',
      icon: TrendingUp,
      id: 'analytics',
      submenu: [
        { path: '/analytics/kpis', label: 'KPIs', icon: Activity },
        { path: '/analytics', label: 'Overview', icon: PieChart },
        { path: '/analytics/sales', label: 'Sales', icon: DollarSign },
        { path: '/analytics/customers', label: 'Customers', icon: Users },
        { path: '/analytics/products', label: 'Products', icon: Box },
        { path: '/analytics/orders', label: 'Orders', icon: FileText },
        { path: '/analytics/financial', label: 'Financial', icon: TrendingUp },
        { path: '/analytics/geographic', label: 'Geographic', icon: Globe },
      ],
    },
    {
      label: 'Store',
      icon: Store,
      id: 'store',
      submenu: [
        { path: '/multi-store', label: 'Multi-Store', icon: Store },
        { path: '/store-health', label: 'Health Check', icon: HeartPulse },
        { path: '/activity-log', label: 'Activity Log', icon: Activity },
      ],
    },
    { path: '/setup', label: 'Stores', icon: Database },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const toggleMenu = useCallback((menuId: string): void => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  }, []);

  const handleSync = useCallback(async (type: 'orders' | 'products' | 'inventory'): Promise<void> => {
    setSyncingType(type);
    try {
      await clearCacheForType(type === 'inventory' ? 'products' : type);
      window.location.reload();
    } catch {
      setSyncingType(null);
    }
  }, [clearCacheForType]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors overflow-hidden">
      {/* Quick Switcher (CMD+K / CTRL+K) */}
      <QuickSwitcher />

      {/* Keyboard Shortcuts Modal (? / Ctrl+/) */}
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Title Bar - Compact native-style */}
      <div data-print-hide className="flex-none h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 drag-region">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src={appIcon} alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              StoreOS
            </span>
          </div>

          {/* API Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              healthIndicators.apiStatus === 'online'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : healthIndicators.apiStatus === 'degraded'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}
            title={`API Status: ${healthIndicators.apiStatus}`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                healthIndicators.apiStatus === 'online'
                  ? 'bg-green-500'
                  : healthIndicators.apiStatus === 'degraded'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            />
            {healthIndicators.apiStatus}
          </div>
        </div>

        {/* Center - Global Search */}
        <div className="flex-1 max-w-md mx-4">
          <GlobalSearch placeholder="Search... (⌘K)" compact={true} />
        </div>

        {/* Title Bar Controls */}
        <div className="flex items-center gap-2">
          <StoreSelector />

          {/* Notification Center */}
          <NotificationCenter />

          {/* Auto-Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1.5 rounded transition-colors ${
              autoRefresh
                ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={autoRefresh ? 'Auto-refresh is ON' : 'Auto-refresh is OFF'}
            aria-label={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            aria-pressed={autoRefresh}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>

          {/* Keyboard Shortcuts Help */}
          <button
            onClick={() => setShortcutsOpen(true)}
            className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Keyboard shortcuts (?)"
            aria-label="Show keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleTheme();
            }}
            className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Layout with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside data-print-hide className="flex-none w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Navigation Items */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;

              // Check if this is a submenu item
              if (item.submenu && item.id) {
                const isAnySubmenuActive = item.submenu.some(
                  (sub) => location.pathname === sub.path
                );
                const isExpanded = expandedMenus[item.id];

                return (
                  <div key={item.id}>
                    <button
                      onClick={() => toggleMenu(item.id!)}
                      onMouseEnter={item.id === 'analytics' ? prefetchAnalyticsPages : undefined}
                      aria-expanded={isExpanded}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isAnySubmenuActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.submenu.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isActive = location.pathname === subItem.path;
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path!}
                              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                isActive
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <SubIcon className="w-4 h-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular menu item
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path!}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer - Health Indicators & Quick Actions */}
          <div className="flex-none border-t border-gray-200 dark:border-gray-700 px-2 py-3 space-y-2">
            {/* Health Indicators */}
            {healthIndicators.pendingOrders > 0 && (
              <button
                onClick={() => navigate('/orders?status=pending')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                title="Pending Orders"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{healthIndicators.pendingOrders} Pending Orders</span>
              </button>
            )}

            {healthIndicators.lowStock > 0 && (
              <button
                onClick={() => navigate('/inventory?filter=low')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-md text-xs font-medium hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
                title="Low Stock Alert"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{healthIndicators.lowStock} Low Stock</span>
              </button>
            )}

            {/* Quick Sync Actions */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
                Quick Sync
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => handleSync('orders')}
                  disabled={syncingType === 'orders'}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Refresh orders data"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {syncingType === 'orders' ? 'Syncing...' : 'Orders'}
                </button>
                <button
                  onClick={() => handleSync('products')}
                  disabled={syncingType === 'products'}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Refresh products data"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {syncingType === 'products' ? 'Syncing...' : 'Products'}
                </button>
                <button
                  onClick={() => handleSync('inventory')}
                  disabled={syncingType === 'inventory'}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Refresh inventory data"
                >
                  <Package className="w-3.5 h-3.5" />
                  {syncingType === 'inventory' ? 'Syncing...' : 'Inventory'}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
          <div className="p-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
