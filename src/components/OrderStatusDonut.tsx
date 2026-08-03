import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import type { ChartOptions } from 'chart.js';
import type { WooCommerceOrder } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

interface StatusConfig {
  label: string;
  bg: string;
  border: string;
}

// Fixed per-status color mapping
const STATUS_CONFIG: Record<string, StatusConfig> = {
  completed:  { label: 'Completed',  bg: 'rgba(34,197,94,0.75)',   border: 'rgb(34,197,94)' },
  processing: { label: 'Processing', bg: 'rgba(59,130,246,0.75)',  border: 'rgb(59,130,246)' },
  'on-hold':  { label: 'On Hold',    bg: 'rgba(251,191,36,0.75)',  border: 'rgb(251,191,36)' },
  pending:    { label: 'Pending',    bg: 'rgba(156,163,175,0.75)', border: 'rgb(156,163,175)' },
  cancelled:  { label: 'Cancelled',  bg: 'rgba(239,68,68,0.75)',   border: 'rgb(239,68,68)' },
  refunded:   { label: 'Refunded',   bg: 'rgba(168,85,247,0.75)',  border: 'rgb(168,85,247)' },
  failed:     { label: 'Failed',     bg: 'rgba(220,38,38,0.75)',   border: 'rgb(220,38,38)' },
};

// Preferred display order
const STATUS_ORDER = ['completed', 'processing', 'on-hold', 'pending', 'cancelled', 'refunded', 'failed'];

const CHART_OPTIONS: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '65%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 12,
        boxWidth: 12,
        font: { size: 12 },
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
          return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
        },
      },
    },
  },
};

interface OrderStatusDonutProps {
  orders: WooCommerceOrder[];
}

export default function OrderStatusDonut({ orders }: OrderStatusDonutProps): React.ReactElement | null {
  const chartData = useMemo(() => {
    // Count by status
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    });

    // Build in preferred order, then append any unknown statuses
    const knownStatuses = STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0);
    const unknownStatuses = Object.keys(counts).filter(
      (s) => !STATUS_ORDER.includes(s) && (counts[s] ?? 0) > 0
    );
    const statuses = [...knownStatuses, ...unknownStatuses];

    if (statuses.length === 0) return null;

    return {
      labels: statuses.map((s) => STATUS_CONFIG[s]?.label ?? s),
      datasets: [
        {
          data: statuses.map((s) => counts[s] ?? 0),
          backgroundColor: statuses.map((s) => STATUS_CONFIG[s]?.bg ?? 'rgba(107,114,128,0.75)'),
          borderColor: statuses.map((s) => STATUS_CONFIG[s]?.border ?? 'rgb(107,114,128)'),
          borderWidth: 1,
        },
      ],
    };
  }, [orders]);

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
        No order data available
      </div>
    );
  }

  const total = orders.length;

  return (
    <div className="relative">
      <Doughnut data={chartData} options={CHART_OPTIONS} />
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-1.5rem' }}>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{total}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">total</span>
      </div>
    </div>
  );
}
