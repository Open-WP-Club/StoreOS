import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  RefreshCw,
  Clock,
  BarChart3,
  AlertTriangle,
  Repeat,
} from 'lucide-react';
import { useKPIs } from '../hooks/useKPIs';
import { formatCurrency } from '../utils/currency';
import KPICard from '../components/KPICard';
import ExportMenu from '../components/ExportMenu';
import { useReportExport } from '../hooks/useReportExport';
import type { KPIPeriod } from '../hooks/useKPIs';
import { useTheme } from '../stores';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const PERIODS: { value: KPIPeriod; label: string }[] = [
  { value: 7, label: '7 Days' },
  { value: 30, label: '30 Days' },
  { value: 90, label: '90 Days' },
  { value: 365, label: '1 Year' },
];

function KPIDashboardPage(): React.ReactElement {
  const { kpis, period, setPeriod, currencyCode, hasData } = useKPIs();
  const theme = useTheme((state) => state.theme);

  const periodLabel = PERIODS.find(p => p.value === period)?.label || '';

  // Build KPI table data for export (only when kpis available)
  const kpiTableData = kpis ? [
    { category: 'Revenue', metric: 'Total Revenue', value: formatCurrency(kpis.revenue.totalRevenue.current, currencyCode) },
    { category: 'Revenue', metric: 'Avg Order Value', value: formatCurrency(kpis.revenue.averageOrderValue.current, currencyCode) },
    { category: 'Revenue', metric: 'Revenue Growth', value: `${kpis.revenue.revenueGrowthRate.toFixed(1)}%` },
    { category: 'Customers', metric: 'Repeat Purchase Rate', value: `${kpis.customer.repeatPurchaseRate.current.toFixed(1)}%` },
    { category: 'Customers', metric: 'Avg Basket Size', value: `${kpis.customer.avgItemsPerOrder.current.toFixed(1)} items` },
    { category: 'Customers', metric: 'Customer Lifetime Value', value: formatCurrency(kpis.customer.customerLifetimeValue.current, currencyCode) },
    { category: 'Operations', metric: 'Refund Rate', value: `${kpis.operations.refundRate.current.toFixed(1)}%` },
    { category: 'Operations', metric: 'Completion Rate', value: `${kpis.operations.orderCompletionRate.current.toFixed(1)}%` },
    { category: 'Operations', metric: 'Avg Processing Time', value: `${kpis.operations.avgProcessingTimeDays.current.toFixed(1)} days` },
    { category: 'Inventory', metric: 'Stock Turnover', value: kpis.inventory.stockTurnoverRate.current.toFixed(1) },
    { category: 'Inventory', metric: 'Inventory Value', value: formatCurrency(kpis.inventory.inventoryValue.current, currencyCode) },
    { category: 'Inventory', metric: 'Low Stock Items', value: String(Math.round(kpis.inventory.lowStockCount.current)) },
  ] as Record<string, unknown>[] : [];

  const { handleExportCSV, handleExportPDF, handlePrint } = useReportExport({
    reportName: 'KPI Dashboard',
    filenamePrefix: 'kpi-dashboard',
    timeRange: periodLabel,
    summaryMetrics: kpis ? [
      { label: 'Total Revenue', value: formatCurrency(kpis.revenue.totalRevenue.current, currencyCode) },
      { label: 'Avg Order Value', value: formatCurrency(kpis.revenue.averageOrderValue.current, currencyCode) },
      { label: 'Repeat Purchase Rate', value: `${kpis.customer.repeatPurchaseRate.current.toFixed(1)}%` },
      { label: 'Refund Rate', value: `${kpis.operations.refundRate.current.toFixed(1)}%` },
    ] : [],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ],
    data: kpiTableData,
  });

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Data Available</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          KPIs will appear here once orders and products are cached. Navigate to Orders or Products to load data.
        </p>
      </div>
    );
  }

  if (!kpis) return <div />;

  const fmt = (v: number): string => formatCurrency(v, currencyCode);
  const pct = (v: number): string => `${v.toFixed(1)}%`;
  const num = (v: number): string => v.toFixed(1);

  // Pareto chart data
  const isDark = theme === 'dark';
  const paretoData = {
    labels: kpis.concentration.paretoProducts.map((p) => p.name),
    datasets: [
      {
        label: 'Revenue',
        data: kpis.concentration.paretoProducts.map((p) => p.revenue),
        backgroundColor: isDark ? 'rgba(96, 165, 250, 0.7)' : 'rgba(59, 130, 246, 0.7)',
        borderColor: isDark ? 'rgb(96, 165, 250)' : 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const paretoOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const product = kpis.concentration.paretoProducts[context.dataIndex];
            return `${fmt(context.parsed.y ?? 0)} (${product?.percentage.toFixed(1)}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: isDark ? '#9ca3af' : '#6b7280',
          maxRotation: 45,
          minRotation: 45,
          font: { size: 11 },
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: isDark ? '#9ca3af' : '#6b7280',
          callback: (value) => fmt(Number(value)),
        },
        grid: { color: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)' },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">KPI Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Key performance indicators from cached data
          </p>
        </div>

        {/* Period Selector + Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  period === p.value
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <ExportMenu
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            onPrint={handlePrint}
            disabled={!hasData}
          />
        </div>
      </div>

      {/* Revenue KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Revenue
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            label="Total Revenue"
            value={fmt(kpis.revenue.totalRevenue.current)}
            changePercent={kpis.revenue.totalRevenue.changePercent}
            direction={kpis.revenue.totalRevenue.direction}
            icon={DollarSign}
          />
          <KPICard
            label="Average Order Value"
            value={fmt(kpis.revenue.averageOrderValue.current)}
            changePercent={kpis.revenue.averageOrderValue.changePercent}
            direction={kpis.revenue.averageOrderValue.direction}
            icon={ShoppingCart}
          />
          <KPICard
            label="Revenue Growth"
            value={pct(kpis.revenue.revenueGrowthRate)}
            changePercent={kpis.revenue.totalRevenue.changePercent}
            direction={kpis.revenue.totalRevenue.direction}
            icon={TrendingUp}
          />
        </div>
      </section>

      {/* Customer KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Customers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            label="Repeat Purchase Rate"
            value={pct(kpis.customer.repeatPurchaseRate.current)}
            changePercent={kpis.customer.repeatPurchaseRate.changePercent}
            direction={kpis.customer.repeatPurchaseRate.direction}
            icon={Repeat}
          />
          <KPICard
            label="Avg Basket Size"
            value={`${num(kpis.customer.avgItemsPerOrder.current)} items`}
            changePercent={kpis.customer.avgItemsPerOrder.changePercent}
            direction={kpis.customer.avgItemsPerOrder.direction}
            icon={ShoppingCart}
          />
          <KPICard
            label="Customer Lifetime Value"
            value={fmt(kpis.customer.customerLifetimeValue.current)}
            changePercent={kpis.customer.customerLifetimeValue.changePercent}
            direction={kpis.customer.customerLifetimeValue.direction}
            icon={Users}
          />
        </div>
      </section>

      {/* Operations KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Operations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            label="Refund Rate"
            value={pct(kpis.operations.refundRate.current)}
            changePercent={kpis.operations.refundRate.changePercent}
            direction={kpis.operations.refundRate.direction}
            icon={RefreshCw}
            invertColors
          />
          <KPICard
            label="Completion Rate"
            value={pct(kpis.operations.orderCompletionRate.current)}
            changePercent={kpis.operations.orderCompletionRate.changePercent}
            direction={kpis.operations.orderCompletionRate.direction}
            icon={TrendingUp}
          />
          <KPICard
            label="Avg Processing Time"
            value={`${num(kpis.operations.avgProcessingTimeDays.current)} days`}
            changePercent={kpis.operations.avgProcessingTimeDays.changePercent}
            direction={kpis.operations.avgProcessingTimeDays.direction}
            icon={Clock}
            invertColors
          />
        </div>
      </section>

      {/* Inventory KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Inventory
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            label="Stock Turnover Rate"
            value={num(kpis.inventory.stockTurnoverRate.current)}
            changePercent={kpis.inventory.stockTurnoverRate.changePercent}
            direction={kpis.inventory.stockTurnoverRate.direction}
            icon={Package}
          />
          <KPICard
            label="Inventory Value"
            value={fmt(kpis.inventory.inventoryValue.current)}
            changePercent={kpis.inventory.inventoryValue.changePercent}
            direction={kpis.inventory.inventoryValue.direction}
            icon={DollarSign}
          />
          <KPICard
            label="Low Stock Items"
            value={String(Math.round(kpis.inventory.lowStockCount.current))}
            changePercent={kpis.inventory.lowStockCount.changePercent}
            direction={kpis.inventory.lowStockCount.direction}
            icon={AlertTriangle}
            invertColors
          />
        </div>
      </section>

      {/* Revenue Concentration (Pareto) */}
      {kpis.concentration.paretoProducts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Revenue Concentration
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Top Products by Revenue
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Top 20% of products account for{' '}
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {kpis.concentration.top20RevenueShare}%
                  </span>{' '}
                  of total revenue
                </p>
              </div>
              <BarChart3 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
            <div className="h-64">
              <Bar data={paretoData} options={paretoOptions} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default KPIDashboardPage;
