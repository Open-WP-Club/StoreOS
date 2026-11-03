import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureBase,
  detectConflict,
  freshStockDeltaData,
  singleItemOp,
  withoutHeldItem,
} from '../offlineConflicts';
import { replayOperation } from '../offlineReplay';
import useCache from '../../stores/cacheStore';
import useOffline from '../../stores/offlineStore';
import useStoreConfig from '../../stores/storeConfigStore';
import type { PendingOperation, PendingOperationType } from '../../types';

const OLD = '2024-01-01T10:00:00';
const NEW = '2024-01-02T10:00:00';
const ok = { success: true, data: {} };
const got = (data: Record<string, unknown>) => vi.fn().mockResolvedValue({ success: true, data });

const op = (
  type: PendingOperationType,
  data: Record<string, unknown>,
  base?: PendingOperation['base']
): PendingOperation => ({ id: 'x', type, data, storeId: 's1', timestamp: 1, retryCount: 0, base });

const svc = () => ({
  getProduct: vi.fn(),
  getProductCategory: vi.fn(),
  getProductAttribute: vi.fn(),
  getAttributeTerm: vi.fn(),
  getTaxRate: vi.fn(),
  getReview: vi.fn(),
  getProductVariation: vi.fn(),
  updateProductCategory: vi.fn().mockResolvedValue(ok),
  updateProductAttribute: vi.fn().mockResolvedValue(ok),
  updateAttributeTerm: vi.fn().mockResolvedValue(ok),
  updateTaxRate: vi.fn().mockResolvedValue(ok),
  updateReview: vi.fn().mockResolvedValue(ok),
  updateProductVariation: vi.fn().mockResolvedValue(ok),
  batchProducts: vi.fn().mockResolvedValue(ok),
  batchCoupons: vi.fn().mockResolvedValue(ok),
  batchOrders: vi.fn().mockResolvedValue(ok),
  batchProductVariations: vi.fn().mockResolvedValue(ok),
  getCoupon: vi.fn(),
  getOrder: vi.fn(),
});
type Svc = ReturnType<typeof svc>;
const detect = (s: Svc, o: PendingOperation) => detectConflict(s as never, o);
const run = (s: Svc, o: PendingOperation) => replayOperation(s as never, o);
const snap = (prev: Record<string, unknown>) => ({ modified: OLD, prev });

