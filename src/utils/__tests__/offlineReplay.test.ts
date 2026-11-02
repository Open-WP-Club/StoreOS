import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replayOperation } from '../offlineReplay';
import useOffline from '../../stores/offlineStore';
import type { PendingOperation, PendingOperationType } from '../../types';

const op = (type: PendingOperationType, data: Record<string, unknown>): PendingOperation => ({
  id: 'x',
  type,
  data,
  storeId: 's1',
  timestamp: 1,
  retryCount: 0,
});

const ok = { success: true, data: {} };
const svc = () => ({
  deleteProduct: vi.fn(),
  batchProducts: vi.fn(),
  batchOrders: vi.fn(),
  batchCoupons: vi.fn(),
  deleteCoupon: vi.fn(),
  updateOrder: vi.fn(),
});
const run = (s: ReturnType<typeof svc>, o: PendingOperation) => replayOperation(s as never, o);

describe('replayOperation', () => {
  let s: ReturnType<typeof svc>;
  beforeEach(() => {
    s = svc();
  });

  it('delete_product calls deleteProduct', async () => {
    s.deleteProduct.mockResolvedValue(ok);
    expect((await run(s, op('delete_product', { id: 7 }))).success).toBe(true);
    expect(s.deleteProduct).toHaveBeenCalledWith(7);
  });

  it('delete_product / delete_coupon treat already-deleted as success', async () => {
    s.deleteProduct.mockResolvedValue({ success: false, error: 'Invalid ID.' });
    s.deleteCoupon.mockResolvedValue({ success: false, error: 'Resource not found (404)' });
    expect((await run(s, op('delete_product', { id: 7 }))).success).toBe(true);
    expect((await run(s, op('delete_coupon', { id: 7 }))).success).toBe(true);
  });

  it('delete_product keeps real errors as failures', async () => {
    s.deleteProduct.mockResolvedValue({ success: false, error: 'Forbidden' });
    expect((await run(s, op('delete_product', { id: 7 }))).success).toBe(false);
  });

  it('batch_products passes ops through', async () => {
    s.batchProducts.mockResolvedValue({ success: true, data: { update: [{ id: 1 }] } });
    const data = { update: [{ id: 1, regular_price: '5' }], delete: [2] };
    expect((await run(s, op('batch_products', data))).success).toBe(true);
    expect(s.batchProducts).toHaveBeenCalledWith(data);
  });

  it('batch_products fails when an update item errors (partial failure)', async () => {
    s.batchProducts.mockResolvedValue({
      success: true,
      data: { update: [{ id: 1 }, { id: 2, error: { code: 'x', message: 'bad' } }] },
    });
    const r = await run(s, op('batch_products', { update: [{ id: 1 }, { id: 2 }] }));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/1 batch item/);
  });

  it('batch delete ignores already-gone items but fails on others', async () => {
    s.batchProducts.mockResolvedValueOnce({
      success: true,
      data: {
        delete: [
          { id: 1, error: { code: 'woocommerce_rest_product_invalid_id', message: 'Invalid ID.' } },
        ],
      },
    });
    expect((await run(s, op('batch_products', { delete: [1] }))).success).toBe(true);
    s.batchProducts.mockResolvedValueOnce({
      success: true,
      data: { delete: [{ id: 1, error: { code: 'cant_delete', message: 'Forbidden' } }] },
    });
    expect((await run(s, op('batch_products', { delete: [1] }))).success).toBe(false);
  });

  it('batch_orders replays status updates', async () => {
    s.batchOrders.mockResolvedValue(ok);
    const data = { update: [{ id: 1, status: 'completed' }] };
    expect((await run(s, op('batch_orders', data))).success).toBe(true);
    expect(s.batchOrders).toHaveBeenCalledWith(data);
  });

  it('batch_coupons replays deletes and propagates API failure', async () => {
    s.batchCoupons.mockResolvedValue({ success: false, error: 'boom' });
    const r = await run(s, op('batch_coupons', { delete: [1, 2] }));
    expect(s.batchCoupons).toHaveBeenCalledWith({ delete: [1, 2] });
    expect(r).toEqual({ success: false, error: 'boom' });
  });

  it('batch_products import with creates and updates', async () => {
    s.batchProducts.mockResolvedValue({
      success: true,
      data: { create: [{ id: 9 }], update: [{ id: 1 }] },
    });
    const data = { create: [{ sku: 'A', name: 'A' }], update: [{ id: 1, name: 'B' }] };
    expect((await run(s, op('batch_products', data))).success).toBe(true);
    expect(s.batchProducts).toHaveBeenCalledWith(data);
  });

  it('update_order replays the status change (service chosen by caller per storeId)', async () => {
    s.updateOrder.mockResolvedValue(ok);
    await run(s, { ...op('update_order', { id: 5, status: 'completed' }), storeId: 'other' });
    expect(s.updateOrder).toHaveBeenCalledWith(5, { id: 5, status: 'completed' });
  });

  it('unknown type fails', async () => {
    expect((await run(s, op('refund' as never, {}))).success).toBe(false);
  });
});

describe('queue order', () => {
  beforeEach(() => useOffline.getState().clearPendingOperations());

  it('keeps FIFO order and the storeId of each operation', () => {
    const { addPendingOperation } = useOffline.getState();
    addPendingOperation('update_order', { id: 1, status: 'completed' }, 'a');
    addPendingOperation('batch_products', { delete: [1] }, 'b');
    addPendingOperation('delete_product', { id: 2 }, 'a');
    const ops = useOffline.getState().pendingOperations;
    expect(ops.map((o) => o.type)).toEqual(['update_order', 'batch_products', 'delete_product']);
    expect(ops.map((o) => o.storeId)).toEqual(['a', 'b', 'a']);
  });
});
