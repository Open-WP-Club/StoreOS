import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replayOperation } from '../offlineReplay';
import { CLIENT_ID_META } from '../offlineCreates';
import useOffline from '../../stores/offlineStore';
import type { PendingOperation, PendingOperationType } from '../../types';

const op = (type: PendingOperationType, data: Record<string, unknown>): PendingOperation => ({
  id: 'x',
  type,
  data,
  storeId: 's1',
  timestamp: 1_700_000_000_000,
  retryCount: 0,
});

type Svc = Record<(typeof METHODS)[number], ReturnType<typeof vi.fn>>;
const ok = { success: true, data: {} };
const gone = { success: false, error: 'Invalid ID.' };
const bad = { success: false, error: 'Forbidden' };
const list = (data: unknown[]) => ({ success: true, data });

const METHODS = [
  'getProducts',
  'getOrders',
  'createOrder',
  'createProduct',
  'getCoupons',
  'createCoupon',
  'getProductCategories',
  'createProductCategory',
  'updateProductCategory',
  'deleteProductCategory',
  'getProductAttributes',
  'createProductAttribute',
  'updateProductAttribute',
  'deleteProductAttribute',
  'getAttributeTerms',
  'createAttributeTerm',
  'updateAttributeTerm',
  'deleteAttributeTerm',
  'getTaxRates',
  'createTaxRate',
  'updateTaxRate',
  'deleteTaxRate',
  'getTaxClasses',
  'createTaxClass',
  'deleteTaxClass',
  'updateReview',
  'deleteReview',
  'batchUpdateReviews',
  'getProductVariations',
  'createProductVariation',
  'updateProductVariation',
  'deleteProductVariation',
  'batchProductVariations',
] as const;
const svc = () => Object.fromEntries(METHODS.map((m) => [m, vi.fn()])) as Svc;
const run = (s: Svc, o: PendingOperation) => replayOperation(s as never, o);

describe('replay: update/delete cases', () => {
  let s: Svc;
  beforeEach(() => {
    s = svc();
  });

  const cases: Array<[PendingOperationType, Record<string, unknown>, keyof Svc, unknown[]]> = [
    ['update_category', { id: 3, name: 'A' }, 'updateProductCategory', [3]],
    ['delete_category', { id: 3 }, 'deleteProductCategory', [3]],
    ['update_attribute', { id: 3, name: 'A' }, 'updateProductAttribute', [3]],
    ['delete_attribute', { id: 3 }, 'deleteProductAttribute', [3]],
    ['update_attribute_term', { attributeId: 2, id: 3, name: 'A' }, 'updateAttributeTerm', [2, 3]],
    ['delete_attribute_term', { attributeId: 2, id: 3 }, 'deleteAttributeTerm', [2, 3]],
    ['update_tax_rate', { id: 3, rate: '5' }, 'updateTaxRate', [3]],
    ['delete_tax_rate', { id: 3 }, 'deleteTaxRate', [3]],
    ['delete_tax_class', { slug: 'reduced' }, 'deleteTaxClass', ['reduced']],
    ['update_review', { id: 3, status: 'approved' }, 'updateReview', [3]],
    ['delete_review', { id: 3 }, 'deleteReview', [3]],
    [
      'update_variation',
      { productId: 9, id: 3, regular_price: '1' },
      'updateProductVariation',
      [9, 3],
    ],
    ['delete_variation', { productId: 9, id: 3 }, 'deleteProductVariation', [9, 3]],
  ];

  it.each(cases)('%s calls the service', async (type, data, method, args) => {
    s[method].mockResolvedValue(ok);
    expect((await run(s, op(type, data))).success).toBe(true);
    expect(s[method]).toHaveBeenCalledWith(...args, ...(type.startsWith('delete') ? [] : [data]));
  });

  it.each(cases)(
    '%s treats already-gone as success and keeps real errors',
    async (type, data, method) => {
      s[method].mockResolvedValueOnce(gone);
      expect((await run(s, op(type, data))).success).toBe(true);
      s[method].mockResolvedValueOnce(bad);
      expect((await run(s, op(type, data))).success).toBe(false);
    }
  );

  it('batch_reviews fails on item errors, passes otherwise', async () => {
    const data = {
      update: [
        { id: 1, status: 'approved' },
        { id: 2, status: 'approved' },
      ],
    };
    s.batchUpdateReviews.mockResolvedValueOnce({
      success: true,
      data: { update: [{ id: 1 }, { id: 2, error: { code: 'x', message: 'bad' } }] },
    });
    const r = await run(s, op('batch_reviews', data));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/1 batch item/);
    s.batchUpdateReviews.mockResolvedValueOnce({ success: true, data: { update: [{ id: 1 }] } });
    expect((await run(s, op('batch_reviews', data))).success).toBe(true);
    expect(s.batchUpdateReviews).toHaveBeenCalledWith(data.update);
  });

  it('batch_variations passes productId separately and handles partial failure', async () => {
    s.batchProductVariations.mockResolvedValueOnce({
      success: true,
      data: { delete: [{ id: 1, error: { code: 'x', message: 'Invalid ID' } }] },
    });
    expect((await run(s, op('batch_variations', { productId: 9, delete: [1] }))).success).toBe(
      true
    );
    expect(s.batchProductVariations).toHaveBeenCalledWith(9, { delete: [1] });
    s.batchProductVariations.mockResolvedValueOnce({
      success: true,
      data: { update: [{ id: 1, error: { code: 'x', message: 'bad' } }] },
    });
    expect(
      (await run(s, op('batch_variations', { productId: 9, update: [{ id: 1 }] }))).success
    ).toBe(false);
  });
});

