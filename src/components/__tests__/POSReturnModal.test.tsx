import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { POSReturnModal } from '../POSReturnModal';
import { createMockOrder, createMockLineItem } from '../../__test_utils__/mockFactories';

const svc = vi.hoisted(() => ({
  getOrder: vi.fn(),
  getOrderRefunds: vi.fn(),
  createRefund: vi.fn(),
}));
vi.mock('../../services/woocommerce', () => ({
  default: vi.fn(function () {
    return svc;
  }),
}));
vi.mock('../../stores', () => ({
  useStoreConfig: (sel: (s: unknown) => unknown) =>
    sel({ getCurrentStore: () => ({ id: 's1', name: 'Shop', url: 'https://x.test' }) }),
  useAppSettings: Object.assign((sel: (s: unknown) => unknown) => sel({ defaultPrinter: '' }), {
    getState: () => ({ receiptVatRate: 20 }),
  }),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));
vi.mock('../../utils/printReceipt', () => ({ printReceipt: vi.fn().mockResolvedValue(true) }));
vi.mock('../../utils/posOfflineSale', async (orig) => ({
  ...(await orig<object>()),
  decrementCachedStock: vi.fn().mockResolvedValue(undefined),
}));

const order = createMockOrder({
  id: 55,
  line_items: [
    createMockLineItem({
      id: 7,
      product_id: 99,
      name: 'Widget',
      quantity: 2,
      total: '50.00',
      total_tax: '0.00',
    }),
  ],
});

describe('POSReturnModal', () => {
  beforeEach(() => {
    localStorage.clear();
    svc.getOrder.mockResolvedValue({ success: true, data: order });
    svc.getOrderRefunds.mockResolvedValue({ success: true, data: [] });
    svc.createRefund.mockResolvedValue({ success: true, data: { id: 3 } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('looks up an order and creates a refund with restock', async () => {
    render(<POSReturnModal recentTransactions={[]} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Номер на поръчка'), { target: { value: '#55' } });
    fireEvent.click(screen.getByRole('button', { name: /Търси/ }));
    const qty = await screen.findByLabelText('Количество за връщане: Widget');
    fireEvent.change(qty, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Върни' }));
    await waitFor(() => expect(svc.createRefund).toHaveBeenCalled());
    expect(svc.createRefund).toHaveBeenCalledWith(
      55,
      expect.objectContaining({ amount: '25.00', api_restock: true, api_refund: false })
    );
    expect(await screen.findByText(/Печат на бележка/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pos_returns')!)).toHaveLength(1);
  });

  it('refuses to look up or refund while offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<POSReturnModal recentTransactions={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/не се записват офлайн/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Търси/ })).toBeDisabled();
    expect(svc.getOrder).not.toHaveBeenCalled();
  });

  it('reconciles after a thrown createRefund and blocks resubmit until refreshed', async () => {
    svc.createRefund.mockRejectedValueOnce(new Error('timeout'));
    render(<POSReturnModal recentTransactions={[]} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Номер на поръчка'), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: /Търси/ }));
    fireEvent.change(await screen.findByLabelText('Количество за връщане: Widget'), {
      target: { value: '1' },
    });
    svc.getOrderRefunds.mockClear();
    svc.getOrderRefunds.mockRejectedValueOnce(new Error('down'));
    fireEvent.click(screen.getByRole('button', { name: 'Върни' }));
    await screen.findByRole('button', { name: 'Опресни' });
    expect(screen.getByRole('button', { name: 'Върни' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Опресни' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Опресни' })).toBeNull());
    expect(svc.getOrderRefunds).toHaveBeenCalledTimes(2);
    expect(svc.createRefund).toHaveBeenCalledTimes(1);
  });

  it('still shows success when post-refund bookkeeping throws', async () => {
    const { decrementCachedStock } = await import('../../utils/posOfflineSale');
    vi.mocked(decrementCachedStock).mockRejectedValueOnce(new Error('idb'));
    render(<POSReturnModal recentTransactions={[]} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Номер на поръчка'), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: /Търси/ }));
    fireEvent.change(await screen.findByLabelText('Количество за връщане: Widget'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Върни' }));
    expect(await screen.findByText(/Печат на бележка/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
