import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { useCache, useTheme } from '../stores';
import { formatCurrency as formatCurrencyUtil, getCurrencyCode } from '../utils/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Calendar, ShoppingCart, CheckCircle, Clock, XCircle, RefreshCw, AlertCircle, DollarSign, TrendingUp } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import { useReportExport } from '../hooks/useReportExport';
import type { Order } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface TimeRange {
  value: number;
  label: string;
  days: number;
}

interface DailyOrderData {
  date: string;
  count: number;
}

interface OrderData {
  totalOrders: number;
  completedOrders: number;
  processingOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  failedOrders: number;
  completionRate: number;
  averageOrderValue: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  thisWeekOrders: number;
  thisWeekRevenue: number;
  pendingValue: number;
  ordersByDay: DailyOrderData[];
  ordersByStatus: Record<string, number>;
  ordersByPaymentMethod: Record<string, number>;
  averageProcessingTime: number;
}

const TIME_RANGES: TimeRange[] = [
  { value: 7, label: '7 Days', days: 7 },
  { value: 14, label: '14 Days', days: 14 },
  { value: 30, label: '1 Month', days: 30 },
  { value: 90, label: '3 Months', days: 90 },
  { value: 180, label: '6 Months', days: 180 },
  { value: 365, label: '12 Months', days: 365 },
];

