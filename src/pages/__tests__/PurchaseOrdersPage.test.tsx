import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PurchaseOrdersPage from '../PurchaseOrdersPage';
import useSuppliers from '../../stores/suppliersStore';
import { groupReorderBySupplier } from '../../utils/purchaseOrders';
import { createMockStore, createMockProduct } from '../../__test_utils__';

const m = vi.hoisted(() => ({
  updateCost: vi.fn(),
  applyStockCount: vi.fn(),
  showToast: vi.fn(),
  csv: vi.fn(),
}));
const store = createMockStore();
const product = createMockProduct({ id: 7, name: 'Widget', manage_stock: true, stock_quantity: 5 });

vi.mock('../../stores', () => {
  const useCache = Object.assign(
    (sel: (s: unknown) => unknown) => sel({ cache: { products: { data: [product] } } }),
    { getState: () => ({ cache: { products: { data: [product] } } }) }
  );
  return {
    useStoreConfig: (sel: (s: unknown) => unknown) => sel({ getCurrentStore: () => store }),
    useCache,
  };
});
vi.mock('../../hooks/useStockUpdater', () => ({
  useStockUpdater: () => ({
    applyStockCount: m.applyStockCount,
    updateCost: m.updateCost,
    updateStock: vi.fn(),
    updating: false,
  }),
}));
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], showToast: m.showToast, removeToast: vi.fn() }),
}));
vi.mock('../../utils/csvExport', () => ({ exportToCSV: m.csv }));
vi.mock('../../utils/pdfExport', () => ({ exportTableToPDF: vi.fn(() => Promise.resolve()) }));
vi.mock('../../components/ExportMenu', () => ({
  default: ({ onExportCSV }: { onExportCSV: () => void }) => (
    <button onClick={onExportCSV}>Export CSV</button>
  ),
}));

beforeEach(() => {
  useSuppliers.setState({ byStore: {} });
  m.applyStockCount.mockResolvedValue(true);
  m.updateCost.mockResolvedValue(true);
});

describe('PurchaseOrdersPage', () => {
  it('adds a supplier, builds a PO, orders and receives it through the stock path', async () => {
    const user = userEvent.setup();
    render(<PurchaseOrdersPage />);
    await user.type(screen.getByLabelText('Supplier name'), 'Acme');
    await user.click(screen.getByText('Add supplier'));
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('New order supplier'), 'Acme');
    await user.click(screen.getByText('New purchase order'));
    await user.selectOptions(screen.getByLabelText('Add product'), 'Widget');
    await user.click(screen.getByText('Add line'));
    fireEvent.change(screen.getByLabelText('Quantity Widget'), { target: { value: '10' } });
    await user.click(screen.getByText('Mark as ordered'));
    await user.click(screen.getByText('Receive stock'));

    await waitFor(() =>
      expect(m.applyStockCount).toHaveBeenCalledWith([{ productId: 7, counted: 15 }])
    );
    const po = Object.values(useSuppliers.getState().byStore)[0]!.orders[0]!;
    expect(po.status).toBe('received');
    expect(po.lines[0]!.received).toBe(10);
    expect(m.updateCost).not.toHaveBeenCalled(); // unit cost is 0
  });

  it('partial receipt keeps the PO open', async () => {
    const user = userEvent.setup();
    useSuppliers.getState().addOrder(store.id, {
      supplierId: null,
      supplierName: 'Unassigned',
      lines: [{ productId: 7, name: 'Widget', sku: '', qty: 10, unitCost: 2, received: 0 }],
    });
    const id = useSuppliers.getState().byStore[store.id]!.orders[0]!.id;
    useSuppliers.getState().markOrdered(store.id, id);
    render(<PurchaseOrdersPage />);
    await user.click(screen.getByText(/Open PO-1/));
    const qty = screen.getByLabelText('Receive Widget');
    await user.clear(qty);
    await user.type(qty, '4');
    await user.click(screen.getByText('Receive stock'));
    await waitFor(() =>
      expect(useSuppliers.getState().byStore[store.id]!.orders[0]!.status).toBe('partial')
    );
  });
});

describe('receiving failures and cost', () => {
  const setup = () => {
    useSuppliers.getState().addOrder(store.id, {
      supplierId: null,
      supplierName: 'Unassigned',
      lines: [{ productId: 7, name: 'Widget', sku: '', qty: 10, unitCost: 2.5, received: 0 }],
    });
    const id = useSuppliers.getState().byStore[store.id]!.orders[0]!.id;
    useSuppliers.getState().markOrdered(store.id, id);
  };

  it('does not record the receipt when the stock update failed', async () => {
    const user = userEvent.setup();
    setup();
    m.applyStockCount.mockResolvedValue(false);
    render(<PurchaseOrdersPage />);
    await user.click(screen.getByText(/Open PO-1/));
    await user.click(screen.getByText('Receive stock'));
    await waitFor(() =>
      expect(m.showToast).toHaveBeenCalledWith(expect.stringContaining('failed'), 'error')
    );
    const po = useSuppliers.getState().byStore[store.id]!.orders[0]!;
    expect(po.status).toBe('ordered');
    expect(po.lines[0]!.received).toBe(0);
    expect(m.updateCost).not.toHaveBeenCalled();
  });

  it('writes the unit cost back after a successful receipt', async () => {
    const user = userEvent.setup();
    setup();
    render(<PurchaseOrdersPage />);
    await user.click(screen.getByText(/Open PO-1/));
    await user.click(screen.getByText('Receive stock'));
    await waitFor(() => expect(m.updateCost).toHaveBeenCalledWith(7, 2.5));
  });
});

describe('groupReorderBySupplier', () => {
  it('groups by supplier and skips zero qty', () => {
    const g = groupReorderBySupplier([
      { id: 1, name: 'A', sku: '', supplier: 'X', orderQty: 2 },
      { id: 2, name: 'B', sku: '', supplier: 'X', orderQty: 0 },
      { id: 3, name: 'C', sku: '', supplier: 'Y', orderQty: 1 },
    ]);
    expect([...g.keys()]).toEqual(['X', 'Y']);
    expect(g.get('X')).toHaveLength(1);
  });
});
