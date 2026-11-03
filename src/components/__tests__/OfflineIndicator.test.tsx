import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import OfflineIndicator from '../OfflineIndicator';
import useOffline from '../../stores/offlineStore';
import useCache from '../../stores/cacheStore';
import useStoreConfig from '../../stores/storeConfigStore';

const svc = {
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  deleteCoupon: vi.fn(),
  getOrder: vi.fn(),
  getProduct: vi.fn(),
  updateStock: vi.fn(),
  batchProducts: vi.fn(),
};
let online = true;
const checkStatus = vi.fn();
const replayPosSale = vi.fn();
const resolvePendingSale = vi.fn();

vi.mock('../../hooks/useOnlineStatus', () => ({
  default: () => ({ isOnline: online, checkStatus }),
}));
vi.mock('../../stores', () => ({
  useStoreConfig: (sel: (s: unknown) => unknown) =>
    sel({
      stores: [
        {
          id: 's1',
          url: 'https://shop.test',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        },
      ],
    }),
}));
vi.mock('../../services/woocommerce', () => ({
  default: class {
    createOrder = svc.createOrder;
    updateOrder = svc.updateOrder;
    deleteCoupon = svc.deleteCoupon;
    getOrder = svc.getOrder;
    getProduct = svc.getProduct;
    updateStock = svc.updateStock;
    batchProducts = svc.batchProducts;
  },
}));
vi.mock('../../utils/posOfflineSale', () => ({
  replayPosSale: (...a: unknown[]) => replayPosSale(...a),
  resolvePendingSale: (...a: unknown[]) => resolvePendingSale(...a),
}));