describe('untimed resources (value-based detection)', () => {
  let s: Svc;
  beforeEach(() => {
    s = svc();
  });
  const cases: Array<[PendingOperationType, Record<string, unknown>, keyof Svc]> = [
    ['update_category', { id: 4, name: 'Mine' }, 'getProductCategory'],
    ['update_attribute', { id: 4, name: 'Mine' }, 'getProductAttribute'],
    ['update_attribute_term', { attributeId: 2, id: 4, name: 'Mine' }, 'getAttributeTerm'],
    ['update_tax_rate', { id: 4, name: 'Mine' }, 'getTaxRate'],
    ['update_review', { id: 4, name: 'Mine' }, 'getReview'],
  ];
  const base = { modified: '', prev: { name: 'Old' } };

  it.each(cases)(
    '%s: same field changed on server -> conflict, nothing sent',
    async (type, data, getter) => {
      (s[getter] as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { id: 4, name: 'Theirs' },
      });
      const o = op(type, data, base);
      const c = await detect(s, o);
      expect(c?.fields).toEqual(['name']);
      expect(c?.server).toEqual({ name: 'Theirs' });
      const r = await run(s, o);
      expect(r.conflict?.fields).toEqual(['name']);
      expect(s.updateProductCategory).not.toHaveBeenCalled();
      expect(s.updateProductAttribute).not.toHaveBeenCalled();
      expect(s.updateAttributeTerm).not.toHaveBeenCalled();
      expect(s.updateTaxRate).not.toHaveBeenCalled();
      expect(s.updateReview).not.toHaveBeenCalled();
    }
  );

  it.each(cases)(
    '%s: unchanged / already mine / other field / fetch failure -> no conflict',
    async (type, data, getter) => {
      const g = s[getter] as ReturnType<typeof vi.fn>;
      for (const server of [
        { id: 4, name: 'Old' },
        { id: 4, name: 'Mine' },
        { id: 4, name: 'Old', x: 1 },
      ]) {
        g.mockResolvedValue({ success: true, data: server });
        expect(await detect(s, op(type, data, base))).toBeNull();
      }
      g.mockResolvedValue({ success: false, error: 'gone' });
      expect(await detect(s, op(type, data, base))).toBeNull();
    }
  );

  it('term fetch uses attributeId + id; fields missing from the snapshot are not compared', async () => {
    s.getAttributeTerm = got({ id: 4, name: 'Old', slug: 'zzz' });
    const o = op(
      'update_attribute_term',
      { attributeId: 2, id: 4, name: 'Mine', slug: 'mine' },
      base
    );
    expect(await detect(s, o)).toBeNull();
    expect(s.getAttributeTerm).toHaveBeenCalledWith(2, 4);
  });

  it('non-conflicting op replays with the right call', async () => {
    s.getTaxRate = got({ id: 4, name: 'Old' });
    await run(s, op('update_tax_rate', { id: 4, name: 'Mine' }, base));
    expect(s.updateTaxRate).toHaveBeenCalledWith(4, { id: 4, name: 'Mine' });
  });

  it('legacy ops (no snapshot) replay without any fetch', async () => {
    await run(s, op('update_category', { id: 4, name: 'x' }));
    await run(s, op('update_attribute', { id: 4, name: 'x' }));
    await run(s, op('update_attribute_term', { attributeId: 2, id: 4, name: 'x' }));
    await run(s, op('update_tax_rate', { id: 4, name: 'x' }));
    await run(s, op('update_review', { id: 4, status: 'approved' }));
    await run(s, op('update_variation', { productId: 1, id: 4, regular_price: '1' }));
    for (const g of [
      s.getProductCategory,
      s.getProductAttribute,
      s.getAttributeTerm,
      s.getTaxRate,
      s.getReview,
      s.getProductVariation,
    ]) {
      expect(g).not.toHaveBeenCalled();
    }
    expect(s.updateProductVariation).toHaveBeenCalledWith(1, 4, {
      productId: 1,
      id: 4,
      regular_price: '1',
    });
  });
});

describe('update_variation (timed)', () => {
  it('uses date_modified_gmt and the product id', async () => {
    const s = svc();
    const o = op(
      'update_variation',
      { productId: 1, id: 4, regular_price: '5' },
      snap({ regular_price: '3' })
    );
    s.getProductVariation = got({ id: 4, regular_price: '9', date_modified_gmt: OLD });
    expect(await detect(s, o)).toBeNull();
    s.getProductVariation = got({ id: 4, regular_price: '9', date_modified_gmt: NEW });
    const c = await detect(s, o);
    expect(c?.fields).toEqual(['regular_price']);
    expect(s.getProductVariation).toHaveBeenCalledWith(1, 4);
  });
});