const OrderAnalyticsPage: React.FC = (): React.ReactElement => {
  const getCachedData = useCache((state) => state.getCachedData);
  const theme = useTheme((state) => state.theme);

  const [loading, setLoading] = useState<boolean>(true);
  const [currencyCode, setCurrencyCode] = useState<string>('USD');
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(30);
  const [orderData, setOrderData] = useState<OrderData>({
    totalOrders: 0,
    completedOrders: 0,
    processingOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    refundedOrders: 0,
    failedOrders: 0,
    completionRate: 0,
    averageOrderValue: 0,
    totalRevenue: 0,
    todayOrders: 0,
    todayRevenue: 0,
    thisWeekOrders: 0,
    thisWeekRevenue: 0,
    pendingValue: 0,
    ordersByDay: [],
    ordersByStatus: {},
    ordersByPaymentMethod: {},
    averageProcessingTime: 0,
  });

  const calculateOrderMetrics = useCallback((orders: Order[], timeRangeDays: number): void => {
    if (!orders) return;

    const detectedCurrency = getCurrencyCode(orders);
    setCurrencyCode(detectedCurrency);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - timeRangeDays);

    const filteredOrders = orders.filter(o => new Date(o.date_created) >= dateThreshold);

    // Count orders by status
    const totalOrders = filteredOrders.length;
    const completedOrders = filteredOrders.filter(o => o.status === 'completed').length;
    const processingOrders = filteredOrders.filter(o => o.status === 'processing').length;
    const pendingOrders = filteredOrders.filter(o => o.status === 'pending').length;
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled').length;
    const refundedOrders = filteredOrders.filter(o => o.status === 'refunded').length;
    const failedOrders = filteredOrders.filter(o => o.status === 'failed').length;

    // Calculate completion rate
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Calculate average order value
    const totalRevenue = filteredOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, order) => sum + parseFloat(order.total || '0'), 0);
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Orders by day
    const dailyData: Record<string, number> = {};
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.date_created);
      const dateKey = orderDate.toISOString().split('T')[0] ?? '';
      if (dateKey && !dailyData[dateKey]) {
        dailyData[dateKey] = 0;
      }
      if (dateKey && dailyData[dateKey] !== undefined) {
        dailyData[dateKey]++;
      }
    });

    const sortedDates = Object.keys(dailyData).sort();
    const ordersByDay: DailyOrderData[] = sortedDates.map(date => ({
      date,
      count: dailyData[date] ?? 0,
    }));

    // Orders by status
    const ordersByStatus: Record<string, number> = {
      'Completed': completedOrders,
      'Processing': processingOrders,
      'Pending': pendingOrders,
      'Cancelled': cancelledOrders,
      'Refunded': refundedOrders,
      'Failed': failedOrders,
    };

    // Orders by payment method
    const paymentMethodMap: Record<string, number> = {};
    filteredOrders.forEach(order => {
      const method = order.payment_method_title || 'Unknown';
      if (!paymentMethodMap[method]) {
        paymentMethodMap[method] = 0;
      }
      paymentMethodMap[method]++;
    });

    // Calculate average processing time (for completed orders)
    const processingTimes: number[] = [];
    filteredOrders
      .filter(o => o.status === 'completed' && o.date_completed)
      .forEach(order => {
        const created = new Date(order.date_created);
        const completed = new Date(order.date_completed!);
        const diffHours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
        processingTimes.push(diffHours);
      });

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // Calculate additional revenue metrics
    const pendingOrdersList = filteredOrders.filter(o => o.status === 'pending' || o.status === 'processing');
    const pendingValue = pendingOrdersList.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);

    // Today's stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayOrdersList = filteredOrders.filter(o => new Date(o.date_created) >= todayStart);
    const todayOrders = todayOrdersList.length;
    const todayRevenue = todayOrdersList
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);

    // This week's stats
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const thisWeekOrdersList = filteredOrders.filter(o => new Date(o.date_created) >= weekStart);
    const thisWeekOrders = thisWeekOrdersList.length;
    const thisWeekRevenue = thisWeekOrdersList
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);

    setOrderData({
      totalOrders,
      completedOrders,
      processingOrders,
      pendingOrders,
      cancelledOrders,
      refundedOrders,
      failedOrders,
      completionRate,
      averageOrderValue,
      totalRevenue,
      todayOrders,
      todayRevenue,
      thisWeekOrders,
      thisWeekRevenue,
      pendingValue,
      ordersByDay,
      ordersByStatus,
      ordersByPaymentMethod: paymentMethodMap,
      averageProcessingTime,
    });
  }, []);

  const loadOrderAnalytics = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const orders = await getCachedData('orders') as Order[] | null;
      if (orders) {
        calculateOrderMetrics(orders, selectedTimeRange);
      }
    } catch {
      // Error loading order analytics - silently handle
    } finally {
      setLoading(false);
    }
  }, [getCachedData, calculateOrderMetrics, selectedTimeRange]);

  useEffect(() => {
    void Promise.resolve().then(loadOrderAnalytics);
  }, [loadOrderAnalytics]);

  const formatCurrency = (amount: number): string => {
    return formatCurrencyUtil(amount, currencyCode);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatProcessingTime = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)} hours`;
    } else {
      return `${(hours / 24).toFixed(1)} days`;
    }
  };

  const handleTimeRangeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTimeRange(parseInt(e.target.value));
  };

  // Chart data
  const ordersTrendData = {
    labels: orderData.ordersByDay.map(d => formatDate(d.date)),
    datasets: [
      {
        label: 'Orders',
        data: orderData.ordersByDay.map(d => d.count),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const statusDistributionData = {
    labels: Object.keys(orderData.ordersByStatus),
    datasets: [
      {
        data: Object.values(orderData.ordersByStatus),
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(251, 191, 36, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(168, 85, 247, 0.7)',
          'rgba(107, 114, 128, 0.7)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(251, 191, 36)',
          'rgb(239, 68, 68)',
          'rgb(168, 85, 247)',
          'rgb(107, 114, 128)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const paymentMethodData = {
    labels: Object.keys(orderData.ordersByPaymentMethod),
    datasets: [
      {
        label: 'Orders',
        data: Object.values(orderData.ordersByPaymentMethod),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgb(34, 197, 94)',
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
  }) satisfies ChartOptions<'line'>, [theme]);

  const timeRangeLabel = TIME_RANGES.find(r => r.value === selectedTimeRange)?.label || '';

  const orderStatusData = Object.entries(orderData.ordersByStatus).map(([status, count]) => ({
    status,
    count: String(count),
  })) as Record<string, unknown>[];

  const { handleExportCSV, handleExportPDF, handlePrint } = useReportExport({
    reportName: 'Order Analytics',
    filenamePrefix: 'order-analytics',
    timeRange: timeRangeLabel,
    summaryMetrics: [
      { label: 'Total Orders', value: String(orderData.totalOrders) },
      { label: 'Completed', value: String(orderData.completedOrders) },
      { label: 'Processing', value: String(orderData.processingOrders) },
      { label: 'Pending', value: String(orderData.pendingOrders) },
      { label: 'Cancelled', value: String(orderData.cancelledOrders) },
      { label: 'Completion Rate', value: `${orderData.completionRate.toFixed(1)}%` },
    ],
    columns: [
      { key: 'status', label: 'Status' },
      { key: 'count', label: 'Count' },
    ],
    data: orderStatusData,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading order analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Comprehensive analysis of your order patterns and status
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
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Orders</div>
            <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {orderData.totalOrders}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            In selected period
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</div>
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
            {orderData.completedOrders}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {orderData.completionRate.toFixed(1)}% completion rate
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Processing</div>
            <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
            {orderData.processingOrders}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Active orders
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending</div>
            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {orderData.pendingOrders}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Awaiting action
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Order Value</div>
            <ShoppingCart className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(orderData.averageOrderValue)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Processing Time</div>
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {formatProcessingTime(orderData.averageProcessingTime)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Issues</div>
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {orderData.cancelledOrders + orderData.refundedOrders + orderData.failedOrders}
          </div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Cancelled: {orderData.cancelledOrders} | Refunded: {orderData.refundedOrders} | Failed: {orderData.failedOrders}
          </div>
        </div>
      </div>

      {/* Revenue & Activity Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</div>
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(orderData.totalRevenue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            From completed orders
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Value</div>
            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {formatCurrency(orderData.pendingValue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Pending & processing orders
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">This Week Revenue</div>
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(orderData.thisWeekRevenue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {orderData.thisWeekOrders} orders this week
          </div>
        </div>
      </div>

      {/* Today's Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Orders Today</div>
            <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
            {orderData.todayOrders}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Orders placed today
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Revenue Today</div>
            <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(orderData.todayRevenue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            From completed orders today
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        {/* Orders Trend */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Order Trend ({TIME_RANGES.find(r => r.value === selectedTimeRange)?.label})
          </h2>
          <Line data={ordersTrendData} options={chartOptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Order Status Distribution
          </h2>
          <div className="flex justify-center">
            <div className="w-80 h-80">
              <Doughnut data={statusDistributionData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Orders by Payment Method
          </h2>
          {Object.keys(orderData.ordersByPaymentMethod).length > 0 ? (
            <Bar data={paymentMethodData} options={chartOptions} />
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No payment method data available
            </div>
          )}
        </div>
      </div>

      {/* Status Breakdown Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Detailed Status Breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{orderData.completedOrders}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{orderData.processingOrders}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Processing</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded">
            <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{orderData.pendingOrders}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900/30 rounded">
            <XCircle className="w-8 h-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{orderData.cancelledOrders}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Cancelled</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/30 rounded">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{orderData.refundedOrders}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Refunded</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{orderData.failedOrders}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderAnalyticsPage;
