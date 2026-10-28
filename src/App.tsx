import React, { useEffect, lazy, Suspense, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useStoreConfig, useTheme, useCache, useAppSettings } from './stores';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import DataManager from './components/DataManager';
import LoadingScreen from './components/LoadingScreen';
import PinLockScreen from './components/PinLockScreen';
import OfflineIndicator from './components/OfflineIndicator';
import CommandPalette from './components/CommandPalette';
import OrderCelebrationOverlay from './components/OrderCelebrationOverlay';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { startMemoryMonitor, stopMemoryMonitor } from './utils/memoryMonitor';
import { startupMetrics } from './utils/startupMetrics';

// Mark imports complete
startupMetrics.mark('imports-complete');

// Eager-loaded pages (frequently accessed, needed immediately)
import Dashboard from './pages/Dashboard';
import OrdersPage from './pages/OrdersPage';
import ProductsPage from './pages/ProductsPage';
import SetupPage from './pages/SetupPage';

// Lazy-loaded pages (less frequently accessed, can load on demand)
const MultiStoreView = lazy(() => import('./pages/MultiStoreView'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const ProductEditPage = lazy(() => import('./pages/ProductEditPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const POSPage = lazy(() => import('./pages/POSPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CouponsPage = lazy(() => import('./pages/CouponsPage'));
const StoreHealthPage = lazy(() => import('./pages/StoreHealthPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const AttributesPage = lazy(() => import('./pages/AttributesPage'));
const TaxPage = lazy(() => import('./pages/TaxPage'));
const ActivityLogPage = lazy(() => import('./pages/ActivityLogPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));

// Analytics pages - lazy loaded as a group (includes chart.js)
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SalesAnalyticsPage = lazy(() => import('./pages/SalesAnalyticsPage'));
const CustomerAnalyticsPage = lazy(() => import('./pages/CustomerAnalyticsPage'));
const ProductAnalyticsPage = lazy(() => import('./pages/ProductAnalyticsPage'));
const OrderAnalyticsPage = lazy(() => import('./pages/OrderAnalyticsPage'));
const FinancialAnalyticsPage = lazy(() => import('./pages/FinancialAnalyticsPage'));
const KPIDashboardPage = lazy(() => import('./pages/KPIDashboardPage'));
const GeographicAnalyticsPage = lazy(() => import('./pages/GeographicAnalyticsPage'));

/**
 * Prefetch analytics pages when user is likely to navigate to them.
 * Call this on hover over analytics navigation links.
 */
let prefetchedAnalytics = false;
export function prefetchAnalyticsPages(): void {
  if (prefetchedAnalytics) return;
  prefetchedAnalytics = true;

  // Prefetch all analytics pages in parallel
  import('./pages/AnalyticsPage');
  import('./pages/SalesAnalyticsPage');
  import('./pages/CustomerAnalyticsPage');
  import('./pages/ProductAnalyticsPage');
  import('./pages/OrderAnalyticsPage');
  import('./pages/FinancialAnalyticsPage');
  import('./pages/KPIDashboardPage');
  import('./pages/GeographicAnalyticsPage');
}

/**
 * Listens for Electron notification clicks and navigates to the target route.
 * Must be rendered inside <Router> to access useNavigate.
 */
function NotificationRouter(): null {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.electronAPI) return;

    return window.electronAPI.onNotificationClicked((data) => {
      if (data.route) {
        navigate(data.route);
      }
    });
  }, [navigate]);

  return null;
}

// Loading fallback component for lazy-loaded routes
function PageLoadingFallback(): React.ReactElement {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function AppContent(): React.ReactElement {
  const stores = useStoreConfig((state) => state.stores);
  const clearCache = useCache((state) => state.clearCache);
  const theme = useTheme((state) => state.theme);
  const hasStores = stores.length > 0;
  const toast = useToast();

  // App settings for loading screen and PIN lock
  const {
    isInitialized,
    setInitialized,
    pinEnabled,
    pinCode,
    checkPinTimeout,
    updateLastActivity,
  } = useAppSettings();

  const [showLoadingScreen, setShowLoadingScreen] = useState(!isInitialized);

  // Handle loading screen completion
  const handleLoadingComplete = useCallback(() => {
    setShowLoadingScreen(false);
    setInitialized(true);
    updateLastActivity();
  }, [setInitialized, updateLastActivity]);

  // Check PIN timeout periodically
  useEffect(() => {
    if (!pinEnabled || !pinCode) return;

    // Check immediately
    checkPinTimeout();

    // Check every minute
    const interval = setInterval(() => {
      checkPinTimeout();
    }, 60000);

    return () => clearInterval(interval);
  }, [pinEnabled, pinCode, checkPinTimeout]);

  // Update last activity on user interaction
  useEffect(() => {
    if (!pinEnabled || !pinCode) return;

    const handleActivity = (): void => {
      updateLastActivity();
    };

    // Track various user interactions
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [pinEnabled, pinCode, updateLastActivity]);

  // Mark component mount
  useEffect(() => {
    startupMetrics.mark('app-content-mounted');

    // Log startup report after initial render
    const timeoutId = setTimeout(() => {
      startupMetrics.mark('first-render-complete');
      // Only log in development
      if (import.meta.env.DEV) {
        startupMetrics.logReport();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Start memory monitoring
  useEffect(() => {
    startMemoryMonitor();
    return () => stopMemoryMonitor();
  }, []);

  // Listen for clear-cache event from Electron menu
  useEffect(() => {
    // Check if we're running in Electron (using secure API)
    if (window.electronAPI) {
      const handleClearCache = (): void => {
        clearCache();
        toast.success('Cache cleared successfully!');
        // Reload the page to refresh all data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      };

      return window.electronAPI.onClearCache(handleClearCache);
    }
    return undefined;
  }, [clearCache, toast]);

  // Show loading screen on first launch
  if (showLoadingScreen) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <ErrorBoundary>
      {/* PIN Lock Screen - shows when locked */}
      <PinLockScreen />

      {/* Offline Indicator - shows when offline or has pending operations */}
      <OfflineIndicator />

      {/* DataManager: Centralized data fetching that never unmounts */}
      {hasStores && <DataManager />}

      {/* Order celebration overlay with confetti */}
      <OrderCelebrationOverlay />
      <Router>
        {/* Handle notification click navigation */}
        <NotificationRouter />
        {/* Command Palette - global keyboard navigation */}
        <CommandPalette />
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {!hasStores ? (
              <>
                <Route path="/setup" element={<SetupPage />} />
                <Route path="*" element={<Navigate to="/setup" replace />} />
              </>
            ) : (
              <>
                {/* POS Mode - Full screen, no layout */}
                <Route path="/pos" element={<POSPage />} />

                <Route element={<Layout />}>
                {/* Eager-loaded routes */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* Lazy-loaded routes */}
                <Route path="/multi-store" element={<MultiStoreView />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/products/:id" element={<ProductEditPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/coupons" element={<CouponsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/attributes" element={<AttributesPage />} />
                <Route path="/tax" element={<TaxPage />} />
                <Route path="/store-health" element={<StoreHealthPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/activity-log" element={<ActivityLogPage />} />

                {/* Analytics routes (lazy-loaded with chart.js) */}
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/analytics/sales" element={<SalesAnalyticsPage />} />
                <Route path="/analytics/customers" element={<CustomerAnalyticsPage />} />
                <Route path="/analytics/products" element={<ProductAnalyticsPage />} />
                <Route path="/analytics/orders" element={<OrderAnalyticsPage />} />
                <Route path="/analytics/financial" element={<FinancialAnalyticsPage />} />
                <Route path="/analytics/kpis" element={<KPIDashboardPage />} />
                <Route path="/analytics/geographic" element={<GeographicAnalyticsPage />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
              </>
            )}
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

function App(): React.ReactElement {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