describe('captureBase for new types', () => {
  beforeEach(() => {
    useStoreConfig.setState({ currentStoreId: 's1' } as never);
    useOffline.setState({ pendingOperations: [] });
    const c = useCache.getState().cache;
    useCache.setState({
      cache: {
        ...c,
        products: {
          ...c.products,
          data: [
            { id: 5, name: 'P5', date_modified_gmt: OLD },
            { id: 6, name: 'P6', date_modified_gmt: OLD },
          ],
        },
        coupons: { ...c.coupons, data: [{ id: 3, amount: '10', date_modified_gmt: OLD }] },
      },
    } as never);
  });

  it('untimed: snapshots from the supplied current item, only known fields', () => {
    const cur = [{ id: 4, name: 'Old', slug: 's' }];
    expect(captureBase('update_category', { id: 4, name: 'N', parent: 1 }, 's1', cur)).toEqual({
      modified: '',
      prev: { name: 'Old' },
    });
    expect(captureBase('update_category', { id: 4, name: 'N' }, 's1', [])).toBeUndefined();
    expect(captureBase('update_category', { id: 4, name: 'N' }, 's1')).toBeUndefined();
    expect(captureBase('update_category', { id: 4, name: 'N' }, 'other', cur)).toBeUndefined();
  });

  it('untimed: a second queued edit keeps the first edit server baseline', () => {
    // The UI already shows my 1st edit ("A"); the server value is still "Old".
    const cur = [{ id: 4, name: 'A', slug: 's' }];
    const first = { modified: '', prev: { name: 'Old' } };
    useOffline.getState().addPendingOperation('update_category', { id: 4, name: 'A' }, 's1', first);
    expect(captureBase('update_category', { id: 4, name: 'B' }, 's1', cur)).toEqual(first);
    // A field the 1st edit didn't touch is taken from the item as shown.
    expect(
      captureBase('update_category', { id: 4, name: 'B', slug: 'z' }, 's1', cur)?.prev
    ).toEqual({ name: 'Old', slug: 's' });
  });

  it('untimed: a second edit after a legacy first edit (no baseline) stays unchecked', () => {
    useOffline.getState().addPendingOperation('update_category', { id: 4, name: 'A' }, 's1');
    expect(
      captureBase('update_category', { id: 4, name: 'B' }, 's1', [{ id: 4, name: 'A' }])
    ).toBeUndefined();
  });

  it('untimed: the 2nd edit still detects a server change against the original baseline', async () => {
    const cur = [{ id: 4, name: 'A' }];
    useOffline.getState().addPendingOperation('update_category', { id: 4, name: 'A' }, 's1', {
      modified: '',
      prev: { name: 'Old' },
    });
    const base = captureBase('update_category', { id: 4, name: 'B' }, 's1', cur);
    const s = svc();
    s.getProductCategory.mockResolvedValue({ success: true, data: { id: 4, name: 'Theirs' } });
    const r = await run(s, op('update_category', { id: 4, name: 'B' }, base));
    expect(r.conflict?.fields).toEqual(['name']);
    expect(s.updateProductCategory).not.toHaveBeenCalled();
  });

  it('batch_reviews snapshots (untimed, from supplied current items)', () => {
    const b = captureBase('batch_reviews', { update: [{ id: 8, status: 'approved' }] }, 's1', [
      { id: 8, status: 'hold' },
    ]);
    expect(b?.items?.['8']).toEqual({ modified: '', prev: { status: 'hold' } });
  });

  it('batch delete snapshots timed items only', () => {
    expect(captureBase('batch_products', { delete: [5] }, 's1')?.items).toEqual({
      '5': { modified: OLD, prev: {} },
    });
  });

  it('timed variation needs a modified date', () => {
    const data = { productId: 1, id: 4, regular_price: '1' };
    expect(
      captureBase('update_variation', data, 's1', { id: 4, regular_price: '0' })
    ).toBeUndefined();
    expect(
      captureBase('update_variation', data, 's1', {
        id: 4,
        regular_price: '0',
        date_modified_gmt: OLD,
      })
    ).toEqual({ modified: OLD, prev: { regular_price: '0' } });
  });

  it('batch: per-item snapshots from the cache; uncached items skipped; none -> undefined', () => {
    const b = captureBase(
      'batch_products',
      {
        update: [
          { id: 5, name: 'x' },
          { id: 99, name: 'y' },
        ],
      },
      's1'
    );
    expect(b).toEqual({ modified: '', prev: {}, items: { '5': snap({ name: 'P5' }) } });
    expect(
      captureBase('batch_products', { update: [{ id: 99, name: 'y' }] }, 's1')
    ).toBeUndefined();
    expect(captureBase('batch_products', { delete: [99] }, 's1')).toBeUndefined();
    expect(
      captureBase('batch_coupons', { update: [{ id: 3, amount: '1' }] }, 's1')?.items?.['3']?.prev
    ).toEqual({ amount: '10' });
  });

  it('batch_variations snapshots from supplied current items', () => {
    const b = captureBase(
      'batch_variations',
      { productId: 1, update: [{ id: 4, regular_price: '1' }] },
      's1',
      [{ id: 4, regular_price: '0', date_modified_gmt: OLD }]
    );
    expect(b?.items?.['4']).toEqual(snap({ regular_price: '0' }));
  });
});

