import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureBase, detectConflict, stockDeltaData } from '../offlineConflicts';
import { replayOperation } from '../offlineReplay';
import useCache from '../../stores/cacheStore';
import useStoreConfig from '../../stores/storeConfigStore';
import type { PendingOperation, PendingOperationType } from '../../types';

const op = (
  type: PendingOperationType,
  data: Record<string, unknown>,
  base?: PendingOperation['base']
): PendingOperation => ({
  id: 'x',
  type,
  data,
  storeId: 's1',
  timestamp: 1,
  retryCount: 0,
  base,
});

const OLD = '2024-01-01T10:00:00';
const NEW = '2024-01-02T10:00:00';
const ok = { success: true, data: {} };

const svc = () => ({
  getProduct: vi.fn(),
  getOrder: vi.fn(),
  getCoupon: vi.fn(),
  updateProduct: vi.fn().mockResolvedValue(ok),
  updateOrder: vi.fn().mockResolvedValue(ok),
  updateCoupon: vi.fn().mockResolvedValue(ok),
  updateStock: vi.fn().mockResolvedValue(ok),
});
type Svc = ReturnType<typeof svc>;
const detect = (s: Svc, o: PendingOperation) => detectConflict(s as never, o);
const run = (s: Svc, o: PendingOperation) => replayOperation(s as never, o);
const baseOf = (prev: Record<string, unknown>) => ({ modified: OLD, prev });

describe('captureBase', () => {
  beforeEach(() => {
    useStoreConfig.setState({ currentStoreId: 's1' } as never);
    const c = useCache.getState().cache;
    useCache.setState({
      cache: {
        ...c,
        products: {
          ...c.products,
          data: [
            {
              id: 5,
              name: 'Old',
              stock_quantity: 10,
              stock_status: 'instock',
              date_modified_gmt: OLD,
            },
          ],
        },
        orders: { ...c.orders, data: [{ id: 7, status: 'processing', date_modified: OLD }] },
      },
    } as never);
  });

  it('records modified date and previous values of the changed fields only', () => {
    expect(captureBase('update_product', { id: 5, name: 'New' }, 's1')).toEqual({
      modified: OLD,
      prev: { name: 'Old' },
    });
  });

  it('falls back to date_modified and works for orders', () => {
    expect(captureBase('update_order', { id: 7, status: 'completed' }, 's1')).toEqual({
      modified: OLD,
      prev: { status: 'processing' },
    });
  });

  it('normalises stock data and ignores meta_data', () => {
    expect(
      captureBase('update_stock', { id: 5, stock_quantity: 3, stock_status: 'instock' }, 's1')
    ).toEqual({ modified: OLD, prev: { stock_quantity: 10, stock_status: 'instock' } });
    expect(captureBase('update_stock', { productId: 5, quantity: 3 }, 's1')?.prev).toEqual({
      stock_quantity: 10,
    });
    expect(captureBase('update_product', { id: 5, meta_data: [] }, 's1')?.prev).toEqual({});
  });

  it('returns undefined for other stores, unknown items and unsupported types', () => {
    expect(captureBase('update_product', { id: 5, name: 'x' }, 'other')).toBeUndefined();
    expect(captureBase('update_product', { id: 99, name: 'x' }, 's1')).toBeUndefined();
    expect(captureBase('delete_product', { id: 5 }, 's1')).toBeUndefined();
  });
});

