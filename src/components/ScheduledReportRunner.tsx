import { useEffect } from 'react';
import { useCache, useStoreConfig } from '../stores';
import useScheduledReports from '../stores/scheduledReportsStore';
import { convertToCSV, type CSVColumn } from '../utils/csvExport';
import { exportReportToPDF, type PDFColumn } from '../utils/pdfExport';
import { isDue, lastSlot, reportPeriod } from '../utils/reportSchedule';
import type { RecentTransaction } from '../hooks/usePOSDailyReport';

interface Row extends Record<string, unknown> {
  ref: string;
  time: string;
  detail: string;
  total: number;
}

const CHECK_MS = 60_000;
const POS_KEY = 'pos_recent_transactions'; // same storage usePOSDailyReport reads
const EXCLUDED = new Set(['cancelled', 'failed', 'refunded', 'trash']);

function collectRows(type: string, start: number, end: number): Row[] {
  const inRange = (iso: string): boolean => {
    const t = new Date(iso).getTime();
    return t >= start && t < end;
  };
  if (type === 'pos-daily') {
    let txs: RecentTransaction[] = [];
    try {
      txs = JSON.parse(localStorage.getItem(POS_KEY) ?? '[]');
    } catch {
      // corrupt history: report is simply empty
    }
    return txs
      .filter((tx) => !tx.refunded && inRange(tx.timestamp))
      .map((tx) => ({
        ref: `#${tx.id}`,
        time: tx.timestamp,
        detail: tx.paymentMethod,
        total: tx.total,
      }));
  }
  const orders = useCache.getState().cache.orders?.data ?? [];
  return orders
    .filter((o) => !EXCLUDED.has(o.status) && inRange(o.date_created_gmt || o.date_created))
    .map((o) => ({
      ref: `#${o.id}`,
      time: o.date_created,
      detail: o.status,
      total: parseFloat(o.total) || 0,
    }));
}

const COLUMNS: PDFColumn<Row>[] = [
  { key: 'ref', label: 'Order' },
  { key: 'time', label: 'Time' },
  { key: 'detail', label: 'Status / Payment' },
  { key: 'total', label: 'Total' },
];

async function runOnce(now: Date): Promise<void> {
  const cfg = useScheduledReports.getState();
  const api = window.electronAPI;
  if (!cfg.enabled || !api?.reports) return;
  if (!isDue(now, cfg, cfg.lastRun)) return;

  // Mark first: a slow or failing run must not retrigger every minute / twice for one period.
  const slot = lastSlot(now, cfg);
  useScheduledReports.setState({ lastRun: now.getTime() });

  const { start, end } = reportPeriod(slot, cfg);
  const rows = collectRows(cfg.reportType, start, end);
  const storeName = useStoreConfig.getState().getCurrentStore()?.name || 'store';
  const day = slot.toISOString().slice(0, 10);
  const name = `${cfg.reportType}-${storeName.replace(/[^\w]+/g, '_')}-${day}.${cfg.format}`;
  const title = cfg.reportType === 'pos-daily' ? 'POS daily report' : 'Sales summary';

  let data: string | Uint8Array;
  if (cfg.format === 'csv') {
    data = convertToCSV(rows, COLUMNS as CSVColumn<Row>[]) || COLUMNS.map((c) => c.label).join(',');
  } else {
    const revenue = rows.reduce((s, r) => s + r.total, 0);
    const bytes = await exportReportToPDF(
      rows,
      COLUMNS,
      [
        { label: 'Orders', value: String(rows.length) },
        { label: 'Revenue', value: revenue.toFixed(2) },
      ],
      {
        title,
        storeName,
        timeRange: `${new Date(start).toLocaleString()} - ${new Date(end).toLocaleString()}`,
        returnBytes: true,
      }
    );
    if (!bytes) return;
    data = new Uint8Array(bytes);
  }

  const res = await api.reports.save(name, data);
  if (cfg.notify) {
    api.showNotification({
      title,
      body: res.success ? `Saved ${name}` : `Report failed: ${res.error ?? 'unknown error'}`,
    });
  }
}

/** Headless: runs due scheduled reports while the app is open (and one catch-up on startup). */
function ScheduledReportRunner(): null {
  useEffect(() => {
    const tick = (): void => {
      runOnce(new Date()).catch((e) => {
        // eslint-disable-next-line no-console
        console.error('Scheduled report failed', e);
      });
    };
    tick();
    const id = setInterval(tick, CHECK_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}

export default ScheduledReportRunner;
