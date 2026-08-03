import React, { useEffect, useMemo, useState, ChangeEvent } from 'react';
import { useStoreConfig, useCache, useTheme } from '../stores';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  type ChartOptions,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import LoadingIndicator from '../components/LoadingIndicator';
import AnalyticsRevenueCards from '../components/analytics/AnalyticsRevenueCards';
import AnalyticsTopProducts from '../components/analytics/AnalyticsTopProducts';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { Calendar } from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement
);

const TIME_RANGES = [
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '1 Month' },
  { value: 90, label: '3 Months' },
  { value: 180, label: '6 Months' },
  { value: 365, label: '12 Months' },
];

const AnalyticsPage: React.FC = () => {
  const getCachedData = useCache((state) => state.getCachedData);
  const setCachedData = useCache((state) => state.setCachedData);
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const theme = useTheme((state) => state.theme);
  const currentStore = getCurrentStore();

  const [selectedTimeRange, setSelectedTimeRange] = useState(30);

  const { loading, currencyCode, stats, dataQuality, loadingState, loadAnalytics, cancelLoading } =
    useAnalyticsData({
      currentStore,
      selectedTimeRange,
      getCachedData: getCachedData as Parameters<typeof useAnalyticsData>[0]['getCachedData'],
      setCachedData: setCachedData as Parameters<typeof useAnalyticsData>[0]['setCachedData'],
    });

  useEffect(() => {
    loadAnalytics();
    return () => cancelLoading();
  }, [loadAnalytics, cancelLoading]);

  const formatCurrency = (amount: number) => formatCurrencyUtil(amount, currencyCode);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return 'Never';
    // Relative "time ago" display - freshness only needs to be approximately
    // correct and updates whenever the component next re-renders.
    // eslint-disable-next-line react-hooks/purity
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: theme === 'dark' ? '#e5e7eb' : '#374151' },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1f2937' : 'rgba(0,0,0,0.8)',
        titleColor: theme === 'dark' ? '#f9fafb' : '#ffffff',
        bodyColor: theme === 'dark' ? '#d1d5db' : '#ffffff',
      },
    },
    scales: {
      x: {
        ticks: { color: theme === 'dark' ? '#9ca3af' : '#6b7280' },
        grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
      },
      y: {
        ticks: { color: theme === 'dark' ? '#9ca3af' : '#6b7280' },
        grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
      },
    },
  }) satisfies ChartOptions<'line'>, [theme]);

  const revenueChartData = {
    labels: stats.revenueByDay.map((d) => formatDate(d.date)),
    datasets: [{
      label: 'Revenue',
      data: stats.revenueByDay.map((d) => d.revenue),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
    }],
  };

  const ordersChartData = {
    labels: stats.ordersByDay.map((d) => formatDate(d.date)),
    datasets: [{
      label: 'Orders',
      data: stats.ordersByDay.map((d) => d.orders || 0),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
      borderColor: 'rgb(34, 197, 94)',
      borderWidth: 1,
    }],
  };

  const orderStatusChartData = {
    labels: ['Completed', 'Processing', 'Pending', 'Cancelled', 'Refunded', 'Failed'],
    datasets: [{
      data: [
        stats.orders.completed, stats.orders.processing, stats.orders.pending,
        stats.orders.cancelled, stats.orders.refunded, stats.orders.failed,
      ],
      backgroundColor: [
        'rgba(34,197,94,0.7)', 'rgba(59,130,246,0.7)', 'rgba(251,191,36,0.7)',
        'rgba(239,68,68,0.7)', 'rgba(168,85,247,0.7)', 'rgba(107,114,128,0.7)',
      ],
      borderColor: [
        'rgb(34,197,94)', 'rgb(59,130,246)', 'rgb(251,191,36)',
        'rgb(239,68,68)', 'rgb(168,85,247)', 'rgb(107,114,128)',
      ],
      borderWidth: 1,
    }],
  };

  const stockChartData = {
    labels: ['In Stock', 'Low Stock', 'Out of Stock'],
    datasets: [{
      data: [stats.products.inStock, stats.products.lowStock, stats.products.outOfStock],
      backgroundColor: ['rgba(34,197,94,0.7)', 'rgba(251,191,36,0.7)', 'rgba(239,68,68,0.7)'],
      borderColor: ['rgb(34,197,94)', 'rgb(251,191,36)', 'rgb(239,68,68)'],
      borderWidth: 1,
    }],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="text-gray-500 dark:text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  const selectedLabel = TIME_RANGES.find((r) => r.value === selectedTimeRange)?.label;

  return (
    <div className="p-6 space-y-6">
      <LoadingIndicator loadingState={loadingState} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Last updated: {formatLastUpdated(dataQuality.lastUpdated)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="time-range-select"
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            <span>Time Range:</span>
          </label>
          <select
            id="time-range-select"
            value={selectedTimeRange}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setSelectedTimeRange(parseInt(e.target.value))
            }
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            aria-label="Select time range for analytics"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={loadAnalytics}
            disabled={dataQuality.isCalculating}
            aria-label="Refresh analytics data"
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {dataQuality.isCalculating ? 'Calculating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Calculating banner */}
      {dataQuality.isCalculating && (
        <div
          className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400" aria-hidden="true" />
          <div>
            <div className="font-medium text-blue-900 dark:text-blue-300">Calculating Analytics...</div>
            <div className="text-sm text-blue-700 dark:text-blue-400">
              Processing your data to generate accurate insights.
            </div>
          </div>
        </div>
      )}

      {/* Limited data warning */}
      {!dataQuality.hasEnoughOrders && !dataQuality.isCalculating && (
        <div
          className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-yellow-900 dark:text-yellow-300">Limited Order Data</div>
              <div className="text-sm text-yellow-700 dark:text-yellow-400">
                Fewer than 5 orders in the selected range. Analytics improve with more data.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Cards */}
      <AnalyticsRevenueCards
        revenue={stats.revenue}
        orders={stats.orders}
        products={stats.products}
        formatCurrency={formatCurrency}
      />

      {/* Trend Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section aria-labelledby="revenue-trend-heading" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 id="revenue-trend-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue Trend ({selectedLabel})
          </h2>
          <div role="img" aria-label="Revenue trend line chart">
            <Line data={revenueChartData} options={chartOptions} />
          </div>
        </section>

        <section aria-labelledby="orders-trend-heading" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 id="orders-trend-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Orders by Day ({selectedLabel})
          </h2>
          <div role="img" aria-label="Orders by day bar chart">
            <Bar data={ordersChartData} options={chartOptions} />
          </div>
        </section>
      </div>

      {/* Doughnut Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section aria-labelledby="order-status-heading" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 id="order-status-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Orders by Status
          </h2>
          <div className="flex justify-center" role="img" aria-label="Orders by status doughnut chart">
            <div className="w-80 h-80">
              <Doughnut data={orderStatusChartData} options={chartOptions} />
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Total:</dt>
              <dd className="font-semibold text-gray-900 dark:text-white">{stats.orders.total}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Completed:</dt>
              <dd className="font-semibold text-green-600 dark:text-green-400">{stats.orders.completed}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="stock-distribution-heading" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 id="stock-distribution-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Stock Distribution
          </h2>
          <div className="flex justify-center" role="img" aria-label="Stock distribution doughnut chart">
            <div className="w-80 h-80">
              <Doughnut data={stockChartData} options={chartOptions} />
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Total Products:</dt>
              <dd className="font-semibold text-gray-900 dark:text-white">{stats.products.total}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">In Stock:</dt>
              <dd className="font-semibold text-green-600 dark:text-green-400">{stats.products.inStock}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Top Products */}
      <AnalyticsTopProducts products={stats.topProducts} formatCurrency={formatCurrency} />
    </div>
  );
};

export default AnalyticsPage;