describe('batch replay with per-item conflicts', () => {
  let s: Svc;
  const batch = (type: PendingOperationType, extra: Record<string, unknown> = {}) =>
    op(
      type,
      {
        update: [
          { id: 1, name: 'A2' },
          { id: 2, name: 'B2' },
        ],
        ...extra,
      },
      { modified: '', prev: {}, items: { '1': snap({ name: 'A' }), '2': snap({ name: 'B' }) } }
    );
  const server = (id: number, name: string, modified: string) => ({
    success: true,
    data: { id, name, date_modified_gmt: modified },
  });
  beforeEach(() => {
    s = svc();
  });

  it('partial conflict: clean item is sent, conflicting item is held and reported', async () => {
    s.getProduct.mockImplementation(async (id: number) =>
      id === 1 ? server(1, 'A', OLD) : server(2, 'Theirs', NEW)
    );
    const r = await run(s, batch('batch_products', { delete: [9] }));
    expect(r.success).toBe(true);
    expect(s.batchProducts).toHaveBeenCalledWith({ update: [{ id: 1, name: 'A2' }], delete: [9] });
    expect(r.held?.data).toEqual({ update: [{ id: 2, name: 'B2' }] });
    expect(r.held?.base.items).toEqual({ '2': snap({ name: 'B' }) });
    expect(r.held?.conflict.items).toEqual([
      { id: 2, fields: ['name'], server: { name: 'Theirs' } },
    ]);
  });

  it('all items conflict: nothing sent', async () => {
    s.getProduct.mockImplementation(async (id: number) => server(id, 'T', NEW));
    const r = await run(s, batch('batch_products'));
    expect(s.batchProducts).not.toHaveBeenCalled();
    expect(r.success).toBe(true);
    expect(r.held?.conflict.items).toHaveLength(2);
  });

  it('no conflicts: whole batch replays, nothing held', async () => {
    s.getProduct.mockImplementation(async (id: number) => server(id, id === 1 ? 'A' : 'B', NEW));
    const r = await run(s, batch('batch_products'));
    expect(r.held).toBeUndefined();
    expect(s.batchProducts).toHaveBeenCalledWith({
      update: [
        { id: 1, name: 'A2' },
        { id: 2, name: 'B2' },
      ],
    });
  });

  it('failed clean batch returns the failure and holds nothing (original op retried)', async () => {
    s.getProduct.mockImplementation(async (id: number) =>
      id === 1 ? server(1, 'A', OLD) : server(2, 'Theirs', NEW)
    );
    s.batchProducts.mockResolvedValue({ success: false, error: 'boom' });
    expect(await run(s, batch('batch_products'))).toEqual({ success: false, error: 'boom' });
  });

  it('items without a snapshot or unfetchable items are sent', async () => {
    s.getProduct.mockResolvedValue({ success: false, error: 'x' });
    const o = batch('batch_products');
    o.base = { modified: '', prev: {}, items: { '1': snap({ name: 'A' }) } };
    const r = await run(s, o);
    expect(r.held).toBeUndefined();
    expect(s.batchProducts).toHaveBeenCalled();
  });

  it('batch_orders and batch_coupons use their own getters and calls', async () => {
    s.getOrder = got({ id: 1, status: 'cancelled', date_modified_gmt: NEW });
    const orders = op(
      'batch_orders',
      { update: [{ id: 1, status: 'completed' }] },
      { modified: '', prev: {}, items: { '1': snap({ status: 'processing' }) } }
    );
    expect((await run(s, orders)).held?.conflict.items?.[0]?.fields).toEqual(['status']);
    expect(s.batchOrders).not.toHaveBeenCalled();

    s.getCoupon = got({ id: 1, amount: '99', date_modified_gmt: NEW });
    const coupons = op(
      'batch_coupons',
      { update: [{ id: 1, amount: '5' }] },
      { modified: '', prev: {}, items: { '1': snap({ amount: '10' }) } }
    );
    expect((await run(s, coupons)).held?.conflict.items?.[0]?.server).toEqual({ amount: '99' });
  });

  it('batch_variations: scoped by product, conflicting item held, other sent', async () => {
    s.getProductVariation.mockImplementation(async (_p: number, id: number) => ({
      success: true,
      data: { id, regular_price: id === 4 ? '9' : '2', date_modified_gmt: NEW },
    }));
    const vars = op(
      'batch_variations',
      {
        productId: 7,
        update: [
          { id: 4, regular_price: '1' },
          { id: 5, regular_price: '2' },
        ],
      },
      {
        modified: '',
        prev: {},
        items: { '4': snap({ regular_price: '3' }), '5': snap({ regular_price: '2' }) },
      }
    );
    const r = await run(s, vars);
    expect(s.getProductVariation).toHaveBeenCalledWith(7, 4);
    expect(r.held?.data).toEqual({ productId: 7, update: [{ id: 4, regular_price: '1' }] });
    expect(s.batchProductVariations).toHaveBeenCalledWith(7, {
      update: [{ id: 5, regular_price: '2' }],
    });
  });

  it('legacy batch ops (no snapshot) replay whole without any fetch', async () => {
    const o = batch('batch_products');
    o.base = undefined;
    await run(s, o);
    expect(s.getProduct).not.toHaveBeenCalled();
    expect(s.batchProducts).toHaveBeenCalledTimes(1);
  });
});

