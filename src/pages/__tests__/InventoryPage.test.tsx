import { vi, Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InventoryPage from '../InventoryPage';
import { useStoreConfig, useCache, useActivityLog, useSettings } from '../../stores';
import WooCommerceService from '../../services/woocommerce';
import { useToast } from '../../hooks/useToast';
import { useProgressiveLoading } from '../../hooks/useProgressiveLoading';
import { createMockStore, createMockProduct } from '../../__test_utils__/mockFactories';
import { exportToCSV } from '../../utils/csvExport';
import { exportTableToPDF } from '../../utils/pdfExport';
import type { Product } from '../../types';

vi.mock('../../stores');
vi.mock('../../services/woocommerce');
vi.mock('../../hooks/useToast');
vi.mock('../../hooks/useProgressiveLoading');
vi.mock('../../utils/currency', () => ({
  formatPrice: (val: unknown) => `$${val}`,
}));
vi.mock('../../utils/csvExport', () => ({
  exportToCSV: vi.fn(),
}));
vi.mock('../../utils/pdfExport', () => ({
  exportTableToPDF: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../constants', () => ({
  EMPTY_PRODUCTS: [],
}));

// Mock child components
vi.mock('../../components/ExportMenu', () => ({ default: function MockExportMenu({ onExportCSV, onExportPDF }: { onExportCSV: () => void; onExportPDF: () => void }) {
  return (
    <div>
      <button onClick={onExportCSV}>Export CSV</button>
      <button onClick={onExportPDF}>Export PDF</button>
    </div>
  );
} }));
vi.mock('../../components/Pagination', () => ({ default: function MockPagination() { return <div data-testid="pagination" />; } }));
vi.mock('../../components/BulkEditModal', () => ({ default: function MockBulkEditModal({ isOpen }: { isOpen: boolean }) {
  return isOpen ? <div data-testid="bulk-edit-modal" /> : null;
} }));
vi.mock('../../components/ToastContainer', () => ({ default: function MockToastContainer() { return <div data-testid="toast-container" />; } }));
vi.mock('../../components/LoadingIndicator', () => ({ default: function MockLoadingIndicator() { return null; } }));
vi.mock('../../components/StatCard', () => ({ default: function MockStatCard({ label, value }: { label: string; value: number }) {
  return <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>{value}</div>;
} }));
vi.mock('../../components/PageHeader', () => ({ default: function MockPageHeader({ title }: { title: string }) {
  return <h1>{title}</h1>;
} }));
vi.mock('../../components/EmptyState', () => ({ default: function MockEmptyState({ title }: { title: string }) {
  return <div data-testid="empty-state">{title}</div>;
} }));

let mockStore: ReturnType<typeof createMockStore> | undefined;
let mockProducts: Product[];
const mockClearCacheForType = vi.fn();
const mockSetCachedData = vi.fn();
const mockShowToast = vi.fn();
const mockLogActivity = vi.fn();
const mockUpdateStock = vi.fn();
const mockDeleteProduct = vi.fn();
const mockBatchProducts = vi.fn();
const mockBatchUpdateProducts = vi.fn();

function createProducts(): Product[] {
  return [
    createMockProduct({ id: 1, name: 'Widget A', sku: 'WA', price: '10.00', stock_status: 'instock', stock_quantity: 50, manage_stock: true }) as Product,
    createMockProduct({ id: 2, name: 'Widget B', sku: 'WB', price: '20.00', stock_status: 'instock', stock_quantity: 3, manage_stock: true }) as Product,
    createMockProduct({ id: 3, name: 'Widget C', sku: 'WC', price: '30.00', stock_status: 'outofstock', stock_quantity: 0, manage_stock: true }) as Product,
    createMockProduct({ id: 4, name: 'Gadget', sku: 'GA', price: '40.00', stock_status: 'instock', stock_quantity: null, manage_stock: false }) as Product,
  ];
}

beforeEach(() => {
  mockStore = createMockStore();
  mockProducts = createProducts();

  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { getCurrentStore: () => mockStore };
    return selector ? selector(state) : state;
  });

  (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = {
      clearCacheForType: mockClearCacheForType,
      setCachedData: mockSetCachedData,
      cache: { products: { data: mockProducts } },
    };
    return selector ? selector(state) : state;
  });

  (useActivityLog as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { logActivity: mockLogActivity };
    return selector ? selector(state) : state;
  });

  (useSettings as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { lowStockThreshold: 5 };
    return selector ? selector(state) : state;
  });

  (useToast as Mock).mockReturnValue({
    toasts: [],
    showToast: mockShowToast,
    removeToast: vi.fn(),
  });

  (useProgressiveLoading as Mock).mockReturnValue({
    loadingState: { isLoading: false },
  });

  (WooCommerceService as Mock).mockImplementation(function () { return {
    updateStock: mockUpdateStock,
    deleteProduct: mockDeleteProduct,
    batchProducts: mockBatchProducts,
    batchUpdateProducts: mockBatchUpdateProducts,
  }; });

  window.confirm = vi.fn(() => true);
  window.scrollTo = vi.fn();
});

