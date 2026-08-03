import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { useCache, useTheme } from '../stores';
import type { WooCommerceOrder } from '../types';
import { formatCurrency as formatCurrencyUtil, getCurrencyCode } from '../utils/currency';
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
  ChartOptions,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Calendar, TrendingUp, DollarSign, ShoppingCart, ArrowUp, ArrowDown, Package, Award } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import { useReportExport } from '../hooks/useReportExport';
import TopSellingDays from '../components/TopSellingDays';
import OrderFunnel from '../components/OrderFunnel';
import type { Order, Product } from '../types';
import { EMPTY_ARRAY } from '../constants';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
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

interface DailySalesData {
  date: string;
  revenue: number;
  orders: number;
}

interface MonthlySalesData {
  month: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  id: number;
  name: string;
  quantitySold: number;
  revenue: number;
}

interface WeeklyComparison {
  thisWeekRevenue: number;
  thisWeekOrders: number;
  lastWeekRevenue: number;
  lastWeekOrders: number;
  revenueChange: number;
  ordersChange: number;
}

interface SalesData {
  totalSales: number;
  completedSales: number;
  pendingSales: number;
  averageOrderValue: number;
  totalOrders: number;
  completedOrders: number;
  salesByDay: DailySalesData[];
  salesByMonth: MonthlySalesData[];
  growthRate: number;
  topSellingDays: DailySalesData[];
  weeklyComparison: WeeklyComparison;
  topProducts: TopProduct[];
  inventoryValue: number;
}

const TIME_RANGES: TimeRange[] = [
  { value: 7, label: '7 Days', days: 7 },
  { value: 14, label: '14 Days', days: 14 },
  { value: 30, label: '1 Month', days: 30 },
  { value: 90, label: '3 Months', days: 90 },
  { value: 180, label: '6 Months', days: 180 },
  { value: 365, label: '12 Months', days: 365 },
];