describe('resolution helpers', () => {
  const held = (): PendingOperation => ({
    ...op(
      'batch_products',
      {
        update: [
          { id: 1, name: 'a' },
          { id: 2, name: 'b' },
        ],
      },
      { modified: '', prev: {}, items: { '1': snap({ name: 'x' }), '2': snap({ name: 'y' }) } }
    ),
    conflict: {
      fields: [],
      server: {},
      items: [
        { id: 1, fields: ['name'], server: { name: 'S1' } },
        { id: 2, fields: ['name'], server: { name: 'S2' } },
      ],
    },
  });

  it('singleItemOp keeps only that item and drops snapshot/conflict', () => {
    const o = singleItemOp(held(), 2);
    expect(o.data.update).toEqual([{ id: 2, name: 'b' }]);
    expect(o.base).toBeUndefined();
    expect(o.conflict).toBeUndefined();
  });

  it('withoutHeldItem removes one item, null when none remain', () => {
    const next = withoutHeldItem(held(), 1)!;
    expect(next.data?.update).toEqual([{ id: 2, name: 'b' }]);
    expect(Object.keys(next.base?.items ?? {})).toEqual(['2']);
    expect(next.conflict?.items).toEqual([{ id: 2, fields: ['name'], server: { name: 'S2' } }]);
    expect(withoutHeldItem({ ...held(), ...next } as PendingOperation, 2)).toBeNull();
  });

  it('freshStockDeltaData re-reads the server quantity', async () => {
    const s = svc();
    s.getProduct = got({ id: 5, stock_quantity: 50 });
    const o: PendingOperation = {
      ...op('update_stock', { id: 5, stock_quantity: 7, stock_status: 'instock' }),
      conflict: { fields: ['stock_quantity'], server: { stock_quantity: 20 }, stockDelta: -3 },
    };
    expect(await freshStockDeltaData(s as never, o)).toEqual({
      id: 5,
      stock_quantity: 47,
      stock_status: 'instock',
    });
    s.getProduct = vi.fn().mockResolvedValue({ success: false, error: 'x' });
    expect(await freshStockDeltaData(s as never, o)).toBeNull();
  });
});
