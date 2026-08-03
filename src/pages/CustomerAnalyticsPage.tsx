import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { useCache, useTheme } from '../stores';
import { formatCurrency as formatCurrencyUtil, getCurrencyCode } from '../utils/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Calendar, Users, DollarSign, ShoppingCart, Mail, MapPin } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import { useReportExport } from '../hooks/useReportExport';
import type { Order } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface TimeRange {
  value: number;
  label: string;
  days: number;
}

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

const TIME_RANGES: TimeRange[] = [
  { value: 7, label: '7 Days', days: 7 },
  { value: 14, label: '14 Days', days: 14 },
  { value: 30, label: '1 Month', days: 30 },
  { value: 90, label: '3 Months', days: 90 },
  { value: 180, label: '6 Months', days: 180 },
  { value: 365, label: '12 Months', days: 365 },
];

const CustomerAnalyticsPage: React.FC = (): React.ReactElement => {
  const getCachedData = useCache((state) => state.getCachedData);
  const theme = useTheme((state) => state.theme);

  const [loading, setLoading] = useState<boolean>(true);
  const [currencyCode, setCurrencyCode] = useState<string>('USD');
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(30);
  const [customerData, setCustomerData] = useState<CustomerData>({
    totalCustomers: 0,
    newCustomers: 0,
    returningCustomers: 0,
    averageCustomerValue: 0,
    topCustomers: [],
    customersByLocation: {},
    orderDistribution: {},
  });

  const calculateCustomerMetrics = useCallback((orders: Order[], timeRangeDays: number): void => {
    if (!orders) return;

    const detectedCurrency = getCurrencyCode(orders);
    setCurrencyCode(detectedCurrency);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - timeRangeDays);

    const filteredOrders = orders.filter(o => new Date(o.date_created) >= dateThreshold);

    // Group orders by customer email
    const customerMap: Record<string, CustomerInfo> = {};
    filteredOrders.forEach(order => {
      const email = order.billing?.email || 'guest@unknown.com';
      if (!customerMap[email]) {
        customerMap[email] = {
          email,
          name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Guest',
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
    const newCustomers = customers.filter(c => c.orders.length === 1).length;
    const returningCustomers = customers.filter(c => c.orders.length > 1).length;

    // Calculate average customer value
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Top customers by spending
    const topCustomers = [...customers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Customers by location
    const locationMap: Record<string, number> = {};
    customers.forEach(customer => {
      const location = customer.country;
      if (!locationMap[location]) {
        locationMap[location] = 0;
      }
      locationMap[location]++;
    });

    // Order distribution (1 order, 2-3 orders, 4-5 orders, 6+ orders)
    const orderDistribution: Record<string, number> = {
      '1 order': customers.filter(c => c.orders.length === 1).length,
      '2-3 orders': customers.filter(c => c.orders.length >= 2 && c.orders.length <= 3).length,
      '4-5 orders': customers.filter(c => c.orders.length >= 4 && c.orders.length <= 5).length,
      '6+ orders': customers.filter(c => c.orders.length >= 6).length,
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
  }, []);

  useEffect(() => {
    const loadCustomerAnalytics = async (): Promise<void> => {
      setLoading(true);
      try {
        const orders = await getCachedData('orders') as Order[] | null;
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

  const formatCurrency = (amount: number): string => {
    return formatCurrencyUtil(amount, currencyCode);
  };

  const handleTimeRangeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTimeRange(parseInt(e.target.value));
  };

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

  const chartOptions = useMemo(() => ({
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
  }) satisfies ChartOptions<'bar'>, [theme]);

  const timeRangeLabel = TIME_RANGES.find(r => r.value === selectedTimeRange)?.label || '';

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
      { key: 'orderCount', label: 'Orders', format: (_v, item) => String((item as Record<string, unknown>).orderCount ?? 0) },
      { key: 'totalSpent', label: 'Total Spent', format: (v) => formatCurrency(Number(v) || 0) },
    ],
    data: customerData.topCustomers.map(c => ({
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
          <label htmlFor="time-range-select" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Calendar className="w-4 h-4" />
            <span>Time Range:</span>
          </label>
          <select
            id="time-range-select"
            value={selectedTimeRange}
            onChange={handleTimeRangeChange}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {TIME_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
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
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Customers</div>
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
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">New Customers</div>
            <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {customerData.newCustomers}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            First-time buyers
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Returning Customers</div>
            <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {customerData.returningCustomers}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Repeat buyers
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Customer Value</div>
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

      {/* Top Customers */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top 10 Customers by Revenue
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rank
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Location
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Orders
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