describe('replay: create duplicate guards', () => {
  let s: Svc;
  beforeEach(() => {
    s = svc();
  });

  it('create_product: existing SKU -> no create', async () => {
    s.getProducts.mockResolvedValue(list([{ id: 1, sku: 'A' }]));
    expect((await run(s, op('create_product', { sku: 'A', name: 'A' }))).success).toBe(true);
    expect(s.createProduct).not.toHaveBeenCalled();
  });

  it('create_product: existing client id -> no create; otherwise creates once', async () => {
    const d = { sku: '', name: 'Copy', meta_data: [{ key: CLIENT_ID_META, value: 'c1' }] };
    s.getProducts.mockResolvedValue(
      list([{ id: 5, meta_data: [{ key: CLIENT_ID_META, value: 'c1' }] }])
    );
    expect((await run(s, op('create_product', d))).success).toBe(true);
    expect(s.createProduct).not.toHaveBeenCalled();

    s.getProducts.mockResolvedValue(list([{ id: 6, meta_data: [] }]));
    s.createProduct.mockResolvedValue(ok);
    expect((await run(s, op('create_product', d))).success).toBe(true);
    expect(s.createProduct).toHaveBeenCalledTimes(1);
  });

  it('create_product: lookup failure -> no create; no sku and no client id -> refused', async () => {
    s.getProducts.mockResolvedValue(bad);
    expect((await run(s, op('create_product', { sku: 'A' }))).success).toBe(false);
    expect((await run(s, op('create_product', { name: 'x' }))).success).toBe(false);
    expect(s.createProduct).not.toHaveBeenCalled();
  });

  it('create_coupon: existing code (any case) -> no create; else creates', async () => {
    s.getCoupons.mockResolvedValue(list([{ code: 'sale10' }]));
    expect((await run(s, op('create_coupon', { code: 'SALE10' }))).success).toBe(true);
    expect(s.createCoupon).not.toHaveBeenCalled();
    s.getCoupons.mockResolvedValue(list([]));
    s.createCoupon.mockResolvedValue(ok);
    await run(s, op('create_coupon', { code: 'SALE10' }));
    expect(s.createCoupon).toHaveBeenCalledTimes(1);
  });

  it('create_category: same name+parent or slug -> no create', async () => {
    s.getProductCategories.mockResolvedValue(list([{ name: 'Shoes', slug: 'shoes', parent: 0 }]));
    expect((await run(s, op('create_category', { name: 'shoes', parent: 0 }))).success).toBe(true);
    expect((await run(s, op('create_category', { name: 'Other', slug: 'shoes' }))).success).toBe(
      true
    );
    expect(s.createProductCategory).not.toHaveBeenCalled();
    s.createProductCategory.mockResolvedValue(ok);
    await run(s, op('create_category', { name: 'Shoes', parent: 4 }));
    expect(s.createProductCategory).toHaveBeenCalledTimes(1);
  });

  it('create_attribute: match by name or pa_ slug -> no create', async () => {
    s.getProductAttributes.mockResolvedValue(list([{ name: 'Color', slug: 'pa_color' }]));
    expect((await run(s, op('create_attribute', { name: 'Colour', slug: 'color' }))).success).toBe(
      true
    );
    expect(s.createProductAttribute).not.toHaveBeenCalled();
    s.createProductAttribute.mockResolvedValue(ok);
    await run(s, op('create_attribute', { name: 'Size' }));
    expect(s.createProductAttribute).toHaveBeenCalledTimes(1);
  });

  it('create_attribute_term: existing term -> no create; new passes attributeId separately', async () => {
    s.getAttributeTerms.mockResolvedValue(list([{ name: 'Red', slug: 'red' }]));
    expect(
      (await run(s, op('create_attribute_term', { attributeId: 2, name: 'Red' }))).success
    ).toBe(true);
    expect(s.createAttributeTerm).not.toHaveBeenCalled();
    s.createAttributeTerm.mockResolvedValue(ok);
    await run(s, op('create_attribute_term', { attributeId: 2, name: 'Blue' }));
    expect(s.createAttributeTerm).toHaveBeenCalledWith(2, { name: 'Blue' });
  });

  it('create_tax_rate: identical rate exists -> no create', async () => {
    const existing = {
      name: 'VAT',
      rate: '20.0000',
      country: 'BG',
      state: '',
      postcode: '',
      city: '',
      priority: 1,
    };
    s.getTaxRates.mockResolvedValue(list([existing]));
    const d = { name: 'VAT', rate: '20.0000', country: 'BG', priority: 1 };
    expect((await run(s, op('create_tax_rate', d))).success).toBe(true);
    expect(s.createTaxRate).not.toHaveBeenCalled();
    s.createTaxRate.mockResolvedValue(ok);
    await run(s, op('create_tax_rate', { ...d, rate: '9' }));
    expect(s.createTaxRate).toHaveBeenCalledTimes(1);
  });

  it('create_tax_class: existing name/slug -> no create', async () => {
    s.getTaxClasses.mockResolvedValue(list([{ name: 'Reduced rate', slug: 'reduced-rate' }]));
    expect((await run(s, op('create_tax_class', { name: 'reduced rate' }))).success).toBe(true);
    expect(s.createTaxClass).not.toHaveBeenCalled();
    s.createTaxClass.mockResolvedValue(ok);
    await run(s, op('create_tax_class', { name: 'Zero' }));
    expect(s.createTaxClass).toHaveBeenCalledWith({ name: 'Zero' });
  });

  it('create_variation: existing client id -> no create; else creates without productId in body', async () => {
    const meta = [{ key: CLIENT_ID_META, value: 'v1' }];
    s.getProductVariations.mockResolvedValue(list([{ id: 1, meta_data: meta }]));
    expect((await run(s, op('create_variation', { productId: 9, meta_data: meta }))).success).toBe(
      true
    );
    expect(s.createProductVariation).not.toHaveBeenCalled();
    s.getProductVariations.mockResolvedValue(list([]));
    s.createProductVariation.mockResolvedValue(ok);
    await run(s, op('create_variation', { productId: 9, meta_data: meta, sku: 'q' }));
    expect(s.createProductVariation).toHaveBeenCalledWith(9, { meta_data: meta, sku: 'q' });
  });

  it('create_order (non-POS): existing client id -> no create; else creates; no id -> refused', async () => {
    const meta = [{ key: CLIENT_ID_META, value: 'o1' }];
    s.getOrders.mockResolvedValue(list([{ id: 1, meta_data: meta }]));
    expect((await run(s, op('create_order', { meta_data: meta }))).success).toBe(true);
    expect(s.createOrder).not.toHaveBeenCalled();
    s.getOrders.mockResolvedValue(list([]));
    s.createOrder.mockResolvedValue(ok);
    await run(s, op('create_order', { meta_data: meta }));
    expect(s.createOrder).toHaveBeenCalledTimes(1);
    s.createOrder.mockClear();
    expect((await run(s, op('create_order', {}))).success).toBe(false);
    s.getOrders.mockResolvedValue(bad);
    expect((await run(s, op('create_order', { meta_data: meta }))).success).toBe(false);
    expect(s.createOrder).not.toHaveBeenCalled();
  });

  it('client-id scan paginates past 5 pages, exits early on match, stops when exhausted', async () => {
    const meta = [{ key: CLIENT_ID_META, value: 'p1' }];
    const full = Array.from({ length: 100 }, (_, i) => ({ id: i, meta_data: [] }));
    s.getProducts.mockImplementation(async (params: { page: number }) =>
      list(params.page === 8 ? [{ id: 999, meta_data: meta }] : full)
    );
    const d = { sku: '', meta_data: meta };
    expect((await run(s, op('create_product', d))).success).toBe(true);
    expect(s.getProducts).toHaveBeenCalledTimes(8);
    expect(s.createProduct).not.toHaveBeenCalled();

    s.getProducts.mockClear();
    s.getProducts.mockImplementation(async (params: { page: number }) =>
      list(params.page === 3 ? [] : full)
    );
    s.createProduct.mockResolvedValue(ok);
    await run(s, op('create_product', d));
    expect(s.getProducts).toHaveBeenCalledTimes(3);
    expect(s.createProduct).toHaveBeenCalledTimes(1);
  });

  it('variation scan paginates', async () => {
    const meta = [{ key: CLIENT_ID_META, value: 'v2' }];
    const full = Array.from({ length: 100 }, (_, i) => ({ id: i, meta_data: [] }));
    s.getProductVariations.mockImplementation(async (_id: number, p: { page: number }) =>
      list(p.page === 2 ? [{ id: 500, meta_data: meta }] : full)
    );
    expect((await run(s, op('create_variation', { productId: 9, meta_data: meta }))).success).toBe(
      true
    );
    expect(s.createProductVariation).not.toHaveBeenCalled();
  });

  it('lookup failure blocks every create', async () => {
    s.getCoupons.mockResolvedValue(bad);
    s.getProductCategories.mockResolvedValue(bad);
    s.getTaxClasses.mockResolvedValue(bad);
    expect((await run(s, op('create_coupon', { code: 'A' }))).success).toBe(false);
    expect((await run(s, op('create_category', { name: 'A' }))).success).toBe(false);
    expect((await run(s, op('create_tax_class', { name: 'A' }))).success).toBe(false);
    expect(s.createCoupon).not.toHaveBeenCalled();
    expect(s.createProductCategory).not.toHaveBeenCalled();
    expect(s.createTaxClass).not.toHaveBeenCalled();
  });
});

describe('queue order for new types', () => {
  beforeEach(() => useOffline.getState().clearPendingOperations());

  it('keeps FIFO order (create before update/delete of the same kind)', () => {
    const { addPendingOperation } = useOffline.getState();
    addPendingOperation('create_category', { name: 'A' }, 'a');
    addPendingOperation('update_category', { id: 1 }, 'a');
    addPendingOperation('delete_review', { id: 2 }, 'b');
    addPendingOperation('batch_variations', { productId: 1, delete: [1] }, 'a');
    expect(useOffline.getState().pendingOperations.map((o) => o.type)).toEqual([
      'create_category',
      'update_category',
      'delete_review',
      'batch_variations',
    ]);
  });
});
