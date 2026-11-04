import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCache, useTheme } from '../stores';
import { getCurrencyCode } from '../utils/currency';
import type { ChartOptions } from 'chart.js';
import '../utils/chartSetup';
import { useAnalyticsBase } from '../hooks/useAnalyticsBase';
import TimeRangeSelect from '../components/analytics/TimeRangeSelect';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Users, DollarSign, ShoppingCart, Mail, MapPin } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import { useReportExport } from '../hooks/useReportExport';
import { exportToCSV } from '../utils/csvExport';
import { segmentCustomers, segmentCsvRows, SEGMENT_CSV_COLUMNS } from '../utils/customerSegments';
import { EMPTY_CUSTOMERS } from '../constants';
import type { Order, WooCommerceOrder } from '../types';

const EMPTY_ORDERS: WooCommerceOrder[] = [];
const COHORT_COLS = [0, 1, 2, 3, 4, 5, 6];

interface CustomerInfo {
  email: string;
  name: string;
  orders: Order[];
  totalSpent: number;
  country: string;
  city: string;
}

interface CustomerData {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageCustomerValue: number;
  topCustomers: CustomerInfo[];
  customersByLocation: Record<string, number>;
  orderDistribution: Record<string, number>;
}

const CustomerAnalyticsPage: React.FC = (): React.ReactElement => {
  const getCachedData = useCache((state) => state.getCachedData);
  const theme = useTheme((state) => state.theme);
  const allCustomers = useCache((state) => state.cache.customers?.data) ?? EMPTY_CUSTOMERS;
  const allOrders = useCache((state) => state.cache.orders?.data) ?? EMPTY_ORDERS;
  const segmentation = useMemo(
    () => segmentCustomers(allCustomers, allOrders),
    [allCustomers, allOrders]
  );

  const [loading, setLoading] = useState<boolean>(true);
  const {
    setCurrencyCode,
    selectedTimeRange,
    handleTimeRangeChange,
    timeRangeLabel,
    formatCurrency,
  } = useAnalyticsBase();
  const [customerData, setCustomerData] = useState<CustomerData>({
    totalCustomers: 0,
    newCustomers: 0,
    returningCustomers: 0,
    averageCustomerValue: 0,
    topCustomers: [],
    customersByLocation: {},
    orderDistribution: {},
  });

  const calculateCustomerMetrics = useCallback(
    (orders: Order[], timeRangeDays: number): void => {
      if (!orders) return;

      const detectedCurrency = getCurrencyCode(orders);
      setCurrencyCode(detectedCurrency);

      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - timeRangeDays);

      const filteredOrders = orders.filter((o) => new Date(o.date_created) >= dateThreshold);

      // Group orders by customer email
      const customerMap: Record<string, CustomerInfo> = {};
      filteredOrders.forEach((order) => {
        const email = order.billing?.email || 'guest@unknown.com';
        if (!customerMap[email]) {
          customerMap[email] = {
            email,
            name:
              `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() ||
              'Guest',
            orders: [],
            totalSpent: 0,
            country: order.billing?.country || 'Unknown',
            city: order.billing?.city || 'Unknown',
          };
        }
        customerMap[email].orders.push(order);
        if (order.status === 'completed') {
          customerMap[email].totalSpent += parseFloat(order.total || '0');
        }
      });

      const customers = Object.values(customerMap);
      const totalCustomers = customers.length;

      // Identify new vs returning customers
      const newCustomers = customers.filter((c) => c.orders.length === 1).length;
      const returningCustomers = customers.filter((c) => c.orders.length > 1).length;

      // Calculate average customer value
      const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
      const averageCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

      // Top customers by spending
      const topCustomers = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

      // Customers by location
      const locationMap: Record<string, number> = {};
      customers.forEach((customer) => {
        const location = customer.country;
        if (!locationMap[location]) {
          locationMap[location] = 0;
        }
        locationMap[location]++;
      });

      // Order distribution (1 order, 2-3 orders, 4-5 orders, 6+ orders)
      const orderDistribution: Record<string, number> = {
        '1 order': customers.filter((c) => c.orders.length === 1).length,
        '2-3 orders': customers.filter((c) => c.orders.length >= 2 && c.orders.length <= 3).length,
        '4-5 orders': customers.filter((c) => c.orders.length >= 4 && c.orders.length <= 5).length,
        '6+ orders': customers.filter((c) => c.orders.length >= 6).length,
      };

      setCustomerData({
        totalCustomers,
        newCustomers,
        returningCustomers,
        averageCustomerValue,
        topCustomers,
        customersByLocation: locationMap,
        orderDistribution,
      });
    },
    [setCurrencyCode]
  );

  useEffect(() => {
    const loadCustomerAnalytics = async (): Promise<void> => {
      setLoading(true);
      try {
        const orders = (await getCachedData('orders')) as Order[] | null;
        if (orders) {
          calculateCustomerMetrics(orders, selectedTimeRange);
        }
      } catch {
        // Error loading customer analytics - silently handle
      } finally {
        setLoading(false);
      }
    };

    loadCustomerAnalytics();
  }, [getCachedData, calculateCustomerMetrics, selectedTimeRange]);

  // Chart data
  const locationChartData = {
    labels: Object.keys(customerData.customersByLocation).slice(0, 10),
    datasets: [
      {
        label: 'Customers',
        data: Object.values(customerData.customersByLocation).slice(0, 10),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const orderDistributionData = {
    labels: Object.keys(customerData.orderDistribution),
    datasets: [
      {
        data: Object.values(customerData.orderDistribution),
        backgroundColor: [
          'rgba(251, 191, 36, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(34, 197, 94, 0.7)',
          'rgba(168, 85, 247, 0.7)',
        ],
        borderColor: [
          'rgb(251, 191, 36)',
          'rgb(59, 130, 246)',
          'rgb(34, 197, 94)',
          'rgb(168, 85, 247)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = useMemo(
    () =>
      ({
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top' as const,
            labels: {
              color: theme === 'dark' ? '#e5e7eb' : '#374151',
            },
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
      }) satisfies ChartOptions<'bar'>,
    [theme]
  );

  const { handleExportCSV, handleExportPDF, handlePrint } = useReportExport({
    reportName: 'Customer Analytics',
    filenamePrefix: 'customer-analytics',
    timeRange: timeRangeLabel,
    summaryMetrics: [
      { label: 'Total Customers', value: String(customerData.totalCustomers) },
      { label: 'New Customers', value: String(customerData.newCustomers) },
      { label: 'Returning', value: String(customerData.returningCustomers) },
      { label: 'Avg Customer Value', value: formatCurrency(customerData.averageCustomerValue) },
    ],
    columns: [
      { key: 'name', label: 'Customer' },
      { key: 'email', label: 'Email' },
      { key: 'country', label: 'Country' },
      {
        key: 'orderCount',
        label: 'Orders',
        format: (_v, item) => String((item as Record<string, unknown>).orderCount ?? 0),
      },
      { key: 'totalSpent', label: 'Total Spent', format: (v) => formatCurrency(Number(v) || 0) },
    ],
    data: customerData.topCustomers.map((c) => ({
      ...c,
      orderCount: c.orders.length,
    })) as Record<string, unknown>[],
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading customer analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Insights into your customer base and behavior
          </p>
        </div>

        {/* Time Range Selector + Export */}
        <div className="flex items-center gap-3">
          <TimeRangeSelect value={selectedTimeRange} onChange={handleTimeRangeChange} />
          <ExportMenu
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            onPrint={handlePrint}
            disabled={loading}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Customers
            </div>
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {customerData.totalCustomers}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Unique customers in period
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              New Customers
            </div>
            <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {customerData.newCustomers}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">First-time buyers</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Returning Customers
            </div>
            <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {customerData.returningCustomers}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">Repeat buyers</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Avg. Customer Value
            </div>
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(customerData.averageCustomerValue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Lifetime value per customer
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customers by Location */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top 10 Countries
          </h2>
          {Object.keys(customerData.customersByLocation).length > 0 ? (
            <Bar data={locationChartData} options={chartOptions} />
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No location data available
            </div>
          )}
        </div>

        {/* Order Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Customer Order Distribution
          </h2>
          <div className="flex justify-center">
            <div className="w-80 h-80">
              <Doughnut data={orderDistributionData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Customer Segments (RFM) */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex justify-between items-baseline mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Segments</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Repeat-purchase rate:{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {(segmentation.repeatRate * 100).toFixed(1)}%
            </span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['Segment', 'Customers', 'Revenue', 'Revenue share', ''].map((h) => (
                  <th
                    key={h || 'export'}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {segmentation.summary.map((s) => (
                <tr key={s.segment}>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {s.segment}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{s.count}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {formatCurrency(s.revenue)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {(s.revenueShare * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <button
                      type="button"
                      disabled={s.count === 0}
                      onClick={() =>
                        exportToCSV(
                          segmentCsvRows(segmentation.rows, s.segment),
                          SEGMENT_CSV_COLUMNS,
                          `customers-${s.segment.toLowerCase().replace(/\s+/g, '-')}.csv`
                        )
                      }
                      className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                      Export CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acquisition cohorts */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Cohort Retention (by first-order month)
        </h2>
        {segmentation.cohorts.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No order data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Cohort</th>
                  <th className="px-3 py-2">Size</th>
                  {COHORT_COLS.map((k) => (
                    <th key={k} className="px-3 py-2">
                      M{k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segmentation.cohorts.map((c) => (
                  <tr key={c.month} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{c.month}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.size}</td>
                    {c.retention.map((v, k) => (
                      <td
                        key={k}
                        className="px-3 py-2 text-gray-900 dark:text-white"
                        style={{ backgroundColor: `rgba(59, 130, 246, ${(v * 0.6).toFixed(2)})` }}
                      >
                        {Math.round(v * 100)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Customers */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top 10 Customers by Revenue
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Rank
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Customer
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Location
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Orders
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Total Spent
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {customerData.topCustomers.map((customer, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {customer.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {customer.city}, {customer.country}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {customer.orders.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerAnalyticsPage;