const flush = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('OfflineIndicator', () => {
  beforeEach(() => {
    online = true;
    useOffline.setState({ pendingOperations: [] });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('renders nothing when online with no pending ops', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows offline with the pending count and Check Connection', () => {
    online = false;
    useOffline.getState().addPendingOperation('update_order', { id: 1 }, 's1');
    render(<OfflineIndicator />);
    expect(screen.getByText(/Offline · 1 pending/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Offline/));
    fireEvent.click(screen.getByText('Check Connection'));
    expect(checkStatus).toHaveBeenCalled();
  });

  it('auto-syncs after 2s, removing successful ops', async () => {
    svc.updateOrder.mockResolvedValue({ success: true });
    useOffline.getState().addPendingOperation('update_order', { id: 7, status: 'completed' }, 's1');
    render(<OfflineIndicator />);
    await flush(2100);
    await flush(600);
    expect(svc.updateOrder).toHaveBeenCalledWith(7, { id: 7, status: 'completed' });
    expect(useOffline.getState().pendingOperations).toHaveLength(0);
  });

  it('keeps failed ops, records the error and increments retries; Discard removes it', async () => {
    svc.deleteCoupon.mockResolvedValue({ success: false, error: 'locked' });
    useOffline.getState().addPendingOperation('delete_coupon', { id: 3 }, 's1');
    render(<OfflineIndicator />);
    await flush(2100);
    await flush(600);
    const op = useOffline.getState().pendingOperations[0]!;
    expect(op.lastError).toBe('locked');
    expect(op.retryCount).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button')[0]!);
    fireEvent.click(screen.getByText('Discard'));
    expect(useOffline.getState().pendingOperations).toHaveLength(0);
  });

  it('skips ops that belong to another store', async () => {
    useOffline.getState().addPendingOperation('update_order', { id: 1 }, 'other');
    render(<OfflineIndicator />);
    await flush(2100);
    await flush(600);
    expect(svc.updateOrder).not.toHaveBeenCalled();
    expect(useOffline.getState().pendingOperations).toHaveLength(1);
  });

  it('replays POS sales through replayPosSale', async () => {
    replayPosSale.mockResolvedValue({ success: true });
    useOffline
      .getState()
      .addPendingOperation('create_order', { clientId: 'c1', line_items: [] }, 's1');
    render(<OfflineIndicator />);
    await flush(2100);
    await flush(600);
    expect(replayPosSale).toHaveBeenCalled();
    expect(svc.createOrder).not.toHaveBeenCalled();
    expect(useOffline.getState().pendingOperations).toHaveLength(0);
  });

  describe('conflicts', () => {
    const base = { modified: '2024-01-01T10:00:00', prev: { status: 'processing' } };
    const queueConflicted = (): void => {
      svc.getOrder.mockResolvedValue({
        success: true,
        data: { id: 7, status: 'cancelled', date_modified_gmt: '2024-01-02T10:00:00' },
      });
      useOffline
        .getState()
        .addPendingOperation('update_order', { id: 7, status: 'completed' }, 's1', base);
    };
    const open = async (): Promise<void> => {
      render(<OfflineIndicator />);
      await flush(2100);
      await flush(600);
      fireEvent.click(screen.getAllByRole('button')[0]!);
    };

    it('holds a conflicting op unsent with no retry and shows the diff', async () => {
      queueConflicted();
      await open();
      expect(svc.updateOrder).not.toHaveBeenCalled();
      const op = useOffline.getState().pendingOperations[0]!;
      expect(op.conflict?.fields).toEqual(['status']);
      expect(op.retryCount).toBe(0);
      expect(screen.getByTestId('conflict-panel')).toHaveTextContent('completed');
      expect(screen.getByTestId('conflict-panel')).toHaveTextContent('cancelled');
      // not re-checked on later sync cycles
      await flush(5000);
      expect(svc.getOrder).toHaveBeenCalledTimes(1);
    });

    it('Keep mine sends the op and removes it', async () => {
      queueConflicted();
      await open();
      svc.updateOrder.mockResolvedValue({ success: true });
      await act(async () => {
        fireEvent.click(screen.getByText('Keep mine'));
      });
      expect(svc.updateOrder).toHaveBeenCalledWith(7, { id: 7, status: 'completed' });
      expect(useOffline.getState().pendingOperations).toHaveLength(0);
    });

    it('Use server discards the op without sending', async () => {
      queueConflicted();
      await open();
      fireEvent.click(screen.getByText('Use server'));
      expect(svc.updateOrder).not.toHaveBeenCalled();
      expect(useOffline.getState().pendingOperations).toHaveLength(0);
    });

    it('stock conflict offers Apply as delta: server qty + my change', async () => {
      svc.getProduct.mockResolvedValue({
        success: true,
        data: { id: 5, stock_quantity: 20, date_modified_gmt: '2024-01-02T10:00:00' },
      });
      useOffline
        .getState()
        .addPendingOperation(
          'update_stock',
          { id: 5, stock_quantity: 7, stock_status: 'instock' },
          's1',
          {
            modified: '2024-01-01T10:00:00',
            prev: { stock_quantity: 10, stock_status: 'instock' },
          }
        );
      await open();
      svc.updateStock.mockResolvedValue({ success: true });
      await act(async () => {
        fireEvent.click(screen.getByText(/Apply as delta/));
      });
      expect(svc.updateStock).toHaveBeenCalledWith(5, 17, 'instock');
      expect(useOffline.getState().pendingOperations).toHaveLength(0);
    });
  });

  describe('conflict resolution extras', () => {
    const open = async (): Promise<void> => {
      render(<OfflineIndicator />);
      await flush(2100);
      await flush(600);
      fireEvent.click(screen.getAllByRole('button')[0]!);
    };
    const T0 = '2024-01-01T10:00:00';
    const T1 = '2024-01-02T10:00:00';
    const queueBatch = (): void => {
      svc.getProduct.mockImplementation(async (id: number) => ({
        success: true,
        data:
          id === 1
            ? { id, name: 'A', date_modified_gmt: T0 }
            : { id, name: 'Theirs', date_modified_gmt: T1 },
      }));
      svc.batchProducts.mockResolvedValue({ success: true, data: {} });
      useOffline.getState().addPendingOperation(
        'batch_products',
        {
          update: [
            { id: 1, name: 'A2' },
            { id: 2, name: 'B2' },
            { id: 3, name: 'C2' },
          ],
        },
        's1',
        {
          modified: '',
          prev: {},
          items: {
            '1': { modified: T0, prev: { name: 'A' } },
            '2': { modified: T0, prev: { name: 'B' } },
            '3': { modified: T0, prev: { name: 'C' } },
          },
        }
      );
      svc.getProduct.mockImplementation(async (id: number) => ({
        success: true,
        data:
          id === 1
            ? { id, name: 'A', date_modified_gmt: T0 }
            : { id, name: `Theirs${id}`, date_modified_gmt: T1 },
      }));
    };

    it('batch: clean item syncs, conflicting items are held and listed per item', async () => {
      queueBatch();
      await open();
      expect(svc.batchProducts).toHaveBeenCalledWith({ update: [{ id: 1, name: 'A2' }] });
      const ops = useOffline.getState().pendingOperations;
      expect(ops).toHaveLength(1);
      expect(ops[0]!.data.update).toEqual([
        { id: 2, name: 'B2' },
        { id: 3, name: 'C2' },
      ]);
      expect(screen.getAllByTestId('conflict-item')).toHaveLength(2);
      expect(screen.getByTestId('conflict-panel')).toHaveTextContent('Theirs2');
      expect(ops[0]!.retryCount).toBe(0);
    });

    it('batch: Keep mine sends only that item; Use server drops it; op ends when none left', async () => {
      queueBatch();
      await open();
      svc.batchProducts.mockClear();
      await act(async () => {
        fireEvent.click(screen.getAllByText('Keep mine')[0]!);
      });
      expect(svc.batchProducts).toHaveBeenCalledTimes(1);
      expect(svc.batchProducts).toHaveBeenCalledWith({ update: [{ id: 2, name: 'B2' }] });
      expect(useOffline.getState().pendingOperations[0]!.data.update).toEqual([
        { id: 3, name: 'C2' },
      ]);
      await act(async () => {
        fireEvent.click(screen.getByText('Use server'));
      });
      expect(svc.batchProducts).toHaveBeenCalledTimes(1);
      expect(useOffline.getState().pendingOperations).toHaveLength(0);
    });

    it('batch: failed Keep mine leaves the item held', async () => {
      queueBatch();
      await open();
      svc.batchProducts.mockResolvedValue({ success: false, error: 'nope' });
      await act(async () => {
        fireEvent.click(screen.getAllByText('Keep mine')[0]!);
      });
      const op = useOffline.getState().pendingOperations[0]!;
      expect(op.conflict?.items).toHaveLength(2);
      expect(op.lastError).toBe('nope');
    });

    const queueStock = (): void => {
      useOffline
        .getState()
        .addPendingOperation(
          'update_stock',
          { id: 5, stock_quantity: 7, stock_status: 'instock' },
          's1',
          {
            modified: T0,
            prev: { stock_quantity: 10, stock_status: 'instock' },
          }
        );
    };

    it('Apply as delta re-reads the server quantity at click time', async () => {
      svc.getProduct.mockResolvedValue({
        success: true,
        data: { id: 5, stock_quantity: 20, date_modified_gmt: T1 },
      });
      queueStock();
      await open();
      svc.getProduct.mockResolvedValue({
        success: true,
        data: { id: 5, stock_quantity: 30, date_modified_gmt: T1 },
      });
      svc.updateStock.mockResolvedValue({ success: true });
      await act(async () => {
        fireEvent.click(screen.getByText(/Apply as delta/));
      });
      expect(svc.updateStock).toHaveBeenCalledWith(5, 27, 'instock');
    });

    it('Apply as delta: unreadable server quantity sends nothing and keeps the op', async () => {
      svc.getProduct.mockResolvedValue({
        success: true,
        data: { id: 5, stock_quantity: 20, date_modified_gmt: T1 },
      });
      queueStock();
      await open();
      svc.getProduct.mockResolvedValue({ success: false, error: 'x' });
      await act(async () => {
        fireEvent.click(screen.getByText(/Apply as delta/));
      });
      expect(svc.updateStock).not.toHaveBeenCalled();
      expect(useOffline.getState().pendingOperations[0]!.lastError).toMatch(/server quantity/);
    });

    it('every resolution invalidates the cached type for the item', async () => {
      const clear = vi.spyOn(useCache.getState(), 'clearCacheForType').mockResolvedValue();
      useStoreConfig.setState({ currentStoreId: 's1' } as never);
      svc.getOrder.mockResolvedValue({
        success: true,
        data: { id: 7, status: 'cancelled', date_modified_gmt: T1 },
      });
      useOffline
        .getState()
        .addPendingOperation('update_order', { id: 7, status: 'completed' }, 's1', {
          modified: T0,
          prev: { status: 'processing' },
        });
      await open();
      fireEvent.click(screen.getByText('Use server'));
      expect(clear).toHaveBeenCalledWith('orders');
      clear.mockRestore();
    });
  });

  it('discarding a POS sale resolves its pending sale', () => {
    online = false;
    useOffline.getState().addPendingOperation('create_order', { clientId: 'c9' }, 's1');
    const id = useOffline.getState().pendingOperations[0]!.id;
    useOffline.getState().incrementRetryCount(id);
    render(<OfflineIndicator />);
    fireEvent.click(screen.getByText(/Offline/));
    fireEvent.click(screen.getByText('Discard'));
    expect(resolvePendingSale).toHaveBeenCalledWith('c9', null);
  });

  it('Sync Now processes immediately; thrown errors become lastError', async () => {
    svc.updateOrder.mockRejectedValue(new Error('net'));
    useOffline.getState().addPendingOperation('update_order', { id: 1 }, 's1');
    render(<OfflineIndicator />);
    fireEvent.click(screen.getByText(/1 pending/));
    await act(async () => {
      fireEvent.click(screen.getByText('Sync Now'));
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(useOffline.getState().pendingOperations[0]!.lastError).toBe('net');
  });

  it('moves to the bottom-left on the POS route and back on hashchange', () => {
    online = false;
    window.location.hash = '#/pos';
    const { container } = render(<OfflineIndicator />);
    const root = container.firstElementChild!;
    expect(root).toHaveClass('left-4');
    expect(root).not.toHaveClass('right-4');
    act(() => {
      window.location.hash = '#/orders';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(root).toHaveClass('right-4');
    window.location.hash = '';
  });
});
