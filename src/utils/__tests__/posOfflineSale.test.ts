import { vi } from 'vitest';
import {
  CLIENT_ID_META,
  RECENT_TRANSACTIONS_KEY,
  createOrderIdempotent,
  decrementCachedStock,
  isOfflineFailure,
  replayPosSale,
  resolvePendingSale,
} from '../posOfflineSale';
import useCache from '../../stores/cacheStore';
import useStoreConfig from '../../stores/storeConfigStore';

const orderWith = (id: number, clientId: string) =>
  ({ id, meta_data: [{ key: CLIENT_ID_META, value: clientId }] }) as never;

describe('createOrderIdempotent', () => {
  const getOrders = vi.fn();
  const createOrder = vi.fn();
  const svc = { getOrders, createOrder };

  it('returns the existing order instead of creating a duplicate', async () => {
    getOrders.mockResolvedValue({ success: true, data: [orderWith(9, 'abc')] });
    const res = await createOrderIdempotent(svc, { a: 1 }, 'abc', Date.now());
    expect(res).toEqual({ success: true, data: expect.objectContaining({ id: 9 }) });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('creates when no order has the client id', async () => {
    getOrders.mockResolvedValue({ success: true, data: [orderWith(1, 'other')] });
    createOrder.mockResolvedValue({ success: true, data: { id: 2 } });
    const res = await createOrderIdempotent(svc, { a: 1 }, 'abc', Date.now());
    expect(createOrder).toHaveBeenCalledWith({ a: 1 });
    expect(res.success).toBe(true);
  });

  it('does NOT create when the lookup fails (no duplicate risk)', async () => {
    getOrders.mockResolvedValue({ success: false, error: 'down', code: 'offline' });
    const res = await createOrderIdempotent(svc, {}, 'abc', Date.now());
    expect(res.success).toBe(false);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('pages through full result pages to find the order', async () => {
    const full = Array.from({ length: 100 }, (_, i) => orderWith(i, 'x'));
    getOrders
      .mockResolvedValueOnce({ success: true, data: full })
      .mockResolvedValueOnce({ success: true, data: [orderWith(500, 'abc')] });
    const res = await createOrderIdempotent(svc, {}, 'abc', Date.now());
    expect(res.success && res.data.id).toBe(500);
    expect(createOrder).not.toHaveBeenCalled();
  });
});

describe('replayPosSale / resolvePendingSale', () => {
  beforeEach(() => {
    localStorage.setItem(
      RECENT_TRANSACTIONS_KEY,
      JSON.stringify([
        { id: 0, pending: true, clientId: 'abc', total: 5 },
        { id: 3, total: 1 },
      ])
    );
  });

  it('marks the local transaction synced with the real order id', async () => {
    const svc = {
      getOrders: vi.fn().mockResolvedValue({ success: true, data: [] }),
      createOrder: vi.fn().mockResolvedValue({ success: true, data: { id: 77 } }),
    };
    await replayPosSale(svc, { clientId: 'abc', order: {} }, Date.now());
    const list = JSON.parse(localStorage.getItem(RECENT_TRANSACTIONS_KEY)!);
    expect(list[0]).toMatchObject({ id: 77, pending: false });
  });

  it('leaves the pending transaction on failure', async () => {
    const svc = {
      getOrders: vi.fn().mockResolvedValue({ success: true, data: [] }),
      createOrder: vi.fn().mockResolvedValue({ success: false, error: 'nope' }),
    };
    await replayPosSale(svc, { clientId: 'abc', order: {} }, Date.now());
    expect(JSON.parse(localStorage.getItem(RECENT_TRANSACTIONS_KEY)!)[0].pending).toBe(true);
  });

  it('removes the transaction when discarded', () => {
    resolvePendingSale('abc', null);
    const list = JSON.parse(localStorage.getItem(RECENT_TRANSACTIONS_KEY)!);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(3);
  });
});

describe('isOfflineFailure', () => {
  it('flags offline/timeout only', () => {
    expect(isOfflineFailure({ success: false, code: 'offline' })).toBe(true);
    expect(isOfflineFailure({ success: false, code: 'timeout' })).toBe(true);
    expect(isOfflineFailure({ success: false })).toBe(false);
    expect(isOfflineFailure({ success: true })).toBe(false);
  });
});

describe('decrementCachedStock', () => {
  it('decrements managed-stock products and persists via setCachedProducts', async () => {
    const setCachedProducts = vi.fn().mockResolvedValue(undefined);
    useStoreConfig.setState({ currentStoreId: 's1' });
    useCache.setState({
      setCachedProducts,
      cache: {
        ...useCache.getState().cache,
        products: {
          data: [
            {
              id: 1,
              manage_stock: true,
              stock_quantity: 3,
              stock_status: 'instock',
              backorders: 'no',
            },
            { id: 2, manage_stock: false, stock_quantity: null, stock_status: 'instock' },
          ],
          timestamp: 123,
          storeId: 's1',
          lastSync: null,
        },
      },
    } as never);
    await decrementCachedStock([
      { productId: 1, quantity: 3 },
      { productId: 2, quantity: 1 },
    ]);
    const [next, storeId, ts] = setCachedProducts.mock.calls[0]!;
    expect(next[0]).toMatchObject({ stock_quantity: 0, stock_status: 'outofstock' });
    expect(next[1].stock_quantity).toBeNull();
    expect([storeId, ts]).toEqual(['s1', 123]);
  });
});
