import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { useCache, useTheme } from '../stores';
import { formatCurrency as formatCurrencyUtil, getCurrencyCode } from '../utils/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Calendar, DollarSign, TrendingUp, PieChart, CreditCard, ArrowUp, ArrowDown } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import { useReportExport } from '../hooks/useReportExport';
import type { Order } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
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

interface DailyRevenueData {
  date: string;
  revenue: number;
}

interface MonthlyRevenueData {
  month: string;
  revenue: number;
}

interface FinancialData {
  totalRevenue: number;
  netRevenue: number;
  refunds: number;
  shipping: number;
  taxes: number;
  discounts: number;
  revenueByDay: DailyRevenueData[];
  revenueByMonth: MonthlyRevenueData[];
  revenueByPaymentMethod: Record<string, number>;
  profitMargin: number;
  averageTransactionValue: number;
  growthRate: number;
  revenueBreakdown: Record<string, number>;
}

const TIME_RANGES: TimeRange[] = [
  { value: 7, label: '7 Days', days: 7 },
  { value: 14, label: '14 Days', days: 14 },
  { value: 30, label: '1 Month', days: 30 },
  { value: 90, label: '3 Months', days: 90 },
  { value: 180, label: '6 Months', days: 180 },
  { value: 365, label: '12 Months', days: 365 },
];

