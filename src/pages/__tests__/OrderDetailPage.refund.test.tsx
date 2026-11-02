import { vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderDetailPage from '../OrderDetailPage';
import { useOrderDetail } from '../../hooks/useOrderDetail';
import { useOrderNotes } from '../../hooks/useOrderNotes';
import {
  createMockOrder,
  createMockStore,
  createMockLineItem,
} from '../../__test_utils__/mockFactories';

const m = vi.hoisted(() => ({
  getOrderRefunds: vi.fn(),
  createRefund: vi.fn(),
  logActivity: vi.fn(),
  showToast: vi.fn(),
  fetchOrderFromApi: vi.fn(),
  Service: vi.fn(),
}));

vi.mock('../../stores', () => ({
  useStoreConfig: (sel: (s: unknown) => unknown) =>
    sel({ getCurrentStore: () => createMockStore({ name: 'Test Store', currency: 'USD' }) }),
  useActivityLog: (sel: (s: unknown) => unknown) => sel({ logActivity: m.logActivity }),
}));
vi.mock('../../services/woocommerce', () => ({ __esModule: true, default: m.Service }));
vi.mock('../../hooks/useOrderDetail');
vi.mock('../../hooks/useOrderNotes');
vi.mock('../../utils/pdfExport', () => ({
  exportOrderInvoice: vi.fn(),
  exportPackingSlip: vi.fn(),
}));
vi.mock('../../constants', () => ({ getOrderStatusColor: () => '' }));
vi.mock('../../components/ToastContainer', () => ({ default: () => null }));
vi.mock('../../components/PluginMetaPanel', () => ({ default: () => null }));
vi.mock('../../components/WpAdminModal', () => ({ default: () => null }));
vi.mock('../../components/ImageLightbox', () => ({ default: () => null }));

const order = (over = {}) =>
  createMockOrder({
    id: 42,
    number: '42',
    total: '50.00',
    currency_symbol: '$',
    line_items: [
      createMockLineItem({ id: 7, name: 'Widget', quantity: 2, total: '50.00', total_tax: '0.00' }),
    ],
    ...over,
  });

const setup = (o = order()): void => {
  (useOrderDetail as Mock).mockReturnValue({
    order: o,
    loading: false,
    refreshing: false,
    error: null,
    updatingStatus: false,
    handleStatusUpdate: vi.fn(),
    fetchOrderFromApi: m.fetchOrderFromApi,
    showToast: m.showToast,
    toasts: [],
    removeToast: vi.fn(),
  });
  (useOrderNotes as Mock).mockReturnValue({
    notes: [],
    newNote: '',
    isCustomerNote: false,
    loadingNotes: false,
    savingNote: false,
    deletingNoteId: null,
    setNewNote: vi.fn(),
    setIsCustomerNote: vi.fn(),
    handleAddNote: vi.fn(),
    handleDeleteNote: vi.fn(),
  });
  render(
    <MemoryRouter initialEntries={['/orders/42']}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
};

const openModal = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
  await screen.findByLabelText('Quantity to refund for Widget');
};
const refundTwo = (): void => {
  fireEvent.change(screen.getByLabelText('Quantity to refund for Widget'), {
    target: { value: '1' },
  });
  fireEvent.change(screen.getByLabelText('Refund reason'), { target: { value: 'Broken' } });
  fireEvent.click(within_dialog('Refund'));
};
// the modal's submit button is the last "Refund" button
const within_dialog = (name: string): HTMLElement => {
  const all = screen.getAllByRole('button', { name });
  return all[all.length - 1]!;
};

describe('OrderDetailPage refund flow', () => {
  beforeEach(() => {
    m.getOrderRefunds.mockResolvedValue({ success: true, data: [] });
    m.createRefund.mockResolvedValue({ success: true, data: { id: 1 } });
    m.fetchOrderFromApi.mockResolvedValue(undefined);
    m.Service.mockImplementation(function (this: Record<string, unknown>) {
      this.getOrderRefunds = m.getOrderRefunds;
      this.createRefund = m.createRefund;
    });
  });

  it('loads prior refunds, submits, logs activity, toasts, closes and refetches', async () => {
    setup();
    await openModal();
    expect(m.getOrderRefunds).toHaveBeenCalledWith(42);
    refundTwo();
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('Refund created', 'success'));
    expect(m.createRefund).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ amount: '25.00', reason: 'Broken' })
    );
    expect(m.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'order_refunded',
        entityId: 42,
        details: expect.stringContaining('Refunded 25.00'),
      })
    );
    expect(m.fetchOrderFromApi).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByLabelText('Refund reason')).toBeNull());
  });

  it('keeps the modal open and does not log when the refund fails', async () => {
    m.createRefund.mockResolvedValue({ success: false, error: 'gateway declined' });
    setup();
    await openModal();
    refundTwo();
    await waitFor(() =>
      expect(m.showToast).toHaveBeenCalledWith('Refund failed: gateway declined', 'error')
    );
    expect(m.logActivity).not.toHaveBeenCalled();
    expect(m.fetchOrderFromApi).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Refund reason')).toBeInTheDocument();
  });

  it('toasts when createRefund throws', async () => {
    m.createRefund.mockRejectedValue(new Error('network'));
    setup();
    await openModal();
    refundTwo();
    await waitFor(() =>
      expect(m.showToast).toHaveBeenCalledWith('Refund failed: network', 'error')
    );
  });

  it('closes the modal and toasts when prior refunds cannot be loaded', async () => {
    m.getOrderRefunds.mockResolvedValue({ success: false, error: '403' });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    await waitFor(() =>
      expect(m.showToast).toHaveBeenCalledWith('Failed to load refunds: 403', 'error')
    );
    expect(screen.queryByLabelText('Refund reason')).toBeNull();
  });

  it('hides the Refund button for a fully refunded order', () => {
    setup(order({ refunds: [{ id: 1, reason: '', total: '-50.00' }] }));
    expect(screen.queryByRole('button', { name: 'Refund' })).toBeNull();
  });

  it('Cancel closes the modal without calling createRefund', async () => {
    setup();
    await openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Refund reason')).toBeNull();
    expect(m.createRefund).not.toHaveBeenCalled();
  });
});
