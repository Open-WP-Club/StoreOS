import React, { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingCart,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useStoreConfig, useCache } from '../stores';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { formatDate } from '../utils/dateTime';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { useDashboardStats } from '../hooks/useDashboardStats';
import LoadingIndicator from '../components/LoadingIndicator';
import PageHeader from '../components/PageHeader';
import TopSellingDays from '../components/TopSellingDays';
import OrderFunnel from '../components/OrderFunnel';
import KPICard from '../components/KPICard';
const OrderStatusDonut = lazy(() => import('../components/OrderStatusDonut'));
import DashboardTodayPerformance from '../components/dashboard/DashboardTodayPerformance';
import DashboardWeeklyStats from '../components/dashboard/DashboardWeeklyStats';
import DashboardTopProducts from '../components/dashboard/DashboardTopProducts';
import { filterOrdersByPeriod, buildKPIValue } from '../utils/kpiCalculator';
import type { WooCommerceOrder, WooCommerceProduct } from '../types';
import { DollarSign, Users } from 'lucide-react';
import { EMPTY_ARRAY } from '../constants';

function Dashboard(): React.ReactElement {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const clearCacheForType = useCache((state) => state.clearCacheForType);
  const orders = useCache(
    (state) => (state.cache.orders?.data as WooCommerceOrder[] | undefined) || EMPTY_ARRAY
  );
  const products = useCache(
    (state) => (state.cache.products?.data as WooCommerceProduct[] | undefined) || EMPTY_ARRAY
  );
  const currentStore = getCurrentStore();

  const {
    stats,
    dailyStats,
    weeklyStats,
    pendingOrdersValue,
    topProducts,
    inventoryValue,
    currencyCode,
    calculateStats,
  } = useDashboardStats();

  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [loadingTimedOut, setLoadingTimedOut] = useState<boolean>(false);
  const [kpiPeriod, setKpiPeriod] = useState<1 | 7 | 30>(30);

  const { loadingState } = useProgressiveLoading();

  // Period-over-period KPI deltas ─────────────────────────────────────────────
  const kpiMetrics = useMemo(() => {
    if (orders.length === 0) return null;

    const { current, previous } = filterOrdersByPeriod(orders, kpiPeriod);

    const isRevenue = (o: WooCommerceOrder) =>
      !['refunded', 'failed', 'cancelled', 'trash'].includes(o.status);

    const sumRev = (os: WooCommerceOrder[]) =>
      os.filter(isRevenue).reduce((s, o) => s + parseFloat(o.total || '0'), 0);

    const curRev = sumRev(current);
    const prevRev = sumRev(previous);

    const curRevenueOrders = current.filter(isRevenue);
    const prevRevenueOrders = previous.filter(isRevenue);

    const curAOV = curRevenueOrders.length > 0 ? curRev / curRevenueOrders.length : 0;
    const prevAOV = prevRevenueOrders.length > 0 ? prevRev / prevRevenueOrders.length : 0;

    // New customers: unique billing emails that appear for the first time in the current period
    const allPrevEmails = new Set(previous.map((o) => o.billing?.email).filter(Boolean));
    const newCustomers = new Set(
      current.map((o) => o.billing?.email).filter((e) => e && !allPrevEmails.has(e))
    ).size;
    const prevNewCustomers = new Set(previous.map((o) => o.billing?.email).filter(Boolean)).size;

    return {
      totalRevenue: buildKPIValue(curRev, prevRev),
      totalOrders: buildKPIValue(current.filter(isRevenue).length, previous.filter(isRevenue).length),
      avgOrderValue: buildKPIValue(curAOV, prevAOV),
      newCustomers: buildKPIValue(newCustomers, prevNewCustomers),
    };
  }, [orders, kpiPeriod]);

  const KPI_PERIOD_LABELS: Record<number, string> = {
    1: 'today vs yesterday',
    7: 'last 7d vs prior 7d',
    30: 'last 30d vs prior 30d',
  };

  // Timeout for initial loading - don't let users wait forever
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (initialLoading && orders.length === 0 && products.length === 0) {
        setLoadingTimedOut(true);
        setInitialLoading(false);
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timeout);
  }, [initialLoading, orders.length, products.length]);

  // Calculate stats whenever orders or products change
  const [prevOrders, setPrevOrders] = useState(orders);
  const [prevProducts, setPrevProducts] = useState(products);
  if (prevOrders !== orders || prevProducts !== products) {
    setPrevOrders(orders);
    setPrevProducts(products);
    if (orders.length > 0 || products.length > 0) {
      calculateStats(orders, products);
      setInitialLoading(false);
      setLoadingTimedOut(false);
    }
  }

  const formatCurrency = (amount: number): string => {
    return formatCurrencyUtil(amount, currencyCode);
  };

  if (!currentStore) {
    return (
      <div className="text-center py-12" role="status">
        <p className="text-gray-600 dark:text-gray-400">No store selected</p>
      </div>
    );
  }

  if (loadingTimedOut && orders.length === 0 && products.length === 0) {
    return (
      <div className="text-center py-12" role="status">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-900 dark:text-white font-medium text-lg">Unable to load data</p>
        <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
          Could not connect to your WooCommerce store. Please check your API credentials in Settings.
        </p>
        <Link
          to="/setup"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  if (initialLoading && orders.length === 0 && products.length === 0) {
    return (
      <div className="text-center py-12" role="status" aria-live="polite">
        <div
          className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
          aria-hidden="true"
        ></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading dashboard...</p>
        <p className="mt-2 text-gray-500 dark:text-gray-500 text-sm max-w-md mx-auto">
          Getting your store data ready. Data will appear as it loads.
        </p>
      </div>
    );
  }

  return (
    <div>
      <LoadingIndicator loadingState={loadingState} />

      <PageHeader
        title="Dashboard"
        subtitle={`Overview of your WooCommerce store: ${currentStore.name}`}
        actions={
          <button
            onClick={() => {
              clearCacheForType('orders');
              clearCacheForType('products');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title="Refresh all data"
          >
            <RefreshCw className={`w-4 h-4 ${loadingState.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <DashboardTodayPerformance dailyStats={dailyStats} formatCurrency={formatCurrency} />

      {/* Period-over-Period KPI Section */}
      {kpiMetrics && (
        <section aria-labelledby="kpi-heading" className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id="kpi-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
              Key Metrics
            </h2>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {([1, 7, 30] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setKpiPeriod(p)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    kpiPeriod === p
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {p === 1 ? 'Today' : p === 7 ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 -mt-2">
            Comparing {KPI_PERIOD_LABELS[kpiPeriod]}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Revenue"
              value={formatCurrency(kpiMetrics.totalRevenue.current)}
              changePercent={kpiMetrics.totalRevenue.changePercent}
              direction={kpiMetrics.totalRevenue.direction}
              icon={DollarSign}
            />
            <KPICard
              label="Orders"
              value={String(kpiMetrics.totalOrders.current)}
              changePercent={kpiMetrics.totalOrders.changePercent}
              direction={kpiMetrics.totalOrders.direction}
              icon={ShoppingCart}
            />
            <KPICard
              label="Avg Order Value"
              value={formatCurrency(kpiMetrics.avgOrderValue.current)}
              changePercent={kpiMetrics.avgOrderValue.changePercent}
              direction={kpiMetrics.avgOrderValue.direction}
              icon={TrendingUp}
            />
            <KPICard
              label="New Customers"
              value={String(kpiMetrics.newCustomers.current)}
              changePercent={kpiMetrics.newCustomers.changePercent}
              direction={kpiMetrics.newCustomers.direction}
              icon={Users}
            />
          </div>
        </section>
      )}

      <DashboardWeeklyStats
        weeklyStats={weeklyStats}
        pendingOrdersValue={pendingOrdersValue}
        inventoryValue={inventoryValue}
        stats={stats}
        formatCurrency={formatCurrency}
      />

      <DashboardTopProducts topProducts={topProducts} formatCurrency={formatCurrency} />

      {/* Order Status Distribution */}
      {orders.length > 0 && (
        <section
          aria-labelledby="order-status-heading"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 transition-colors"
        >
          <h2
            id="order-status-heading"
            className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
          >
            Order Status Distribution
          </h2>
          <div className="flex justify-center">
            <div className="w-72 h-72">
              <Suspense fallback={null}>
                <OrderStatusDonut orders={orders} />
              </Suspense>
            </div>
          </div>
        </section>
      )}

      {/* Top Selling Days + Order Funnel */}
      {orders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <section
            aria-labelledby="top-days-heading"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors"
          >
            <h2
              id="top-days-heading"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              Top Selling Days
            </h2>
            <TopSellingDays orders={orders} formatCurrency={formatCurrency} />
          </section>

          <section
            aria-labelledby="order-funnel-heading"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors"
          >
            <h2
              id="order-funnel-heading"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
            >
              Order Funnel
            </h2>
            <OrderFunnel orders={orders} />
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <section
          aria-labelledby="quick-actions-heading"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors"
        >
          <h2
            id="quick-actions-heading"
            className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
          >
            Quick Actions
          </h2>
          <nav aria-label="Quick navigation links">
            <ul className="space-y-3">
              <li>
                <Link
                  to="/orders"
                  className="block w-full text-left px-4 py-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Navigate to orders page"
                >
                  <span className="font-medium text-blue-900 dark:text-blue-300">
                    View All Orders
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/products"
                  className="block w-full text-left px-4 py-3 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Navigate to products page"
                >
                  <span className="font-medium text-green-900 dark:text-green-300">
                    Manage Products
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/inventory"
                  className="block w-full text-left px-4 py-3 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-label="Navigate to inventory page"
                >
                  <span className="font-medium text-purple-900 dark:text-purple-300">
                    Check Inventory
                  </span>
                </Link>
              </li>
            </ul>
          </nav>
        </section>

        {/* Store Information */}
        <section
          aria-labelledby="store-info-heading"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors"
        >
          <h2
            id="store-info-heading"
            className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
          >
            Store Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-600 dark:text-gray-400">Store Name</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{currentStore.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600 dark:text-gray-400">Store URL</dt>
              <dd className="font-medium text-gray-900 dark:text-white break-all">
                {currentStore.url}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600 dark:text-gray-400">Connected Since</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {formatDate(currentStore.createdAt)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
