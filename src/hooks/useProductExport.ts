import { useStoreConfig } from '../stores';
import { formatPrice } from '../utils/currency';
import { exportToCSV, CSVColumn } from '../utils/csvExport';
import { exportTableToPDF } from '../utils/pdfExport';
import type { Product } from '../types';

type ProductRecord = Product & Record<string, unknown>;

interface UseProductExportResult {
  handleExportCSV: (filteredProducts: Product[]) => void;
  handleExportPDF: (filteredProducts: Product[]) => void;
}

/**
 * Hook for exporting product data to CSV and PDF.
 */
export function useProductExport(): UseProductExportResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();

  const handleExportCSV = (filteredProducts: Product[]): void => {
    if (!currentStore) return;

    const columns: CSVColumn<ProductRecord>[] = [
      { key: 'id', label: 'Product ID' },
      { key: 'name', label: 'Product Name' },
      { key: 'sku', label: 'SKU' },
      {
        key: 'price',
        label: 'Price',
        format: (val: unknown) => formatPrice(val as string),
      },
      {
        key: 'regular_price',
        label: 'Regular Price',
        format: (val: unknown) => formatPrice(val as string),
      },
      { key: 'stock_quantity', label: 'Stock' },
      { key: 'stock_status', label: 'Stock Status' },
      { key: 'status', label: 'Status' },
    ];

    const filename = `products-${currentStore.name}-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(filteredProducts as ProductRecord[], columns, filename);
  };

  const handleExportPDF = (filteredProducts: Product[]): void => {
    if (!currentStore) return;

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Product Name' },
      { key: 'sku', label: 'SKU' },
      {
        key: 'price',
        label: 'Price',
        format: (val: unknown) => formatPrice(val as string),
      },
      { key: 'stock_quantity', label: 'Stock' },
      { key: 'stock_status', label: 'Stock Status' },
      { key: 'status', label: 'Status' },
    ];

    exportTableToPDF(filteredProducts as ProductRecord[], columns, {
      title: `Products - ${currentStore.name}`,
      orientation: 'landscape',
    }).catch((error) =>
      // eslint-disable-next-line no-console
      console.error('PDF export failed', error)
    );
  };

  return { handleExportCSV, handleExportPDF };
}

export default useProductExport;
