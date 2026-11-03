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
  executeProductCopy,
  planCategories,
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

const cat = (id: number, name: string, parent = 0, slug = name.toLowerCase()) => ({
  id,
  name,
  slug,
  parent,
});

describe('planCategories', () => {
  const src = [cat(1, 'A'), cat(2, 'B', 1), cat(3, 'C', 2), cat(9, 'Unused')];
  const need = [{ id: 3, name: 'C', slug: 'c' }];

  it('creates only used categories plus ancestors, parents first', () => {
    const p = planCategories(src, [], need);
    expect(p.toCreate.map((c) => [c.name, c.depth])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
    ]);
  });
  it('maps onto an existing parent and keeps it as parentTargetId', () => {
    const p = planCategories(src, [cat(50, 'A')], need);
    expect(p.matched.get(1)).toBe(50);
    expect(p.toCreate.map((c) => c.name)).toEqual(['B', 'C']);
    expect(p.toCreate[0]).toMatchObject({ parentTargetId: 50, depth: 0 });
    expect(p.toCreate[1]?.parentSrcId).toBe(2);
  });
  it('falls back to name under the same parent', () => {
    const p = planCategories(src, [cat(50, 'A', 0, 'a-x'), cat(51, 'B', 50, 'b-x')], need);
    expect(p.matched.get(2)).toBe(51);
    expect(p.toCreate.map((c) => c.name)).toEqual(['C']);
  });
  it('makes orphans top-level with a warning and survives cycles', () => {
    const orphan = planCategories([cat(5, 'O', 77)], [], [{ id: 5, name: 'O', slug: 'o' }]);
    expect(orphan.toCreate[0]).toMatchObject({ parentTargetId: 0, depth: 0 });
    expect(orphan.warnings).toHaveLength(1);
    const cyc = planCategories(
      [cat(1, 'X', 2), cat(2, 'Y', 1)],
      [],
      [{ id: 1, name: 'X', slug: 'x' }]
    );
    expect(cyc.toCreate).toHaveLength(2);
    expect(cyc.warnings).toHaveLength(1);
  });
});

describe('executeProductCopy', () => {
  const ok = <T>(data: T) => Promise.resolve({ success: true as const, data });
  const mk = (n: number, over: Record<string, unknown> = {}) =>
    prod({
      id: n,
      sku: `K${n}`,
      name: `P${n}`,
      categories: [{ id: 3, name: 'C', slug: 'c' }],
      ...over,
    });
  const setup = (batchProducts: ReturnType<typeof vi.fn>) => {
    const batchProductCategories = vi
      .fn()
      .mockImplementation((b: { create: unknown[] }) =>
        ok({ create: b.create.map((_, i) => ({ id: 100 + i })) })
      );
    const batchProductVariations = vi
      .fn()
      .mockResolvedValue({ success: true, data: { create: [{ id: 1 }] } });
    const target = {
      getProductCategories: () => ok([]),
      getProductAttributes: () => ok([]),
      getAllProducts: () => ok([{ id: 99, sku: 'K2' }]),
      batchProducts,
      batchProductCategories,
      batchProductVariations,
    };
    const source = {
      getProductCategories: () => ok([cat(1, 'A'), cat(2, 'B', 1), cat(3, 'C', 2)]),
      getProductVariations: () => ok([{ id: 1, attributes: [], dimensions: {} }]),
    };
    return { source, target, batchProductCategories, batchProductVariations };
  };

  it('creates hierarchy, skips collisions, chunks creates, maps parent ids', async () => {
    const batchProducts = vi
      .fn()
      .mockImplementation((b: { create?: unknown[] }) =>
        ok({ create: (b.create ?? []).map((_, i) => ({ id: 500 + i })) })
      );
    const s = setup(batchProducts);
    const products = Array.from({ length: 28 }, (_, i) => mk(i + 1));
    const r = await executeProductCopy({
      source: s.source as never,
      target: s.target as never,
      products,
      collision: 'skip',
      createMissingCategories: true,
    });
    expect(r).toMatchObject({ created: 27, skipped: 1, failed: 0 });
    expect(batchProducts).toHaveBeenCalledTimes(2);
    expect(s.batchProductCategories).toHaveBeenCalledTimes(3);
    const parents = s.batchProductCategories.mock.calls.map((c) => c[0].create[0].parent);
    expect(parents).toEqual([0, 100, 100]);
    expect(batchProducts.mock.calls[0]?.[0].create[0].categories).toEqual([{ id: 100 }]);
  });

  it('updates collisions, variations only for new variable products, counts failures', async () => {
    const batchProducts = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: { create: [{ id: 700 }, { id: 0, error: {} }] },
      })
      .mockResolvedValueOnce({ success: true, data: { update: [{ id: 99 }] } });
    const s = setup(batchProducts);
    const r = await executeProductCopy({
      source: s.source as never,
      target: s.target as never,
      products: [
        mk(1, { type: 'variable' }),
        mk(3, { type: 'variable' }),
        mk(2, { type: 'variable' }),
      ],
      collision: 'update',
      createMissingCategories: false,
    });
    expect(r).toMatchObject({ created: 1, updated: 1, failed: 1 });
    expect(s.batchProductCategories).not.toHaveBeenCalled();
    expect(s.batchProductVariations).toHaveBeenCalledTimes(1);
    expect(s.batchProductVariations.mock.calls[0]?.[0]).toBe(700);
    expect(r.messages.some((m) => m.includes('not synced'))).toBe(true);
  });

  it('keeps remaining categories when one category fails to create', async () => {
    const batchProducts = vi.fn().mockImplementation(() => ok({ create: [{ id: 1 }] }));
    const s = setup(batchProducts);
    s.target.batchProductCategories = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: { create: [{ id: 100 }] } })
      .mockResolvedValue({ success: true, data: { create: [{ id: 0, error: { code: 'x' } }] } });
    const r = await executeProductCopy({
      source: s.source as never,
      target: s.target as never,
      products: [
        mk(1, {
          categories: [
            { id: 3, name: 'C', slug: 'c' },
            { id: 1, name: 'A', slug: 'a' },
          ],
        }),
      ],
      collision: 'skip',
      createMissingCategories: true,
    });
    expect(batchProducts.mock.calls[0]?.[0].create[0].categories).toEqual([{ id: 100 }]);
    expect(r.messages.some((m) => m.includes('2 of 3 categories could not be created'))).toBe(true);
    expect(r.failed).toBe(0);
  });
});

describe('related links warning', () => {
  it('warns when upsell/cross-sell ids exist', () => {
    const { warnings } = buildProductPayload(prod({ upsell_ids: [1], cross_sell_ids: [2] }), ctx);
    expect(warnings.some((w) => w.startsWith('upsell/cross-sell'))).toBe(true);
  });
});
