import React, { useState, useCallback, useMemo, ChangeEvent } from 'react';
import { useCache, useTheme, useSettings } from '../stores';
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
import { Calendar, Package, DollarSign, AlertTriangle, Box, Tag, ImageOff, FileText, Hash } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import { useReportExport } from '../hooks/useReportExport';
import type { Order, Product, OrderLineItem } from '../types';

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

interface ProductPerformance {
  id: number;
  name: string;
  revenue: number;
  quantity: number;
  orders: number;
}

interface CategoryPerformance {
  count: number;
  revenue: number;
}

interface ProductData {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  inventoryValue: number;
  avgPrice: number;
  onSale: number;
  noImages: number;
  draft: number;
  missingSku: number;
  topProducts: ProductPerformance[];
  worstPerformers: ProductPerformance[];
  categoryPerformance: Record<string, CategoryPerformance>;
  stockDistribution: Record<string, number>;
}

const TIME_RANGES: TimeRange[] = [
  { value: 7, label: '7 Days', days: 7 },
  { value: 14, label: '14 Days', days: 14 },
  { value: 30, label: '1 Month', days: 30 },
  { value: 90, label: '3 Months', days: 90 },
  { value: 180, label: '6 Months', days: 180 },
  { value: 365, label: '12 Months', days: 365 },
];

