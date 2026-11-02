import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import OfflineIndicator from '../OfflineIndicator';
import useOffline from '../../stores/offlineStore';

const svc = {
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  deleteCoupon: vi.fn(),
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
    sel({ getCurrentStore: () => ({ id: 's1', url: 'https://shop.test', consumerKey: 'ck_test', consumerSecret: 'cs_test' }) }),
}));
vi.mock('../../services/woocommerce', () => ({
  default: class {
    createOrder = svc.createOrder;
    updateOrder = svc.updateOrder;
    deleteCoupon = svc.deleteCoupon;
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
    useOffline.getState().addPendingOperation('create_order', { clientId: 'c1', line_items: [] }, 's1');
    render(<OfflineIndicator />);
    await flush(2100);
    await flush(600);
    expect(replayPosSale).toHaveBeenCalled();
    expect(svc.createOrder).not.toHaveBeenCalled();
    expect(useOffline.getState().pendingOperations).toHaveLength(0);
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
    svc.createOrder.mockRejectedValue(new Error('net'));
    useOffline.getState().addPendingOperation('create_order', { total: '1' }, 's1');
    render(<OfflineIndicator />);
    fireEvent.click(screen.getByText(/1 pending/));
    await act(async () => {
      fireEvent.click(screen.getByText('Sync Now'));
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(useOffline.getState().pendingOperations[0]!.lastError).toBe('net');
  });
});