describe('InventoryPage', () => {
  describe('empty state', () => {
    it('shows empty state when no store selected', () => {
      mockStore = undefined;
      render(<InventoryPage />);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('stats', () => {
    it('renders stats cards', () => {
      render(<InventoryPage />);
      expect(screen.getByTestId('stat-total-products')).toHaveTextContent('4');
      // instock: Widget A (50), Widget B (3), Gadget (no stock) = 3
      expect(screen.getByTestId('stat-in-stock')).toHaveTextContent('3');
      // low stock: stock_quantity != null && <= 5 && > 0 = Widget B (3)
      expect(screen.getByTestId('stat-low-stock')).toHaveTextContent('1');
      // outofstock: Widget C
      expect(screen.getByTestId('stat-out-of-stock')).toHaveTextContent('1');
    });
  });

  describe('product table', () => {
    it('renders products', () => {
      render(<InventoryPage />);
      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.getByText('Widget B')).toBeInTheDocument();
      expect(screen.getByText('Widget C')).toBeInTheDocument();
      expect(screen.getByText('Gadget')).toBeInTheDocument();
    });

    it('shows "Not managed" for products without stock management', () => {
      render(<InventoryPage />);
      expect(screen.getByText('Not managed')).toBeInTheDocument();
    });

    it('renders page header', () => {
      render(<InventoryPage />);
      expect(screen.getByText('Inventory Management')).toBeInTheDocument();
    });
  });

  describe('search', () => {
    it('filters products by name', () => {
      render(<InventoryPage />);
      fireEvent.change(screen.getByPlaceholderText('Search by product name or SKU...'), {
        target: { value: 'Gadget' },
      });
      expect(screen.getByText('Gadget')).toBeInTheDocument();
      expect(screen.queryByText('Widget A')).not.toBeInTheDocument();
    });

    it('filters products by SKU', () => {
      render(<InventoryPage />);
      fireEvent.change(screen.getByPlaceholderText('Search by product name or SKU...'), {
        target: { value: 'WA' },
      });
      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.queryByText('Widget B')).not.toBeInTheDocument();
    });
  });

  describe('stock filter', () => {
    it('filters by "in stock"', () => {
      render(<InventoryPage />);
      fireEvent.change(screen.getByDisplayValue('All Products'), {
        target: { value: 'in' },
      });
      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.getByText('Gadget')).toBeInTheDocument();
      expect(screen.queryByText('Widget C')).not.toBeInTheDocument();
    });

    it('filters by "out of stock"', () => {
      render(<InventoryPage />);
      fireEvent.change(screen.getByDisplayValue('All Products'), {
        target: { value: 'out' },
      });
      expect(screen.getByText('Widget C')).toBeInTheDocument();
      expect(screen.queryByText('Widget A')).not.toBeInTheDocument();
    });

    it('filters by "low stock"', () => {
      render(<InventoryPage />);
      fireEvent.change(screen.getByDisplayValue('All Products'), {
        target: { value: 'low' },
      });
      expect(screen.getByText('Widget B')).toBeInTheDocument();
      expect(screen.queryByText('Widget A')).not.toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('selects individual product', () => {
      render(<InventoryPage />);
      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is select-all, rest are per product
      fireEvent.click(checkboxes[1]!);
      expect(screen.getByText(/1 product.* selected/)).toBeInTheDocument();
    });

    it('shows bulk actions when products selected', () => {
      render(<InventoryPage />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);
      expect(screen.getByText('Bulk Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete Selected')).toBeInTheDocument();
    });

    it('clears selection', () => {
      render(<InventoryPage />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);
      expect(screen.getByText('Clear Selection')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Clear Selection'));
      expect(screen.queryByText('Bulk Edit')).not.toBeInTheDocument();
    });
  });

  describe('export', () => {
    it('exports CSV', () => {
      render(<InventoryPage />);
      fireEvent.click(screen.getByText('Export CSV'));
      expect(exportToCSV).toHaveBeenCalled();
    });

    it('exports PDF', () => {
      render(<InventoryPage />);
      fireEvent.click(screen.getByText('Export PDF'));
      expect(exportTableToPDF).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('calls clearCacheForType when Refresh clicked', () => {
      render(<InventoryPage />);
      fireEvent.click(screen.getByText('Refresh'));
      expect(mockClearCacheForType).toHaveBeenCalledWith('products');
    });
  });

  describe('bulk delete', () => {
    it('warns about partial failures from the batch response', async () => {
      mockBatchProducts.mockResolvedValue({
        success: true,
        data: { delete: [{ id: 1, error: { code: 'x', message: 'no' } }] },
      });

      render(<InventoryPage />);
      fireEvent.click(screen.getAllByRole('checkbox')[1]!);

      await act(async () => {
        fireEvent.click(screen.getByText('Delete Selected'));
      });

      expect(mockBatchProducts).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('Error deleting products: 1 of 1 failed', 'error');
    });

    it('deletes selected products after confirmation', async () => {
      mockBatchProducts.mockResolvedValue({ success: true, data: {} });

      render(<InventoryPage />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!); // Select first product

      await act(async () => {
        fireEvent.click(screen.getByText('Delete Selected'));
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(mockBatchProducts).toHaveBeenCalledWith({ delete: [expect.any(Number)] });
    });

    it('does not delete if confirm is cancelled', async () => {
      (window.confirm as Mock).mockReturnValue(false);

      render(<InventoryPage />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]!);

      await act(async () => {
        fireEvent.click(screen.getByText('Delete Selected'));
      });

      expect(mockBatchProducts).not.toHaveBeenCalled();
    });
  });

  describe('stock update', () => {
    it('updates stock on blur with new value', async () => {
      mockUpdateStock.mockResolvedValue({
        success: true,
        data: createMockProduct({ id: 1, stock_quantity: 99 }),
      });

      render(<InventoryPage />);
      const stockInputs = screen.getAllByRole('spinbutton');
      // First spinbutton should be for Widget A (stock_quantity: 50)

      await act(async () => {
        fireEvent.blur(stockInputs[0]!, { target: { value: '99' } });
      });
    });

    it('logs activity on successful stock update', async () => {
      mockUpdateStock.mockResolvedValue({
        success: true,
        data: createMockProduct({ id: 1, name: 'Widget A', stock_quantity: 99 }),
      });

      render(<InventoryPage />);
      const stockInputs = screen.getAllByRole('spinbutton');

      await act(async () => {
        fireEvent.blur(stockInputs[0]!, { target: { value: '99' } });
      });

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'stock_updated',
          entityType: 'product',
          entityId: 1,
          changes: expect.objectContaining({
            stock_quantity: expect.objectContaining({ to: 99 }),
          }),
        })
      );
    });

    it('does not log activity on failed stock update', async () => {
      mockUpdateStock.mockResolvedValue({
        success: false,
        error: 'API error',
      });

      render(<InventoryPage />);
      const stockInputs = screen.getAllByRole('spinbutton');

      await act(async () => {
        fireEvent.blur(stockInputs[0]!, { target: { value: '99' } });
      });

      expect(mockLogActivity).not.toHaveBeenCalled();
    });
  });

  describe('no products', () => {
    it('shows "No products found" when filter returns empty', () => {
      render(<InventoryPage />);
      fireEvent.change(screen.getByPlaceholderText('Search by product name or SKU...'), {
        target: { value: 'nonexistent' },
      });
      expect(screen.getByText('No products found')).toBeInTheDocument();
    });
  });
});