const ProductAnalyticsPage: React.FC = (): React.ReactElement => {
  const getCachedData = useCache((state) => state.getCachedData);
  const theme = useTheme((state) => state.theme);
  const lowStockThreshold = useSettings((state) => state.lowStockThreshold);

  const [loading, setLoading] = useState<boolean>(true);
  const [currencyCode, setCurrencyCode] = useState<string>('USD');
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(30);
  const [productData, setProductData] = useState<ProductData>({
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    inventoryValue: 0,
    avgPrice: 0,
    onSale: 0,
    noImages: 0,
    draft: 0,
    missingSku: 0,
    topProducts: [],
    worstPerformers: [],
    categoryPerformance: {},
    stockDistribution: {},
  });

  const calculateProductMetrics = useCallback((orders: Order[] | null, products: Product[], timeRangeDays: number): void => {
    if (!products) return;

    const detectedCurrency = orders ? getCurrencyCode(orders) : 'USD';
    setCurrencyCode(detectedCurrency);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - timeRangeDays);

    const filteredOrders = orders ? orders.filter(o => new Date(o.date_created) >= dateThreshold) : [];

    // Calculate stock metrics
    const inStock = products.filter(p => p.stock_status === 'instock').length;
    const lowStock = products.filter(
      p => p.stock_quantity !== null && p.stock_quantity !== undefined && p.stock_quantity <= lowStockThreshold && p.stock_quantity > 0
    ).length;
    const outOfStock = products.filter(p => p.stock_status === 'outofstock').length;
    const inventoryValue = products.reduce((sum, p) => {
      const price = parseFloat(p.price || '0');
      const quantity = parseInt(String(p.stock_quantity || 0));
      return sum + (price * quantity);
    }, 0);

    // Calculate additional metrics
    const pricesArray = products.map(p => parseFloat(p.price || '0')).filter(p => p > 0);
    const avgPrice = pricesArray.length > 0 ? pricesArray.reduce((a, b) => a + b, 0) / pricesArray.length : 0;
    const onSale = products.filter(p => p.sale_price && parseFloat(p.sale_price) > 0).length;
    const noImages = products.filter(p => !p.images || p.images.length === 0).length;
    const draft = products.filter(p => p.status === 'draft' || p.status === 'pending').length;
    const missingSku = products.filter(p => !p.sku || p.sku.trim() === '').length;

    // Calculate product performance from orders
    const productPerformance: Record<number, ProductPerformance> = {};
    filteredOrders.forEach(order => {
      if (order.line_items && Array.isArray(order.line_items)) {
        order.line_items.forEach((item: OrderLineItem) => {
          const productId = item.product_id;
          if (!productPerformance[productId]) {
            productPerformance[productId] = {
              id: productId,
              name: item.name,
              revenue: 0,
              quantity: 0,
              orders: 0,
            };
          }
          if (order.status === 'completed') {
            productPerformance[productId].revenue += parseFloat(item.total || '0');
            productPerformance[productId].quantity += parseInt(String(item.quantity || 0));
            productPerformance[productId].orders += 1;
          }
        });
      }
    });

    const performanceArray = Object.values(productPerformance);

    // Top products by revenue
    const topProducts = [...performanceArray]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Worst performers (products with low sales)
    const worstPerformers = [...performanceArray]
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, 10);

    // Category performance
    const categoryMap: Record<string, CategoryPerformance> = {};
    products.forEach(product => {
      const categories = product.categories || [];
      categories.forEach((cat: { name?: string }) => {
        const catName = cat.name || 'Uncategorized';
        if (!categoryMap[catName]) {
          categoryMap[catName] = {
            count: 0,
            revenue: 0,
          };
        }
        categoryMap[catName].count++;

        // Add revenue from performance data
        const perf = productPerformance[product.id];
        if (perf) {
          categoryMap[catName].revenue += perf.revenue;
        }
      });
    });

    // Stock distribution
    const stockDistribution: Record<string, number> = {
      'In Stock': inStock,
      'Low Stock': lowStock,
      'Out of Stock': outOfStock,
    };

    setProductData({
      totalProducts: products.length,
      inStock,
      lowStock,
      outOfStock,
      inventoryValue,
      avgPrice,
      onSale,
      noImages,
      draft,
      missingSku,
      topProducts,
      worstPerformers,
      categoryPerformance: categoryMap,
      stockDistribution,
    });
  }, [lowStockThreshold]);

  const loadProductAnalytics = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const products = await getCachedData('products') as Product[] | null;
      const orders = await getCachedData('orders') as Order[] | null;
      if (products) {
        calculateProductMetrics(orders, products, selectedTimeRange);
      }
    } catch {
      // Error loading product analytics - silently handled
    } finally {
      setLoading(false);
    }
  }, [getCachedData, calculateProductMetrics, selectedTimeRange]);

  const [prevLoadProductAnalytics, setPrevLoadProductAnalytics] = useState<
    typeof loadProductAnalytics | null
  >(null);
  if (prevLoadProductAnalytics !== loadProductAnalytics) {
    setPrevLoadProductAnalytics(() => loadProductAnalytics);
    loadProductAnalytics();
  }

  const formatCurrency = (amount: number): string => {
    return formatCurrencyUtil(amount, currencyCode);
  };

  const handleTimeRangeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTimeRange(parseInt(e.target.value));
  };

  // Chart data
  const stockDistributionData = {
    labels: Object.keys(productData.stockDistribution),
    datasets: [
      {
        data: Object.values(productData.stockDistribution),
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)',
          'rgba(251, 191, 36, 0.7)',
          'rgba(239, 68, 68, 0.7)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(251, 191, 36)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const categoryRevenueData = {
    labels: Object.keys(productData.categoryPerformance).slice(0, 10),
    datasets: [
      {
        label: 'Revenue',
        data: Object.values(productData.categoryPerformance).slice(0, 10).map(c => c.revenue),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgb(59, 130, 246)',
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
    reportName: 'Product Analytics',
    filenamePrefix: 'product-analytics',
    timeRange: timeRangeLabel,
    summaryMetrics: [
      { label: 'Total Products', value: String(productData.totalProducts) },
      { label: 'In Stock', value: String(productData.inStock) },
      { label: 'Low Stock', value: String(productData.lowStock) },
      { label: 'Out of Stock', value: String(productData.outOfStock) },
      { label: 'Inventory Value', value: formatCurrency(productData.inventoryValue) },
      { label: 'Avg Price', value: formatCurrency(productData.avgPrice) },
    ],
    columns: [
      { key: 'name', label: 'Product' },
      { key: 'quantity', label: 'Units Sold', format: (v) => String(v ?? 0) },
      { key: 'orders', label: 'Orders', format: (v) => String(v ?? 0) },
      { key: 'revenue', label: 'Revenue', format: (v) => formatCurrency(Number(v) || 0) },
    ],
    data: productData.topProducts as (typeof productData.topProducts[number] & Record<string, unknown>)[],
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading product analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Performance insights for your product catalog
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Products</div>
            <Box className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {productData.totalProducts}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">In Stock</div>
            <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
            {productData.inStock}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Low Stock</div>
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {productData.lowStock}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Out of Stock</div>
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
            {productData.outOfStock}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Inventory Value</div>
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(productData.inventoryValue)}
          </div>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Price</div>
            <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(productData.avgPrice)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">On Sale</div>
            <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-purple-600 dark:text-purple-400">
            {productData.onSale}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">No Images</div>
            <ImageOff className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-orange-600 dark:text-orange-400">
            {productData.noImages}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Draft/Pending</div>
            <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-gray-600 dark:text-gray-400">
            {productData.draft}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Missing SKU</div>
            <Hash className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-red-600 dark:text-red-400">
            {productData.missingSku}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stock Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Stock Status Distribution
          </h2>
          <div className="flex justify-center">
            <div className="w-80 h-80">
              <Doughnut data={stockDistributionData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Category Performance */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top 10 Categories by Revenue
          </h2>
          {Object.keys(productData.categoryPerformance).length > 0 ? (
            <Bar data={categoryRevenueData} options={chartOptions} />
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No category data available
            </div>
          )}
        </div>
      </div>

      {/* Top Performing Products */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top 10 Products by Revenue
        </h2>
        {productData.topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Units Sold
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Orders
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {productData.topProducts.map((product, index) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {product.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {product.orders}
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
            No product sales data available for selected period
          </div>
        )}
      </div>

      {/* Worst Performing Products */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Products Needing Attention (Lowest Revenue)
        </h2>
        {productData.worstPerformers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Units Sold
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Orders
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {productData.worstPerformers.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {product.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {product.orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                      {formatCurrency(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No product sales data available for selected period
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductAnalyticsPage;
