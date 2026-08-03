import { vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KPIDashboardPage from '../KPIDashboardPage';
import { useKPIs } from '../../hooks/useKPIs';
import { useTheme } from '../../stores';

// Mock useKPIs hook
vi.mock('../../hooks/useKPIs', () => ({
  useKPIs: vi.fn(),
}));

// Mock stores
vi.mock('../../stores', () => ({
  useTheme: vi.fn(),
  useStoreConfig: vi.fn(),
}));

vi.mock('../../hooks/useReportExport', () => ({
  useReportExport: () => ({
    handleExportCSV: vi.fn(),
    handleExportPDF: vi.fn(),
    handlePrint: vi.fn(),
  }),
}));

// Mock currency utils
vi.mock('../../utils/currency', () => ({
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
}));

// Mock KPICard component
vi.mock('../../components/KPICard', () => ({
  default: function MockKPICard({ label, value }: { label: string; value: string }) {
    return <div data-testid={`kpi-${label}`}>{label}: {value}</div>;
  },
}));

// Mock chart.js and react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart">Chart</div>,
}));

describe('KPIDashboardPage', () => {
  const mockKPIs = {
    revenue: {
      totalRevenue: { current: 1000, changePercent: 10, direction: 'up' as const },
      averageOrderValue: { current: 50, changePercent: 5, direction: 'up' as const },
      revenueGrowthRate: 15.5,
    },
    customer: {
      repeatPurchaseRate: { current: 30, changePercent: 2, direction: 'up' as const },
      avgItemsPerOrder: { current: 3.5, changePercent: 1, direction: 'stable' as const },
      customerLifetimeValue: { current: 200, changePercent: 8, direction: 'up' as const },
    },
    operations: {
      refundRate: { current: 2.5, changePercent: -1, direction: 'down' as const },
      orderCompletionRate: { current: 95, changePercent: 1, direction: 'up' as const },
      avgProcessingTimeDays: { current: 1.5, changePercent: -5, direction: 'down' as const },
    },
    inventory: {
      stockTurnoverRate: { current: 4.2, changePercent: 3, direction: 'up' as const },
      inventoryValue: { current: 5000, changePercent: -2, direction: 'down' as const },
      lowStockCount: { current: 8, changePercent: 10, direction: 'up' as const },
    },
    concentration: {
      paretoProducts: [
        { name: 'Product A', revenue: 500, percentage: 50 },
        { name: 'Product B', revenue: 300, percentage: 30 },
      ],
      top20RevenueShare: 80,
    },
  };

  beforeEach(() => {
    (useKPIs as Mock).mockReturnValue({
      kpis: mockKPIs,
      period: 30,
      setPeriod: vi.fn(),
      currencyCode: 'USD',
      hasData: true,
    });

    (useTheme as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { theme: 'light' };
      return selector ? selector(state) : state;
    });
  });

  it('should render KPI Dashboard title', () => {
    render(<KPIDashboardPage />);
    expect(screen.getByText('KPI Dashboard')).toBeInTheDocument();
  });

  it('should render all KPI sections', () => {
    render(<KPIDashboardPage />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
  });

  it('should render revenue KPI cards', () => {
    render(<KPIDashboardPage />);
    expect(screen.getByTestId('kpi-Total Revenue')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-Average Order Value')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-Revenue Growth')).toBeInTheDocument();
  });

  it('should render period selector buttons', () => {
    render(<KPIDashboardPage />);
    expect(screen.getByText('7 Days')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
    expect(screen.getByText('90 Days')).toBeInTheDocument();
    expect(screen.getByText('1 Year')).toBeInTheDocument();
  });

  it('should call setPeriod when clicking period button', () => {
    const mockSetPeriod = vi.fn();
    (useKPIs as Mock).mockReturnValue({
      kpis: mockKPIs,
      period: 30,
      setPeriod: mockSetPeriod,
      currencyCode: 'USD',
      hasData: true,
    });

    render(<KPIDashboardPage />);
    fireEvent.click(screen.getByText('7 Days'));
    expect(mockSetPeriod).toHaveBeenCalledWith(7);
  });

  it('should render Pareto chart when data available', () => {
    render(<KPIDashboardPage />);
    expect(screen.getByText('Revenue Concentration')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should show no data message when hasData is false', () => {
    (useKPIs as Mock).mockReturnValue({
      kpis: null,
      period: 30,
      setPeriod: vi.fn(),
      currencyCode: 'USD',
      hasData: false,
    });

    render(<KPIDashboardPage />);
    expect(screen.getByText('No Data Available')).toBeInTheDocument();
  });

  it('should render customer KPI cards', () => {
    render(<KPIDashboardPage />);
    expect(screen.getByTestId('kpi-Repeat Purchase Rate')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-Avg Basket Size')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-Customer Lifetime Value')).toBeInTheDocument();
  });

  it('should render operations KPI cards', () => {
    render(<KPIDashboardPage />);
    expect(screen.getByTestId('kpi-Refund Rate')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-Completion Rate')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-Avg Processing Time')).toBeInTheDocument();
  });

  it('should render inventory KPI cards', () => {
    render(<KPIDashboardPage />);
    expect(screen.getByTestId('kpi-Stock Turnover Rate')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-Inventory Value')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-Low Stock Items')).toBeInTheDocument();
  });
});
