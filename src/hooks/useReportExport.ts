import { useStoreConfig } from '../stores';
import { exportToCSV, type CSVColumn } from '../utils/csvExport';
import { exportReportToPDF, type PDFColumn, type ReportSummaryMetric } from '../utils/pdfExport';

export interface ReportConfig<T extends Record<string, unknown>> {
  reportName: string;
  filenamePrefix: string;
  summaryMetrics: ReportSummaryMetric[];
  columns: PDFColumn<T>[];
  data: T[];
  timeRange?: string;
}

interface UseReportExportResult {
  handleExportCSV: () => void;
  handleExportPDF: () => void;
  handlePrint: () => void;
}

/**
 * Generic hook for exporting analytics reports to CSV, PDF, or printing.
 */
export function useReportExport<T extends Record<string, unknown>>(
  config: ReportConfig<T>
): UseReportExportResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();

  const handleExportCSV = (): void => {
    if (!config.data || config.data.length === 0) return;

    const csvColumns: CSVColumn<T>[] = config.columns.map((col) => ({
      key: col.key,
      label: col.label,
      format: col.format,
    }));

    const storeName = currentStore?.name || 'store';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${config.filenamePrefix}-${storeName}-${timestamp}.csv`;

    exportToCSV(config.data, csvColumns, filename);
  };

  const handleExportPDF = (): void => {
    if (!config.data || config.data.length === 0) return;

    const storeName = currentStore?.name || 'Store';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${config.filenamePrefix}-${storeName}-${timestamp}.pdf`;

    exportReportToPDF(config.data, config.columns, config.summaryMetrics, {
      title: config.reportName,
      storeName,
      timeRange: config.timeRange,
      filename,
      orientation: 'landscape',
    }).catch((error) =>
      // eslint-disable-next-line no-console
      console.error('PDF export failed', error)
    );
  };

  const handlePrint = (): void => {
    window.print();
  };

  return { handleExportCSV, handleExportPDF, handlePrint };
}

export default useReportExport;
