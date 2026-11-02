import { describe, it, expect, vi } from 'vitest';
import {
  buildTargetContext,
  buildProductPayload,
  buildVariationPayload,
  buildCouponPayload,
  previewProductCopy,
  chunk,
  runBatches,
  emptyResult,
  summarizeCopy,
  executeCouponCopy,
} from '../crossStoreCopy';
import type { Product, WooCommerceCoupon, ProductVariation } from '../../types';

const prod = (over: Record<string, unknown> = {}): Product =>
  ({
    id: 7,
    name: 'Shirt',
    slug: 'shirt',
    permalink: 'http://x/shirt',
    type: 'simple',
    sku: 'S1',
    regular_price: '10',
    categories: [
      { id: 1, name: 'Tops', slug: 'tops' },
      { id: 2, name: 'Sale', slug: 'sale' },
    ],
    tags: [{ id: 3, name: 'Hot', slug: 'hot' }],
    images: [
      { id: 9, src: 'http://x/a.jpg', alt: 'A', name: 'a', date_created: 'x' },
      { id: 10, src: '', alt: '' },
    ],
    attributes: [
      { id: 4, name: 'Color', position: 0, visible: true, variation: false, options: ['Red'] },
      { id: 5, name: 'Size', position: 1, visible: true, variation: false, options: ['M'] },
      { id: 0, name: 'Custom', position: 2, visible: true, variation: false, options: ['x'] },
    ],
    default_attributes: [],
    downloads: [],
    grouped_products: [],
    ...over,
  }) as unknown as Product;

const ctx = buildTargetContext({
  categories: [{ id: 50, slug: 'Tops', name: 'Tops' }] as never,
  attributes: [{ id: 80, name: ' color ' }] as never,
  products: [{ id: 99, sku: 's1' }],
  coupons: [{ id: 5, code: 'SAVE' }],
});

describe('buildProductPayload', () => {
  const { payload, warnings } = buildProductPayload(prod(), ctx);
  it('strips ids, links and read-only fields', () => {
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('permalink');
  });
  it('remaps categories by slug and warns for missing ones', () => {
    expect(payload.categories).toEqual([{ id: 50 }]);
    expect(warnings.some((w) => w.includes('"Sale"'))).toBe(true);
  });
  it('maps global attributes by name; unmatched become custom with warning', () => {
    expect(payload.attributes?.map((a) => a.id)).toEqual([80, 0, 0]);
    expect(warnings.some((w) => w.includes('"Size"'))).toBe(true);
  });
  it('keeps images by src only and drops empty ones', () => {
    expect(payload.images).toEqual([{ src: 'http://x/a.jpg', alt: 'A' }]);
  });
  it('sends tags by name', () => {
    expect(payload.tags).toEqual([{ name: 'Hot' }]);
  });
  it('warns on downloads and grouped children', () => {
    const w = buildProductPayload(
      prod({ type: 'grouped', grouped_products: [1], downloads: [{}] }),
      ctx
    ).warnings;
    expect(w).toContain('Grouped product children are not copied');
    expect(w).toContain('Downloadable files are not copied');
  });
});

describe('previewProductCopy', () => {
  it('detects SKU collisions, missing categories, unmatched attributes, variable count', () => {
    const p = previewProductCopy(
      [prod(), prod({ sku: 'NEW', type: 'variable' }), prod({ sku: '' })],
      ctx
    );
    expect(p.collisions).toHaveLength(1);
    expect(p.willCreate).toHaveLength(2);
    expect(p.missingCategories).toEqual([{ slug: 'sale', name: 'Sale' }]);
    expect(p.unmatchedAttributes).toEqual(['Size']);
    expect(p.variableCount).toBe(1);
  });
});

describe('buildVariationPayload', () => {
  it('drops ids and keeps image by url', () => {
    const v = {
      id: 3,
      sku: '',
      regular_price: '5',
      manage_stock: 'parent',
      status: 'publish',
      attributes: [{ id: 4, name: 'Color', option: 'Red' }],
      image: { id: 1, src: 'http://x/v.jpg' },
    } as unknown as ProductVariation;
    const out = buildVariationPayload(v) as Record<string, unknown>;
    expect(out).not.toHaveProperty('id');
    expect(out.sku).toBeUndefined();
    expect(out.manage_stock).toBe(false);
    expect(out.image).toEqual({ src: 'http://x/v.jpg' });
    expect(out.attributes).toEqual([{ id: 0, name: 'Color', option: 'Red' }]);
  });
});

describe('buildCouponPayload', () => {
  const c = {
    id: 1,
    code: 'SAVE',
    amount: '5',
    discount_type: 'percent',
    product_ids: [1],
    excluded_product_ids: [],
    product_categories: [1, 2],
    excluded_product_categories: [],
    usage_count: 4,
  } as unknown as WooCommerceCoupon;
  it('remaps categories via slug and drops product restrictions with warnings', () => {
    const { payload, warnings } = buildCouponPayload(
      c,
      ctx,
      new Map([
        [1, 'tops'],
        [2, 'sale'],
      ])
    );
    expect(payload.product_categories).toEqual([50]);
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('usage_count');
    expect(warnings).toHaveLength(2);
  });
});

describe('batching', () => {
  it('chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it('counts per-item errors and failed requests as "X of Y failed"', async () => {
    const result = emptyResult(30);
    const call = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: { create: [{ id: 1 }, { id: 0, error: { code: 'x' } }] },
      })
      .mockResolvedValueOnce({ success: false, error: 'down' });
    const ids: number[][] = [];
    await runBatches(
      Array.from({ length: 30 }, (_, i) => ({ n: i })),
      [],
      call,
      result,
      (i) => ids.push(i)
    );
    expect(call).toHaveBeenCalledTimes(2);
    expect(result.failed).toBe(1 + 5);
    expect(result.created).toBe(24);
    expect(ids[0]?.slice(0, 2)).toEqual([1, 0]);
    expect(summarizeCopy(result)).toContain('6 of 30 failed');
  });
});

describe('executeCouponCopy', () => {
  it('skips colliding codes and creates the rest', async () => {
    const batchCoupons = vi
      .fn()
      .mockResolvedValue({ success: true, data: { create: [{ id: 2 }] } });
    const ok = <T>(data: T) => Promise.resolve({ success: true, data });
    const target = {
      getProductCategories: () => ok([]),
      getAllCoupons: () => ok([{ id: 5, code: 'save' }]),
      batchCoupons,
    };
    const source = { getProductCategories: () => ok([]) };
    const mk = (code: string) =>
      ({
        code,
        amount: '1',
        product_categories: [],
        excluded_product_categories: [],
      }) as unknown as WooCommerceCoupon;
    const r = await executeCouponCopy({
      source: source as never,
      target: target as never,
      coupons: [mk('SAVE'), mk('NEW')],
      collision: 'skip',
    });
    expect(r).toMatchObject({ skipped: 1, created: 1, failed: 0 });
    expect(batchCoupons.mock.calls[0]?.[0].create).toHaveLength(1);
  });
});
