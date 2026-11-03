import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replayOperation } from '../offlineReplay';
import { singleItemOp, withoutHeldItem } from '../offlineConflicts';
import type { PendingOperation, PendingOperationType } from '../../types';

const OLD = '2024-01-01T10:00:00';
const NEW = '2024-01-02T10:00:00';
const ok = { success: true, data: {} };

const op = (
  type: PendingOperationType,
  data: Record<string, unknown>,
  items?: Record<string, { modified: string; prev: Record<string, unknown> }>
): PendingOperation => ({
  id: 'x',
  type,
  data,
  storeId: 's1',
  timestamp: 1,
  retryCount: 0,
  base: items ? { modified: '', prev: {}, items } : undefined,
});

const svc = () => ({
  getProduct: vi.fn(),
  getReview: vi.fn(),
  getProducts: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCoupons: vi.fn().mockResolvedValue({ success: true, data: [] }),
  batchProducts: vi.fn().mockResolvedValue(ok),
  batchCoupons: vi.fn().mockResolvedValue(ok),
  batchUpdateReviews: vi.fn().mockResolvedValue(ok),
});
type Svc = ReturnType<typeof svc>;
const run = (s: Svc, o: PendingOperation) => replayOperation(s as never, o);
const server = (id: number, modified: string) => ({
  success: true,
  data: { id, date_modified_gmt: modified },
});
const snap = { modified: OLD, prev: {} };

describe('batch delete conflicts', () => {
  let s: Svc;
  beforeEach(() => {
    s = svc();
  });
  const del = () => op('batch_products', { delete: [1, 2] }, { '1': snap, '2': snap });

  it('holds a delete when the item changed on the server, sends the others', async () => {
    s.getProduct.mockImplementation(async (id: number) => server(id, id === 1 ? OLD : NEW));
    const r = await run(s, del());
    expect(s.batchProducts).toHaveBeenCalledWith({ delete: [1] });
    expect(r.success).toBe(true);
    expect(r.held?.data).toEqual({ delete: [2] });
    expect(r.held?.conflict.items).toEqual([
      { id: 2, fields: ['deleted'], server: { deleted: false } },
    ]);
  });

  it('all deletes unchanged on the server: whole batch is sent, nothing held', async () => {
    s.getProduct.mockImplementation(async (id: number) => server(id, OLD));
    const r = await run(s, del());
    expect(s.batchProducts).toHaveBeenCalledWith({ delete: [1, 2] });
    expect(r.held).toBeUndefined();
  });

  it('item already gone (unfetchable): delete is still sent', async () => {
    s.getProduct.mockResolvedValue({ success: false, error: 'Invalid ID' });
    await run(s, del());
    expect(s.batchProducts).toHaveBeenCalledWith({ delete: [1, 2] });
  });

  it('every delete held: nothing sent', async () => {
    s.getProduct.mockImplementation(async (id: number) => server(id, NEW));
    const r = await run(s, del());
    expect(s.batchProducts).not.toHaveBeenCalled();
    expect(r.held?.data).toEqual({ delete: [1, 2] });
  });

  it('mixed update + delete batch: both held when both conflict', async () => {
    const o = op(
      'batch_products',
      { update: [{ id: 1, name: 'a' }], delete: [2] },
      { '1': { modified: OLD, prev: { name: 'x' } }, '2': snap }
    );
    s.getProduct.mockImplementation(async (id: number) => ({
      success: true,
      data: { id, name: id === 1 ? 'Theirs' : 'x', date_modified_gmt: NEW },
    }));
    const r = await run(s, o);
    expect(r.held?.data).toEqual({ update: [{ id: 1, name: 'a' }], delete: [2] });
    expect(s.batchProducts).not.toHaveBeenCalled();
  });

  it('resolution helpers handle held deletes', () => {
    const held = {
      ...op('batch_products', { delete: [1, 2] }, { '1': snap, '2': snap }),
      conflict: {
        fields: [],
        server: {},
        items: [
          { id: 1, fields: ['deleted'], server: { deleted: false } },
          { id: 2, fields: ['deleted'], server: { deleted: false } },
        ],
      },
    };
    expect(singleItemOp(held, 2).data).toEqual({ delete: [2] });
    const next = withoutHeldItem(held, 1)!;
    expect(next.data).toEqual({ delete: [2] });
    expect(withoutHeldItem({ ...held, ...next } as PendingOperation, 2)).toBeNull();
  });
});