const FinancialAnalyticsPage: React.FC = (): React.ReactElement => {
  const getCachedData = useCache((state) => state.getCachedData);
  const theme = useTheme((state) => state.theme);

  const [loading, setLoading] = useState<boolean>(true);
  const [currencyCode, setCurrencyCode] = useState<string>('USD');
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(30);
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalRevenue: 0,
    netRevenue: 0,
    refunds: 0,
    shipping: 0,
    taxes: 0,
    discounts: 0,
    revenueByDay: [],
    revenueByMonth: [],
    revenueByPaymentMethod: {},
    profitMargin: 0,
    averageTransactionValue: 0,
    growthRate: 0,
    revenueBreakdown: {},
  });

  const calculateFinancialMetrics = useCallback((orders: Order[], timeRangeDays: number): void => {
    if (!orders) return;

    const detectedCurrency = getCurrencyCode(orders);
    setCurrencyCode(detectedCurrency);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - timeRangeDays);

    const filteredOrders = orders.filter(o => new Date(o.date_created) >= dateThreshold);

    // Calculate previous period for growth comparison
    const previousPeriodThreshold = new Date();
    previousPeriodThreshold.setDate(previousPeriodThreshold.getDate() - (timeRangeDays * 2));
    const previousPeriodOrders = orders.filter(o => {
      const orderDate = new Date(o.date_created);
      return orderDate >= previousPeriodThreshold && orderDate < dateThreshold;
    });

    // Calculate total revenue from completed orders
    const completedOrders = filteredOrders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, order) => sum + parseFloat(order.total || '0'), 0);

    // Calculate refunds
    const refundedOrders = filteredOrders.filter(o => o.status === 'refunded');
    const refunds = refundedOrders.reduce((sum, order) => sum + parseFloat(order.total || '0'), 0);

    // Calculate shipping, taxes, and discounts
    let shipping = 0;
    let taxes = 0;
    let discounts = 0;

    completedOrders.forEach(order => {
      shipping += parseFloat(order.shipping_total || '0');
      taxes += parseFloat(order.total_tax || '0');
      discounts += parseFloat(order.discount_total || '0');
    });

    // Net revenue (total revenue - refunds)
    const netRevenue = totalRevenue - refunds;

    // Calculate growth rate
    const previousRevenue = previousPeriodOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, order) => sum + parseFloat(order.total || '0'), 0);
    const growthRate = previousRevenue > 0
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    // Revenue by day
    const dailyData: Record<string, number> = {};
    completedOrders.forEach(order => {
      const orderDate = new Date(order.date_created);
      const dateKey = orderDate.toISOString().split('T')[0] ?? '';
      if (dateKey && !dailyData[dateKey]) {
        dailyData[dateKey] = 0;
      }
      if (dateKey && dailyData[dateKey] !== undefined) {
        dailyData[dateKey] += parseFloat(order.total || '0');
      }
    });

    const sortedDates = Object.keys(dailyData).sort();
    const revenueByDay: DailyRevenueData[] = sortedDates.map(date => ({
      date,
      revenue: dailyData[date] ?? 0,
    }));

    // Revenue by month
    const monthlyData: Record<string, number> = {};
    completedOrders.forEach(order => {
      const orderDate = new Date(order.date_created);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += parseFloat(order.total || '0');
    });

    const revenueByMonth: MonthlyRevenueData[] = Object.keys(monthlyData)
      .sort()
      .map(month => ({
        month,
        revenue: monthlyData[month] ?? 0,
      }));

    // Revenue by payment method
    const paymentMethodMap: Record<string, number> = {};
    completedOrders.forEach(order => {
      const method = order.payment_method_title || 'Unknown';
      if (!paymentMethodMap[method]) {
        paymentMethodMap[method] = 0;
      }
      paymentMethodMap[method] += parseFloat(order.total || '0');
    });

    // Calculate average transaction value
    const averageTransactionValue = completedOrders.length > 0
      ? totalRevenue / completedOrders.length
      : 0;

    // Revenue breakdown
    const productRevenue = totalRevenue - shipping - taxes;
    const revenueBreakdown: Record<string, number> = {
      'Product Sales': productRevenue,
      'Shipping': shipping,
      'Taxes': taxes,
    };

    // Simple profit margin estimate (product revenue - discounts) / total revenue
    const profitMargin = totalRevenue > 0
      ? ((productRevenue - discounts) / totalRevenue) * 100
      : 0;

    setFinancialData({
      totalRevenue,
      netRevenue,
      refunds,
      shipping,
      taxes,
      discounts,
      revenueByDay,
      revenueByMonth,
      revenueByPaymentMethod: paymentMethodMap,
      profitMargin,
      averageTransactionValue,
      growthRate,
      revenueBreakdown,
    });
  }, []);

  const loadFinancialAnalytics = useCallback(async (): Promise<void> => {
    try {
      const orders = await getCachedData('orders') as Order[] | null;
      if (orders) {
        calculateFinancialMetrics(orders, selectedTimeRange);
      }
    } catch {
      // Error loading financial analytics - silently handle
    } finally {
      setLoading(false);
    }
  }, [getCachedData, calculateFinancialMetrics, selectedTimeRange]);

  useEffect(() => {
    void Promise.resolve().then(() => loadFinancialAnalytics());
  }, [loadFinancialAnalytics]);

  const formatCurrency = (amount: number): string => {
    return formatCurrencyUtil(amount, currencyCode);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMonth = (monthString: string): string => {
    const parts = monthString.split('-');
    const year = parts[0] ?? '2024';
    const month = parts[1] ?? '01';
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const handleTimeRangeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTimeRange(parseInt(e.target.value));
  };

  // Chart data
  const revenueTrendData = {
    labels: selectedTimeRange <= 30
      ? financialData.revenueByDay.map(d => formatDate(d.date))
      : financialData.revenueByMonth.map(d => formatMonth(d.month)),
    datasets: [
      {
        label: 'Revenue',
        data: selectedTimeRange <= 30
          ? financialData.revenueByDay.map(d => d.revenue)
          : financialData.revenueByMonth.map(d => d.revenue),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const paymentMethodData = {
    labels: Object.keys(financialData.revenueByPaymentMethod),
    datasets: [
      {
        label: 'Revenue',
        data: Object.values(financialData.revenueByPaymentMethod),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const revenueBreakdownData = {
    labels: Object.keys(financialData.revenueBreakdown),
    datasets: [
      {
        data: Object.values(financialData.revenueBreakdown),
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(251, 191, 36, 0.7)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(251, 191, 36)',
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
  }) satisfies ChartOptions<'line'>, [theme]);

  const timeRangeLabel = TIME_RANGES.find(r => r.value === selectedTimeRange)?.label || '';

  const financialSummaryData = [
    { metric: 'Gross Revenue', amount: formatCurrency(financialData.totalRevenue) },
    { metric: 'Net Revenue', amount: formatCurrency(financialData.netRevenue) },
    { metric: 'Shipping', amount: formatCurrency(financialData.shipping) },
    { metric: 'Taxes', amount: formatCurrency(financialData.taxes) },
    { metric: 'Discounts', amount: formatCurrency(financialData.discounts) },
    { metric: 'Refunds', amount: formatCurrency(financialData.refunds) },
  ] as (Record<string, unknown>)[];

  const { handleExportCSV, handleExportPDF, handlePrint } = useReportExport({
    reportName: 'Financial Analytics',
    filenamePrefix: 'financial-analytics',
    timeRange: timeRangeLabel,
    summaryMetrics: [
      { label: 'Total Revenue', value: formatCurrency(financialData.totalRevenue) },
      { label: 'Net Revenue', value: formatCurrency(financialData.netRevenue) },
      { label: 'Shipping', value: formatCurrency(financialData.shipping) },
      { label: 'Taxes', value: formatCurrency(financialData.taxes) },
      { label: 'Refunds', value: formatCurrency(financialData.refunds) },
      { label: 'Profit Margin', value: `${financialData.profitMargin.toFixed(1)}%` },
    ],
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'amount', label: 'Amount' },
    ],
    data: financialSummaryData,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading financial analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Comprehensive financial performance and revenue insights
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
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</div>
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(financialData.totalRevenue)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {financialData.growthRate >= 0 ? (
              <ArrowUp className="w-4 h-4 text-green-600" />
            ) : (
              <ArrowDown className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-sm font-medium ${financialData.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(financialData.growthRate).toFixed(1)}%
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">vs previous period</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Revenue</div>
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(financialData.netRevenue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            After refunds
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Transaction</div>
            <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(financialData.averageTransactionValue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Per completed order
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Profit Margin</div>
            <PieChart className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {financialData.profitMargin.toFixed(1)}%
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Estimated margin
          </div>
        </div>
      </div>

      {/* Financial Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Shipping Revenue</div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(financialData.shipping)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Tax Collected</div>
          <div className="mt-2 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {formatCurrency(financialData.taxes)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Discounts Given</div>
          <div className="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency(financialData.discounts)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Refunds</div>
          <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(financialData.refunds)}
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Revenue Trend ({TIME_RANGES.find(r => r.value === selectedTimeRange)?.label})
        </h2>
        <Line data={revenueTrendData} options={chartOptions} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue by Payment Method */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue by Payment Method
          </h2>
          {Object.keys(financialData.revenueByPaymentMethod).length > 0 ? (
            <Bar data={paymentMethodData} options={chartOptions} />
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No payment method data available
            </div>
          )}
        </div>

        {/* Revenue Breakdown */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue Composition
          </h2>
          <div className="flex justify-center">
            <div className="w-80 h-80">
              <Doughnut data={revenueBreakdownData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Financial Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Metric
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  Gross Revenue
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(financialData.totalRevenue)}
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  Refunds
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400">
                  - {formatCurrency(financialData.refunds)}
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 border-t-2 border-gray-300 dark:border-gray-600">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                  Net Revenue
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(financialData.netRevenue)}
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  Shipping Revenue
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-400">
                  {formatCurrency(financialData.shipping)}
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  Tax Collected
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-400">
                  {formatCurrency(financialData.taxes)}
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  Discounts Applied
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-600 dark:text-orange-400">
                  {formatCurrency(financialData.discounts)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancialAnalyticsPage;
