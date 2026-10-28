import { vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderDetailPage from '../OrderDetailPage';
import { useStoreConfig } from '../../stores';
import { useOrderDetail } from '../../hooks/useOrderDetail';
import { useOrderNotes } from '../../hooks/useOrderNotes';
import { exportOrderInvoice } from '../../utils/pdfExport';
import { createMockOrder, createMockStore, createMockLineItem } from '../../__test_utils__/mockFactories';
import type { ProductImage } from '../../types';

vi.mock('../../stores');
vi.mock('../../hooks/useOrderDetail');
vi.mock('../../hooks/useOrderNotes');
vi.mock('../../utils/pdfExport', () => ({
  exportOrderInvoice: vi.fn(() => Promise.resolve()),
  exportPackingSlip: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../constants', () => ({
  getOrderStatusColor: () => 'bg-blue-100 text-blue-800',
}));

// Mock child components to simplify testing
vi.mock('../../components/ToastContainer', () => ({ default: function MockToastContainer() { return <div data-testid="toast-container" />; } }));
vi.mock('../../components/PluginMetaPanel', () => ({ default: function MockPluginMetaPanel() { return <div data-testid="plugin-meta" />; } }));
vi.mock('../../components/WpAdminModal', () => ({ default: function MockWpAdminModal({ isOpen }: { isOpen: boolean }) { return isOpen ? <div data-testid="wp-admin-modal" /> : null; } }));
vi.mock('../../components/ImageLightbox', () => ({ default: function MockImageLightbox() { return <div data-testid="image-lightbox" />; } }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

const defaultOrderDetail = {
  order: null as ReturnType<typeof createMockOrder> | null,
  loading: false,
  refreshing: false,
  error: null as string | null,
  updatingStatus: false,
  handleStatusUpdate: vi.fn(),
  fetchOrderFromApi: vi.fn(),
  showToast: vi.fn(),
  toasts: [],
  removeToast: vi.fn(),
};

const defaultOrderNotes = {
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
};

beforeEach(() => {
  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { getCurrentStore: () => createMockStore({ name: 'Test Store', currency: 'USD' }) };
    return selector ? selector(state) : state;
  });

  (useOrderDetail as Mock).mockReturnValue(defaultOrderDetail);
  (useOrderNotes as Mock).mockReturnValue(defaultOrderNotes);
});

function renderPage(orderId = '42') {
  return render(
    <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/orders" element={<div>Orders List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OrderDetailPage', () => {
  describe('loading state', () => {
    it('shows loading spinner when loading', () => {
      (useOrderDetail as Mock).mockReturnValue({ ...defaultOrderDetail, loading: true });
      renderPage();
      expect(screen.getByText('Loading order...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      (useOrderDetail as Mock).mockReturnValue({
        ...defaultOrderDetail,
        error: 'Order not accessible',
      });
      renderPage();
      expect(screen.getByText('Error: Order not accessible')).toBeInTheDocument();
    });

    it('shows back button on error', () => {
      (useOrderDetail as Mock).mockReturnValue({
        ...defaultOrderDetail,
        error: 'Some error',
      });
      renderPage();
      const backBtn = screen.getByText('← Back to Orders');
      fireEvent.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/orders');
    });
  });

  describe('not found state', () => {
    it('shows "Order not found" when no order', () => {
      (useOrderDetail as Mock).mockReturnValue({
        ...defaultOrderDetail,
        order: null,
      });
      renderPage();
      expect(screen.getByText('Order not found')).toBeInTheDocument();
    });
  });

  describe('order loaded', () => {
    const mockOrder = createMockOrder({
      id: 42,
      status: 'processing',
      date_created: '2026-01-15T10:00:00',
      currency: 'USD',
      customer_note: '',
      line_items: [
        createMockLineItem({ name: 'Widget', image: { src: 'https://img.com/w.jpg' } as ProductImage }),
      ],
    });

    beforeEach(() => {
      (useOrderDetail as Mock).mockReturnValue({
        ...defaultOrderDetail,
        order: mockOrder,
      });
    });

    it('renders order ID in header', () => {
      renderPage();
      expect(screen.getByText('Order #42')).toBeInTheDocument();
    });

    it('renders status badge', () => {
      renderPage();
      // "Processing" appears both in status badge and in sidebar select option
      const badges = screen.getAllByText('Processing');
      expect(badges.length).toBeGreaterThanOrEqual(1);
      // The status badge is the span with rounded-full class
      const badge = badges.find(el => el.className.includes('rounded-full'));
      expect(badge).toBeTruthy();
    });

    it('renders Invoice button', () => {
      renderPage();
      expect(screen.getByText('Invoice')).toBeInTheDocument();
    });

    it('calls exportOrderInvoice when Invoice clicked', () => {
      renderPage();
      fireEvent.click(screen.getByText('Invoice'));
      expect(exportOrderInvoice).toHaveBeenCalledWith(mockOrder, 'Test Store', 'USD');
    });

    it('renders back link', () => {
      renderPage();
      const backLink = screen.getByText('← Back to Orders');
      expect(backLink.closest('a')).toHaveAttribute('href', '/orders');
    });

    it('renders child components', () => {
      renderPage();
      expect(screen.getByTestId('toast-container')).toBeInTheDocument();
      expect(screen.getByTestId('plugin-meta')).toBeInTheDocument();
    });

    it('shows refreshing indicator when refreshing', () => {
      (useOrderDetail as Mock).mockReturnValue({
        ...defaultOrderDetail,
        order: mockOrder,
        refreshing: true,
      });
      renderPage();
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });

    it('hides refreshing indicator when not refreshing', () => {
      renderPage();
      expect(screen.queryByText('Syncing...')).not.toBeInTheDocument();
    });

    it('shows customer note section when customer_note exists', () => {
      const orderWithNote = createMockOrder({
        ...mockOrder,
        customer_note: 'Please deliver fast',
      });
      (useOrderDetail as Mock).mockReturnValue({
        ...defaultOrderDetail,
        order: orderWithNote,
      });
      renderPage();
      expect(screen.getByText('Бележка от клиента')).toBeInTheDocument();
      expect(screen.getByText('Please deliver fast')).toBeInTheDocument();
    });

    it('hides customer note section when no customer_note', () => {
      renderPage();
      expect(screen.queryByText('Бележка от клиента')).not.toBeInTheDocument();
    });
  });
});