describe('batch_reviews conflicts (value-based)', () => {
  it('holds a review whose status changed on the server, sends the rest', async () => {
    const s = svc();
    s.getReview.mockImplementation(async (id: number) => ({
      success: true,
      data: { id, status: id === 1 ? 'hold' : 'spam' },
    }));
    const prev = { modified: '', prev: { status: 'hold' } };
    const o = op(
      'batch_reviews',
      {
        update: [
          { id: 1, status: 'approved' },
          { id: 2, status: 'approved' },
        ],
      },
      { '1': prev, '2': prev }
    );
    const r = await run(s, o);
    expect(s.batchUpdateReviews).toHaveBeenCalledWith([{ id: 1, status: 'approved' }]);
    expect(r.held?.conflict.items).toEqual([
      { id: 2, fields: ['status'], server: { status: 'spam' } },
    ]);
  });

  it('legacy batch_reviews (no snapshot) replays whole without fetching', async () => {
    const s = svc();
    await run(s, op('batch_reviews', { update: [{ id: 1, status: 'approved' }] }));
    expect(s.getReview).not.toHaveBeenCalled();
    expect(s.batchUpdateReviews).toHaveBeenCalledWith([{ id: 1, status: 'approved' }]);
  });
});

describe('batch create duplicates', () => {
  let s: Svc;
  beforeEach(() => {
    s = svc();
  });

  it('products: a create whose SKU already exists is dropped, others are sent', async () => {
    s.getProducts.mockImplementation(async ({ sku }: { sku: string }) => ({
      success: true,
      data: sku === 'A' ? [{ id: 9 }] : [],
    }));
    await run(
      s,
      op('batch_products', { create: [{ sku: 'A' }, { sku: 'B' }, { name: 'no sku' }] })
    );
    expect(s.batchProducts).toHaveBeenCalledWith({ create: [{ sku: 'B' }, { name: 'no sku' }] });
  });

  it('products: everything already exists -> success without calling the batch', async () => {
    s.getProducts.mockResolvedValue({ success: true, data: [{ id: 9 }] });
    const r = await run(s, op('batch_products', { create: [{ sku: 'A' }] }));
    expect(r.success).toBe(true);
    expect(s.batchProducts).not.toHaveBeenCalled();
  });

  it('coupons: existing code is dropped (case-insensitive)', async () => {
    s.getCoupons.mockImplementation(async ({ code }: { code: string }) => ({
      success: true,
      data: code === 'SAVE' ? [{ id: 1, code: 'save' }] : [],
    }));
    await run(s, op('batch_coupons', { create: [{ code: 'SAVE' }, { code: 'NEW' }] }));
    expect(s.batchCoupons).toHaveBeenCalledWith({ create: [{ code: 'NEW' }] });
  });

  it('a failed lookup fails the op instead of creating blindly', async () => {
    s.getProducts.mockResolvedValue({ success: false, error: 'offline' });
    const r = await run(s, op('batch_products', { create: [{ sku: 'A' }] }));
    expect(r.success).toBe(false);
    expect(s.batchProducts).not.toHaveBeenCalled();
  });

  it('updates in the same batch are kept when creates are all dropped', async () => {
    s.getProducts.mockResolvedValue({ success: true, data: [{ id: 9 }] });
    await run(s, op('batch_products', { create: [{ sku: 'A' }], update: [{ id: 1, name: 'n' }] }));
    expect(s.batchProducts).toHaveBeenCalledWith({ update: [{ id: 1, name: 'n' }] });
  });
});