const SalesAnalyticsPage: React.FC = (): React.ReactElement => {
  const getCachedData = useCache((state) => state.getCachedData);
  const theme = useTheme((state) => state.theme);
  const rawOrders = useCache(
    (state) => (state.cache.orders?.data as WooCommerceOrder[] | undefined) || EMPTY_ARRAY
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [currencyCode, setCurrencyCode] = useState<string>('USD');
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(30);
  const [salesData, setSalesData] = useState<SalesData>({
    totalSales: 0,
    completedSales: 0,
    pendingSales: 0,
    averageOrderValue: 0,
    totalOrders: 0,
    completedOrders: 0,
    salesByDay: [],
    salesByMonth: [],
    growthRate: 0,
    topSellingDays: [],
    weeklyComparison: {
      thisWeekRevenue: 0,
      thisWeekOrders: 0,
      lastWeekRevenue: 0,
      lastWeekOrders: 0,
      revenueChange: 0,
      ordersChange: 0,
    },
    topProducts: [],
    inventoryValue: 0,
  });

  const calculateSalesMetrics = useCallback((orders: Order[], products: Product[], timeRangeDays: number): void => {
    if (!orders) return;

    const detectedCurrency = getCurrencyCode(orders);
    setCurrencyCode(detectedCurrency);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - timeRangeDays);

    const filteredOrders = orders.filter(o => new Date(o.date_created) >= dateThreshold);

    // Calculate previous period for growth rate
    const previousPeriodThreshold = new Date();
    previousPeriodThreshold.setDate(previousPeriodThreshold.getDate() - (timeRangeDays * 2));
    const previousPeriodOrders = orders.filter(o => {
      const orderDate = new Date(o.date_created);
      return orderDate >= previousPeriodThreshold && orderDate < dateThreshold;
    });

    const completedOrders = filteredOrders.filter(o => o.status === 'completed');
    const totalSales = completedOrders.reduce((sum, order) => sum + parseFloat(order.total || '0'), 0);
    const pendingSales = filteredOrders
      .filter(o => o.status === 'pending' || o.status === 'processing')
      .reduce((sum, order) => sum + parseFloat(order.total || '0'), 0);

    // Calculate growth rate
    const previousSales = previousPeriodOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, order) => sum + parseFloat(order.total || '0'), 0);
    const growthRate = previousSales > 0
      ? ((totalSales - previousSales) / previousSales) * 100
      : 0;

    // Weekly comparison
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekOrders = orders.filter(o => new Date(o.date_created) >= thisWeekStart);
    const lastWeekOrders = orders.filter(o => {
      const orderDate = new Date(o.date_created);
      return orderDate >= lastWeekStart && orderDate < thisWeekStart;
    });

    const thisWeekRevenue = thisWeekOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
    const lastWeekRevenue = lastWeekOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);

    const revenueChange = lastWeekRevenue > 0
      ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
      : thisWeekRevenue > 0 ? 100 : 0;
    const ordersChange = lastWeekOrders.length > 0
      ? ((thisWeekOrders.length - lastWeekOrders.length) / lastWeekOrders.length) * 100
      : thisWeekOrders.length > 0 ? 100 : 0;

    // Top selling products (from completed orders)
    const productSalesMap: Record<number, TopProduct> = {};
    completedOrders.forEach(order => {
      order.line_items?.forEach(item => {
        if (!productSalesMap[item.product_id]) {
          productSalesMap[item.product_id] = {
            id: item.product_id,
            name: item.name,
            quantitySold: 0,
            revenue: 0,
          };
        }
        const product = productSalesMap[item.product_id];
        if (product) {
          product.quantitySold += item.quantity;
          product.revenue += parseFloat(String(item.total)) || 0;
        }
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Inventory value
    const inventoryValue = products?.reduce((sum, product) => {
      const price = parseFloat(product.price || '0');
      const stock = product.stock_quantity || 0;
      return sum + (price * stock);
    }, 0) || 0;

    // Sales by day
    const dailyData: Record<string, { revenue: number; orders: number }> = {};
    filteredOrders.forEach(order => {
      if (order.status === 'completed') {
        const orderDate = new Date(order.date_created);
        const dateKey = orderDate.toISOString().split('T')[0] ?? '';
        const existing = dailyData[dateKey];
        if (!existing) {
          dailyData[dateKey] = { revenue: 0, orders: 0 };
        }
        const entry = dailyData[dateKey]!;
        entry.revenue += parseFloat(order.total || '0');
        entry.orders += 1;
      }
    });

    const sortedDates = Object.keys(dailyData).sort();
    const salesByDay: DailySalesData[] = sortedDates.map(date => {
      const entry = dailyData[date]!;
      return {
        date,
        revenue: entry.revenue,
        orders: entry.orders,
      };
    });

    // Top selling days
    const topSellingDays = [...salesByDay]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Sales by month (for longer time ranges)
    const monthlyData: Record<string, { revenue: number; orders: number }> = {};
    filteredOrders.forEach(order => {
      if (order.status === 'completed') {
        const orderDate = new Date(order.date_created);
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        const existingMonth = monthlyData[monthKey];
        if (!existingMonth) {
          monthlyData[monthKey] = { revenue: 0, orders: 0 };
        }
        const monthEntry = monthlyData[monthKey]!;
        monthEntry.revenue += parseFloat(order.total || '0');
        monthEntry.orders += 1;
      }
    });

    const salesByMonth: MonthlySalesData[] = Object.keys(monthlyData)
      .sort()
      .map(month => {
        const mEntry = monthlyData[month]!;
        return {
          month,
          revenue: mEntry.revenue,
          orders: mEntry.orders,
        };
      });

    setSalesData({
      totalSales,
      completedSales: totalSales,
      pendingSales,
      averageOrderValue: completedOrders.length > 0 ? totalSales / completedOrders.length : 0,
      totalOrders: filteredOrders.length,
      completedOrders: completedOrders.length,
      salesByDay,
      salesByMonth,
      growthRate,
      topSellingDays,
      weeklyComparison: {
        thisWeekRevenue,
        thisWeekOrders: thisWeekOrders.length,
        lastWeekRevenue,
        lastWeekOrders: lastWeekOrders.length,
        revenueChange,
        ordersChange,
      },
      topProducts,
      inventoryValue,
    });
  }, []);

  const loadSalesAnalytics = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [orders, products] = await Promise.all([
        getCachedData('orders') as Promise<Order[] | null>,
        getCachedData('products') as Promise<Product[] | null>,
      ]);
      if (orders) {
        calculateSalesMetrics(orders, products || [], selectedTimeRange);
      }
    } catch {
      // Error loading sales analytics - silently handled
    } finally {
      setLoading(false);
    }
  }, [getCachedData, calculateSalesMetrics, selectedTimeRange]);

  useEffect(() => {
    void Promise.resolve().then(loadSalesAnalytics);
  }, [loadSalesAnalytics]);

  const formatCurrency = (amount: number): string => {
    return formatCurrencyUtil(amount, currencyCode);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMonth = (monthString: string): string => {
    const [year = '0', month = '1'] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const handleTimeRangeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTimeRange(parseInt(e.target.value));
  };

  // Chart data
  const salesTrendData = {
    labels: selectedTimeRange <= 30
      ? salesData.salesByDay.map(d => formatDate(d.date))
      : salesData.salesByMonth.map(d => formatMonth(d.month)),
    datasets: [
      {
        label: 'Revenue',
        data: selectedTimeRange <= 30
          ? salesData.salesByDay.map(d => d.revenue)
          : salesData.salesByMonth.map(d => d.revenue),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const orderVolumeData = {
    labels: selectedTimeRange <= 30
      ? salesData.salesByDay.map(d => formatDate(d.date))
      : salesData.salesByMonth.map(d => formatMonth(d.month)),
    datasets: [
      {
        label: 'Orders',
        data: selectedTimeRange <= 30
          ? salesData.salesByDay.map(d => d.orders)
          : salesData.salesByMonth.map(d => d.orders),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions: ChartOptions<'line' | 'bar'> = useMemo(() => ({
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
  }), [theme]);

  const timeRangeLabel = TIME_RANGES.find(r => r.value === selectedTimeRange)?.label || '';

  const { handleExportCSV, handleExportPDF, handlePrint } = useReportExport({
    reportName: 'Sales Analytics',
    filenamePrefix: 'sales-analytics',
    timeRange: timeRangeLabel,
    summaryMetrics: [
      { label: 'Total Sales', value: formatCurrency(salesData.totalSales) },
      { label: 'Avg Order Value', value: formatCurrency(salesData.averageOrderValue) },
      { label: 'Completed Orders', value: String(salesData.completedOrders) },
      { label: 'Pending Revenue', value: formatCurrency(salesData.pendingSales) },
      { label: 'Growth Rate', value: `${salesData.growthRate.toFixed(1)}%` },
    ],
    columns: [
      { key: 'name', label: 'Product' },
      { key: 'quantitySold', label: 'Qty Sold', format: (v) => String(v ?? 0) },
      { key: 'revenue', label: 'Revenue', format: (v) => formatCurrency(Number(v) || 0) },
    ],
    data: salesData.topProducts as (typeof salesData.topProducts[number] & Record<string, unknown>)[],
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading sales analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Detailed insights into your sales performance
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
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Sales</div>
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(salesData.totalSales)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {salesData.growthRate >= 0 ? (
              <ArrowUp className="w-4 h-4 text-green-600" />
            ) : (
              <ArrowDown className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-sm font-medium ${salesData.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(salesData.growthRate).toFixed(1)}%
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">vs previous period</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Order Value</div>
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(salesData.averageOrderValue)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Per completed order
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed Orders</div>
            <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {salesData.completedOrders}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Out of {salesData.totalOrders} total orders
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Revenue</div>
            <DollarSign className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {formatCurrency(salesData.pendingSales)}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            In processing/pending orders
          </div>
        </div>
      </div>

      {/* Sales Trend Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Sales Trend ({TIME_RANGES.find(r => r.value === selectedTimeRange)?.label})
        </h2>
        <Line data={salesTrendData} options={chartOptions as ChartOptions<'line'>} />
      </div>

      {/* Order Volume Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Order Volume ({TIME_RANGES.find(r => r.value === selectedTimeRange)?.label})
        </h2>
        <Bar data={orderVolumeData} options={chartOptions as ChartOptions<'bar'>} />
      </div>

      {/* Weekly Comparison & Inventory Value */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">This Week Revenue</h3>
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(salesData.weeklyComparison.thisWeekRevenue)}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {salesData.weeklyComparison.revenueChange >= 0 ? (
              <ArrowUp className="w-4 h-4 text-green-600" />
            ) : (
              <ArrowDown className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-sm font-medium ${salesData.weeklyComparison.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(salesData.weeklyComparison.revenueChange).toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">vs last week</span>
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {salesData.weeklyComparison.thisWeekOrders} orders
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Week Revenue</h3>
            <TrendingUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(salesData.weeklyComparison.lastWeekRevenue)}
          </div>
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {salesData.weeklyComparison.lastWeekOrders} orders
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Inventory Value</h3>
            <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(salesData.inventoryValue)}
          </div>
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Total stock value
          </div>
        </div>
      </div>

      {/* Top Selling Products */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          Top Selling Products
        </h2>
        {salesData.topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quantity Sold
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {salesData.topProducts.map((product, index) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                          index === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                          index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' :
                          'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-900 dark:text-white">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {product.quantitySold}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No product sales data available for the selected period
          </div>
        )}
      </div>

      {/* Top Selling Days + Order Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Selling Days
          </h2>
          <TopSellingDays
            topDays={salesData.topSellingDays}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Order Funnel
          </h2>
          <OrderFunnel orders={rawOrders} />
        </div>
      </div>
    </div>
  );
};

export default SalesAnalyticsPage;