describe('detectConflict', () => {
  let s: Svc;
  beforeEach(() => {
    s = svc();
  });
  const product = (extra: Record<string, unknown>) => ({
    success: true,
    data: { id: 5, date_modified_gmt: NEW, ...extra },
  });
  const edit = (prev: Record<string, unknown> = { name: 'Old' }) =>
    op('update_product', { id: 5, name: 'Mine' }, baseOf(prev));

  it('no base (legacy op): no check, server not even fetched', async () => {
    expect(await detect(s, op('update_product', { id: 5, name: 'Mine' }))).toBeNull();
    expect(s.getProduct).not.toHaveBeenCalled();
  });

  it('server not modified since base: no conflict', async () => {
    s.getProduct.mockResolvedValue({
      success: true,
      data: { id: 5, name: 'Other', date_modified_gmt: OLD },
    });
    expect(await detect(s, edit())).toBeNull();
  });

  it('newer server with the same field changed: conflict with server values', async () => {
    s.getProduct.mockResolvedValue(product({ name: 'Theirs', price: '9' }));
    const c = await detect(s, edit());
    expect(c?.fields).toEqual(['name']);
    expect(c?.server).toEqual({ name: 'Theirs' });
  });

  it('newer server but only different fields changed: no conflict', async () => {
    s.getProduct.mockResolvedValue(product({ name: 'Old', price: '9' }));
    expect(await detect(s, edit())).toBeNull();
  });

  it('server already has my value: no conflict', async () => {
    s.getProduct.mockResolvedValue(product({ name: 'Mine' }));
    expect(await detect(s, edit())).toBeNull();
  });

  it('reports only the fields that actually conflict', async () => {
    s.getProduct.mockResolvedValue(product({ name: 'Theirs', regular_price: '4' }));
    const o = op(
      'update_product',
      { id: 5, name: 'Mine', regular_price: '5' },
      baseOf({ name: 'Old', regular_price: '4' })
    );
    expect((await detect(s, o))?.fields).toEqual(['name']);
  });

  it('fetch failure or unparseable dates: no conflict (replay as before)', async () => {
    s.getProduct.mockResolvedValue({ success: false, error: 'x' });
    expect(await detect(s, edit())).toBeNull();
    s.getProduct.mockResolvedValue(product({ name: 'Theirs' }));
    const bad = { ...edit(), base: { modified: 'garbage', prev: { name: 'Old' } } };
    expect(await detect(s, bad)).toBeNull();
  });

  it('orders and coupons use their own getters', async () => {
    s.getOrder.mockResolvedValue({
      success: true,
      data: { id: 7, status: 'cancelled', date_modified_gmt: NEW },
    });
    s.getCoupon.mockResolvedValue({
      success: true,
      data: { id: 3, amount: '20', date_modified_gmt: NEW },
    });
    const order = op(
      'update_order',
      { id: 7, status: 'completed' },
      baseOf({ status: 'processing' })
    );
    const coupon = op('update_coupon', { id: 3, amount: '15' }, baseOf({ amount: '10' }));
    expect((await detect(s, order))?.fields).toEqual(['status']);
    expect((await detect(s, coupon))?.fields).toEqual(['amount']);
  });

  it('stock: conflict carries the delta against the expected quantity', async () => {
    s.getProduct.mockResolvedValue(product({ stock_quantity: 20, stock_status: 'instock' }));
    const o = op(
      'update_stock',
      { id: 5, stock_quantity: 7, stock_status: 'instock' },
      baseOf({ stock_quantity: 10, stock_status: 'instock' })
    );
    const c = await detect(s, o);
    expect(c?.fields).toEqual(['stock_quantity']);
    expect(c?.stockDelta).toBe(-3);
  });
});

describe('stockDeltaData', () => {
  const withConflict = (server: number, delta: number, status = 'instock'): PendingOperation => ({
    ...op('update_stock', { id: 5, stock_quantity: 7, stock_status: status }),
    conflict: { fields: ['stock_quantity'], server: { stock_quantity: server }, stockDelta: delta },
  });

  it('adds my delta to the server quantity', () => {
    expect(stockDeltaData(withConflict(20, -3))).toEqual({
      id: 5,
      stock_quantity: 17,
      stock_status: 'instock',
    });
  });

  it('clamps at 0 and marks out of stock (or keeps backorder)', () => {
    expect(stockDeltaData(withConflict(2, -5))?.stock_status).toBe('outofstock');
    expect(stockDeltaData(withConflict(2, -5, 'onbackorder'))).toMatchObject({
      stock_quantity: 0,
      stock_status: 'onbackorder',
    });
  });

  it('null without a stock delta', () => {
    expect(stockDeltaData(op('update_stock', { id: 5 }))).toBeNull();
  });
});

describe('replayOperation with conflicts', () => {
  let s: Svc;
  beforeEach(() => {
    s = svc();
  });

  it('conflict: returns it and does NOT send', async () => {
    s.getOrder.mockResolvedValue({
      success: true,
      data: { id: 7, status: 'cancelled', date_modified_gmt: NEW },
    });
    const r = await run(
      s,
      op('update_order', { id: 7, status: 'completed' }, baseOf({ status: 'processing' }))
    );
    expect(r.success).toBe(false);
    expect(r.conflict?.fields).toEqual(['status']);
    expect(s.updateOrder).not.toHaveBeenCalled();
  });

  it('non-conflicting change with a snapshot replays normally', async () => {
    s.getProduct.mockResolvedValue({
      success: true,
      data: { id: 5, name: 'Old', date_modified_gmt: NEW },
    });
    const r = await run(s, op('update_product', { id: 5, name: 'Mine' }, baseOf({ name: 'Old' })));
    expect(r.success).toBe(true);
    expect(s.updateProduct).toHaveBeenCalledWith(5, { id: 5, name: 'Mine' });
  });

  it('legacy ops (no snapshot) replay without fetching, for every supported type', async () => {
    await run(s, op('update_product', { id: 5, name: 'x' }));
    await run(s, op('update_order', { id: 7, status: 'completed' }));
    await run(s, op('update_coupon', { id: 3, amount: '1' }));
    expect(s.updateProduct).toHaveBeenCalled();
    expect(s.updateOrder).toHaveBeenCalled();
    expect(s.updateCoupon).toHaveBeenCalled();
    expect(s.getProduct).not.toHaveBeenCalled();
    expect(s.getOrder).not.toHaveBeenCalled();
    expect(s.getCoupon).not.toHaveBeenCalled();
  });

  it('update_stock replays queue-shaped and legacy-shaped data', async () => {
    await run(s, op('update_stock', { id: 5, stock_quantity: 3, stock_status: 'instock' }));
    expect(s.updateStock).toHaveBeenLastCalledWith(5, 3, 'instock');
    await run(s, op('update_stock', { productId: 6, quantity: 2, stockStatus: 'outofstock' }));
    expect(s.updateStock).toHaveBeenLastCalledWith(6, 2, 'outofstock');
  });
});
