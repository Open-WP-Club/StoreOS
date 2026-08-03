import { vi, Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProductExport } from '../useProductExport';
import { useStoreConfig } from '../../stores';
import { exportToCSV } from '../../utils/csvExport';
import { exportTableToPDF } from '../../utils/pdfExport';
import { createMockStore, createMockProduct } from '../../__test_utils__/mockFactories';
import type { WooCommerceStore } from '../../types';

// ============================================
// Mocks
// ============================================

vi.mock('../../stores');
vi.mock('../../utils/csvExport');
vi.mock('../../utils/pdfExport');
vi.mock('../../utils/currency', () => ({
  formatPrice: (val: unknown) => `$${val}`,
  formatCurrency: (val: unknown) => `$${val}`,
}));

// ============================================
// Setup
// ============================================

let mockActiveStore: WooCommerceStore | undefined;

beforeEach(() => {
  mockActiveStore = createMockStore({ name: 'Test Store' });

  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { getCurrentStore: () => mockActiveStore };
    return selector ? selector(state) : state;
  });
});

// ============================================
// Tests
// ============================================

describe('useProductExport', () => {
  it('should return handleExportCSV and handleExportPDF functions', () => {
    const { result } = renderHook(() => useProductExport());

    expect(typeof result.current.handleExportCSV).toBe('function');
    expect(typeof result.current.handleExportPDF).toBe('function');
  });

  describe('handleExportCSV', () => {
    it('should call exportToCSV with correct columns and filename', () => {
      const { result } = renderHook(() => useProductExport());
      const products = [createMockProduct(), createMockProduct()];

      result.current.handleExportCSV(products);

      expect(exportToCSV).toHaveBeenCalledTimes(1);
      expect(exportToCSV).toHaveBeenCalledWith(
        products,
        expect.arrayContaining([
          expect.objectContaining({ key: 'id', label: 'Product ID' }),
          expect.objectContaining({ key: 'name', label: 'Product Name' }),
          expect.objectContaining({ key: 'sku', label: 'SKU' }),
          expect.objectContaining({ key: 'price', label: 'Price' }),
          expect.objectContaining({ key: 'regular_price', label: 'Regular Price' }),
          expect.objectContaining({ key: 'stock_quantity', label: 'Stock' }),
          expect.objectContaining({ key: 'stock_status', label: 'Stock Status' }),
          expect.objectContaining({ key: 'status', label: 'Status' }),
        ]),
        expect.stringContaining('products-Test Store-')
      );
    });

    it('should generate filename with store name and date', () => {
      const { result } = renderHook(() => useProductExport());
      const products = [createMockProduct()];

      result.current.handleExportCSV(products);

      const filename = (exportToCSV as Mock).mock.calls[0]![2] as string;
      expect(filename).toMatch(/^products-Test Store-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('should include format functions for price columns', () => {
      const { result } = renderHook(() => useProductExport());
      result.current.handleExportCSV([createMockProduct()]);

      const columns = (exportToCSV as Mock).mock.calls[0]![1];
      const priceCol = columns.find((c: { key: string }) => c.key === 'price');
      const regularPriceCol = columns.find((c: { key: string }) => c.key === 'regular_price');

      expect(priceCol.format).toBeDefined();
      expect(regularPriceCol.format).toBeDefined();
      expect(priceCol.format('19.99')).toBe('$19.99');
      expect(regularPriceCol.format('29.99')).toBe('$29.99');
    });

    it('should not call exportToCSV when no store is configured', () => {
      mockActiveStore = undefined;

      const { result } = renderHook(() => useProductExport());
      result.current.handleExportCSV([createMockProduct()]);

      expect(exportToCSV).not.toHaveBeenCalled();
    });
  });

  describe('handleExportPDF', () => {
    it('should call exportTableToPDF with correct columns and options', () => {
      const { result } = renderHook(() => useProductExport());
      const products = [createMockProduct(), createMockProduct()];

      result.current.handleExportPDF(products);

      expect(exportTableToPDF).toHaveBeenCalledTimes(1);
      expect(exportTableToPDF).toHaveBeenCalledWith(
        products,
        expect.arrayContaining([
          expect.objectContaining({ key: 'id', label: 'ID' }),
          expect.objectContaining({ key: 'name', label: 'Product Name' }),
          expect.objectContaining({ key: 'sku', label: 'SKU' }),
          expect.objectContaining({ key: 'price', label: 'Price' }),
          expect.objectContaining({ key: 'stock_quantity', label: 'Stock' }),
          expect.objectContaining({ key: 'stock_status', label: 'Stock Status' }),
          expect.objectContaining({ key: 'status', label: 'Status' }),
        ]),
        expect.objectContaining({
          title: 'Products - Test Store',
          orientation: 'landscape',
        })
      );
    });

    it('should use landscape orientation', () => {
      const { result } = renderHook(() => useProductExport());
      result.current.handleExportPDF([createMockProduct()]);

      const options = (exportTableToPDF as Mock).mock.calls[0]![2];
      expect(options.orientation).toBe('landscape');
    });

    it('should include format function for price column', () => {
      const { result } = renderHook(() => useProductExport());
      result.current.handleExportPDF([createMockProduct()]);

      const columns = (exportTableToPDF as Mock).mock.calls[0]![1];
      const priceCol = columns.find((c: { key: string }) => c.key === 'price');

      expect(priceCol.format).toBeDefined();
      expect(priceCol.format('9.99')).toBe('$9.99');
    });

    it('should set title with store name', () => {
      mockActiveStore = createMockStore({ name: 'My Shop' });

      const { result } = renderHook(() => useProductExport());
      result.current.handleExportPDF([createMockProduct()]);

      const options = (exportTableToPDF as Mock).mock.calls[0]![2];
      expect(options.title).toBe('Products - My Shop');
    });

    it('should not call exportTableToPDF when no store is configured', () => {
      mockActiveStore = undefined;

      const { result } = renderHook(() => useProductExport());
      result.current.handleExportPDF([createMockProduct()]);

      expect(exportTableToPDF).not.toHaveBeenCalled();
    });
  });

  describe('PDF columns differ from CSV columns', () => {
    it('should have fewer columns for PDF than CSV', () => {
      const { result } = renderHook(() => useProductExport());
      const products = [createMockProduct()];

      result.current.handleExportCSV(products);
      result.current.handleExportPDF(products);

      const csvColumns = (exportToCSV as Mock).mock.calls[0]![1];
      const pdfColumns = (exportTableToPDF as Mock).mock.calls[0]![1];

      // CSV has 8 columns (includes regular_price), PDF has 7
      expect(csvColumns).toHaveLength(8);
      expect(pdfColumns).toHaveLength(7);
    });

    it('should use "ID" label in PDF but "Product ID" in CSV', () => {
      const { result } = renderHook(() => useProductExport());
      const products = [createMockProduct()];

      result.current.handleExportCSV(products);
      result.current.handleExportPDF(products);

      const csvColumns = (exportToCSV as Mock).mock.calls[0]![1];
      const pdfColumns = (exportTableToPDF as Mock).mock.calls[0]![1];

      const csvIdCol = csvColumns.find((c: { key: string }) => c.key === 'id');
      const pdfIdCol = pdfColumns.find((c: { key: string }) => c.key === 'id');

      expect(csvIdCol.label).toBe('Product ID');
      expect(pdfIdCol.label).toBe('ID');
    });
  });
});
