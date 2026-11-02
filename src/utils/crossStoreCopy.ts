import type WooCommerceService from '../services/woocommerce';
import { batchErrorIds } from './batchResult';
import type {
  Product,
  ProductUpdateData,
  ProductVariation,
  VariationCreateData,
  WooCommerceCoupon,
  CouponUpdateData,
  WooCommerceProductCategory,
  WooCommerceProductAttribute,
} from '../types';

export type CollisionMode = 'skip' | 'update';

export const COPY_CHUNK_SIZE = 25;

export const norm = (s: string | undefined | null): string => (s ?? '').trim().toLowerCase();

export function chunk<T>(arr: T[], size = COPY_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Target-side lookup tables used to remap source references. */
export interface TargetContext {
  /** category slug (lowercase) -> target id */
  categoryIdBySlug: Map<string, number>;
  /** global attribute name (lowercase) -> target attribute id */
  attributeIdByName: Map<string, number>;
  /** sku (lowercase) -> target product id */
  productIdBySku: Map<string, number>;
  /** coupon code (lowercase) -> target coupon id */
  couponIdByCode: Map<string, number>;
}

export function buildTargetContext(input: {
  categories?: WooCommerceProductCategory[];
  attributes?: WooCommerceProductAttribute[];
  products?: Array<Pick<Product, 'id' | 'sku'>>;
  coupons?: Array<Pick<WooCommerceCoupon, 'id' | 'code'>>;
}): TargetContext {
  const ctx: TargetContext = {
    categoryIdBySlug: new Map(),
    attributeIdByName: new Map(),
    productIdBySku: new Map(),
    couponIdByCode: new Map(),
  };
  input.categories?.forEach((c) => ctx.categoryIdBySlug.set(norm(c.slug), c.id));
  input.attributes?.forEach((a) => ctx.attributeIdByName.set(norm(a.name), a.id));
  input.products?.forEach((p) => p.sku && ctx.productIdBySku.set(norm(p.sku), p.id));
  input.coupons?.forEach((c) => ctx.couponIdByCode.set(norm(c.code), c.id));
  return ctx;
}

export interface ProductPayloadResult {
  payload: ProductUpdateData;
  warnings: string[];
}

/** Build a create/update payload from a source product: no ids/links, remapped refs, image URLs only. */
export function buildProductPayload(source: Product, ctx: TargetContext): ProductPayloadResult {
  const warnings: string[] = [];

  const categories: Array<{ id: number }> = [];
  for (const c of source.categories ?? []) {
    const id = ctx.categoryIdBySlug.get(norm(c.slug));
    if (id !== undefined) categories.push({ id });
    else warnings.push(`Category "${c.name}" is missing in the target and was skipped`);
  }

  const attributes = (source.attributes ?? []).map((a) => {
    const targetId = a.id > 0 ? ctx.attributeIdByName.get(norm(a.name)) : undefined;
    if (a.id > 0 && targetId === undefined) {
      warnings.push(
        `Attribute "${a.name}" does not exist in the target; copied as a custom attribute`
      );
    }
    return {
      id: targetId ?? 0,
      name: a.name,
      position: a.position,
      visible: a.visible,
      variation: a.variation,
      options: [...a.options],
    };
  });

  if (source.type === 'grouped' && source.grouped_products?.length) {
    warnings.push('Grouped product children are not copied');
  }
  if (source.downloads?.length) warnings.push('Downloadable files are not copied');

  const payload = {
    name: source.name,
    slug: source.slug,
    type: source.type,
    status: source.status,
    featured: source.featured,
    catalog_visibility: source.catalog_visibility,
    description: source.description,
    short_description: source.short_description,
    sku: source.sku,
    regular_price: source.regular_price,
    sale_price: source.sale_price,
    date_on_sale_from: source.date_on_sale_from,
    date_on_sale_to: source.date_on_sale_to,
    virtual: source.virtual,
    external_url: source.external_url,
    button_text: source.button_text,
    tax_status: source.tax_status,
    tax_class: source.tax_class,
    manage_stock: source.manage_stock,
    stock_quantity: source.stock_quantity,
    stock_status: source.stock_status,
    backorders: source.backorders,
    sold_individually: source.sold_individually,
    weight: source.weight,
    dimensions: source.dimensions,
    reviews_allowed: source.reviews_allowed,
    purchase_note: source.purchase_note,
    menu_order: source.menu_order,
    categories,
    tags: (source.tags ?? []).map((t) => ({ name: t.name })),
    images: (source.images ?? []).filter((i) => i.src).map((i) => ({ src: i.src, alt: i.alt })),
    attributes,
    default_attributes: (source.default_attributes ?? []).map((d) => ({
      id: 0,
      name: d.name,
      option: d.option,
    })),
  } as unknown as ProductUpdateData;

  return { payload, warnings };
}

export function buildVariationPayload(v: ProductVariation): VariationCreateData {
  return {
    regular_price: v.regular_price,
    sale_price: v.sale_price,
    status: v.status,
    sku: v.sku || undefined,
    manage_stock: v.manage_stock === true,
    stock_quantity: v.stock_quantity,
    stock_status: v.stock_status,
    weight: v.weight,
    dimensions: v.dimensions,
    description: v.description,
    attributes: v.attributes.map((a) => ({ id: 0, name: a.name, option: a.option })),
    ...(v.image?.src ? { image: { src: v.image.src } } : {}),
  } as VariationCreateData;
}

export interface ProductCopyPreview {
  willCreate: Product[];
  collisions: Product[];
  /** Categories that do not exist in the target (created first unless disabled). */
  missingCategories: Array<{ slug: string; name: string }>;
  /** Global attributes missing in the target (copied as custom attributes). */
  unmatchedAttributes: string[];
  variableCount: number;
}

export function previewProductCopy(products: Product[], ctx: TargetContext): ProductCopyPreview {
  const missing = new Map<string, string>();
  const attrs = new Set<string>();
  const willCreate: Product[] = [];
  const collisions: Product[] = [];
  for (const p of products) {
    if (p.sku && ctx.productIdBySku.has(norm(p.sku))) collisions.push(p);
    else willCreate.push(p);
    p.categories?.forEach((c) => {
      if (!ctx.categoryIdBySlug.has(norm(c.slug))) missing.set(norm(c.slug), c.name);
    });
    p.attributes?.forEach((a) => {
      if (a.id > 0 && !ctx.attributeIdByName.has(norm(a.name))) attrs.add(a.name);
    });
  }
  return {
    willCreate,
    collisions,
    missingCategories: [...missing].map(([slug, name]) => ({ slug, name })),
    unmatchedAttributes: [...attrs],
    variableCount: products.filter((p) => p.type === 'variable').length,
  };
}

/** Coupons: product ids cannot be mapped; category ids are remapped by slug via the source category list. */
export function buildCouponPayload(
  source: WooCommerceCoupon,
  ctx: TargetContext,
  sourceCategorySlugById: Map<number, string>
): { payload: CouponUpdateData; warnings: string[] } {
  const warnings: string[] = [];
  const mapCats = (ids: number[]): number[] =>
    (ids ?? []).flatMap((id) => {
      const slug = sourceCategorySlugById.get(id);
      const t = slug ? ctx.categoryIdBySlug.get(norm(slug)) : undefined;
      if (t === undefined) {
        warnings.push(`Category restriction #${id} has no match in the target and was dropped`);
        return [];
      }
      return [t];
    });
  if (source.product_ids?.length || source.excluded_product_ids?.length) {
    warnings.push('Product restrictions are not copied (product ids differ per store)');
  }
  return {
    payload: {
      code: source.code,
      discount_type: source.discount_type,
      amount: source.amount,
      description: source.description,
      date_expires: source.date_expires,
      individual_use: source.individual_use,
      usage_limit: source.usage_limit,
      usage_limit_per_user: source.usage_limit_per_user,
      limit_usage_to_x_items: source.limit_usage_to_x_items,
      free_shipping: source.free_shipping,
      product_categories: mapCats(source.product_categories),
      excluded_product_categories: mapCats(source.excluded_product_categories),
      exclude_sale_items: source.exclude_sale_items,
      minimum_amount: source.minimum_amount,
      maximum_amount: source.maximum_amount,
      email_restrictions: source.email_restrictions,
    },
    warnings,
  };
}

export interface CopyResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
  messages: string[];
}

export const emptyResult = (total: number): CopyResult => ({
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  total,
  messages: [],
});

/** "X of Y failed" style summary line. */
export function summarizeCopy(r: CopyResult): string {
  const ok = `${r.created} created, ${r.updated} updated, ${r.skipped} skipped`;
  return r.failed > 0 ? `${ok}; ${r.failed} of ${r.total} failed` : ok;
}

type BatchCall<P> = (b: {
  create?: P[];
  update?: Array<P & { id: number }>;
}) => Promise<{ success: true; data: unknown } | { success: false; error: string }>;

/** Run create then update batches in chunks, updating counts. onCreated gets target ids per chunk entry (0 = failed). */
export async function runBatches<P>(
  creates: P[],
  updates: Array<P & { id: number }>,
  call: BatchCall<P>,
  result: CopyResult,
  onCreated?: (ids: number[]) => void
): Promise<void> {
  for (const kind of ['create', 'update'] as const) {
    const items = kind === 'create' ? creates : updates;
    for (const part of chunk(items)) {
      const res = await call(
        kind === 'create' ? { create: part } : { update: part as Array<P & { id: number }> }
      );
      if (!res.success) {
        result.failed += part.length;
        result.messages.push(res.error || 'Batch request failed');
        if (kind === 'create') onCreated?.(part.map(() => 0));
        continue;
      }
      const data = res.data as Parameters<typeof batchErrorIds>[0];
      const failed = batchErrorIds(data, kind).length;
      result.failed += failed;
      result[kind === 'create' ? 'created' : 'updated'] += part.length - failed;
      if (kind === 'create') {
        const entries = (data?.create ?? []) as Array<{ id?: number; error?: unknown }>;
        onCreated?.(part.map((_, i) => (entries[i]?.error ? 0 : (entries[i]?.id ?? 0))));
      }
    }
  }
}

export interface ProductCopyOptions {
  source: WooCommerceService;
  target: WooCommerceService;
  products: Product[];
  collision: CollisionMode;
  createMissingCategories: boolean;
  onProgress?: (msg: string) => void;
}

/** Read the target store lookups needed for preview/execution. */
export async function loadProductTargetContext(
  target: WooCommerceService
): Promise<{ ok: true; ctx: TargetContext } | { ok: false; error: string }> {
  const [cats, attrs, prods] = await Promise.all([
    target.getProductCategories({ per_page: 100 }),
    target.getProductAttributes(),
    target.getAllProducts({ per_page: 100 }),
  ]);
  if (!cats.success) return { ok: false, error: cats.error };
  if (!attrs.success) return { ok: false, error: attrs.error };
  if (!prods.success) return { ok: false, error: prods.error };
  return {
    ok: true,
    ctx: buildTargetContext({
      categories: cats.data,
      attributes: attrs.data,
      products: prods.data,
    }),
  };
}

export async function executeProductCopy(opts: ProductCopyOptions): Promise<CopyResult> {
  const { source, target, products, collision, onProgress } = opts;
  const result = emptyResult(products.length);

  onProgress?.('Reading target store...');
  const loaded = await loadProductTargetContext(target);
  if (!loaded.ok) {
    result.failed = products.length;
    result.messages.push(`Could not read the target store: ${loaded.error}`);
    return result;
  }
  const ctx = loaded.ctx;

  if (opts.createMissingCategories) {
    for (const m of previewProductCopy(products, ctx).missingCategories) {
      const r = await target.createProductCategory({ name: m.name, slug: m.slug });
      if (r.success) ctx.categoryIdBySlug.set(m.slug, r.data.id);
      else result.messages.push(`Could not create category "${m.name}": ${r.error}`);
    }
  }

  const creates: Array<{ src: Product; payload: ProductUpdateData }> = [];
  const updates: Array<{ src: Product; payload: ProductUpdateData & { id: number } }> = [];
  for (const p of products) {
    const existing = p.sku ? ctx.productIdBySku.get(norm(p.sku)) : undefined;
    if (existing !== undefined && collision === 'skip') {
      result.skipped++;
      continue;
    }
    const { payload, warnings } = buildProductPayload(p, ctx);
    warnings.forEach((w) => result.messages.push(`${p.name}: ${w}`));
    if (existing !== undefined) updates.push({ src: p, payload: { ...payload, id: existing } });
    else creates.push({ src: p, payload });
  }

  onProgress?.('Copying products...');
  const createdVariable: Array<{ src: Product; id: number }> = [];
  let cursor = 0;
  await runBatches<ProductUpdateData>(
    creates.map((c) => c.payload),
    updates.map((u) => u.payload),
    (b) => target.batchProducts(b as never),
    result,
    (ids) =>
      ids.forEach((id) => {
        const c = creates[cursor++];
        if (c && id && c.src.type === 'variable') createdVariable.push({ src: c.src, id });
      })
  );

  // Variations are best-effort and only for newly created variable products.
  for (const { src, id } of createdVariable) {
    const vars = await source.getProductVariations(src.id, { per_page: 100 });
    if (!vars.success) {
      result.messages.push(`${src.name}: could not read variations (${vars.error})`);
      continue;
    }
    const res = await target.batchProductVariations(id, {
      create: vars.data.map(buildVariationPayload),
    });
    if (!res.success) result.messages.push(`${src.name}: variations failed (${res.error})`);
    else {
      const bad = batchErrorIds(res.data, 'create').length;
      if (bad) result.messages.push(`${src.name}: ${bad} of ${vars.data.length} variations failed`);
    }
  }
  if (updates.some((u) => u.src.type === 'variable')) {
    result.messages.push('Variations of updated (existing) variable products are not synced');
  }
  return result;
}

export interface CouponCopyOptions {
  source: WooCommerceService;
  target: WooCommerceService;
  coupons: WooCommerceCoupon[];
  collision: CollisionMode;
}

export async function executeCouponCopy(opts: CouponCopyOptions): Promise<CopyResult> {
  const { source, target, coupons, collision } = opts;
  const result = emptyResult(coupons.length);
  const [sCats, tCats, tCoupons] = await Promise.all([
    source.getProductCategories({ per_page: 100 }),
    target.getProductCategories({ per_page: 100 }),
    target.getAllCoupons({ per_page: 100 }),
  ]);
  if (!sCats.success || !tCats.success || !tCoupons.success) {
    result.failed = coupons.length;
    result.messages.push('Could not read categories or coupons from the stores');
    return result;
  }
  const ctx = buildTargetContext({ categories: tCats.data, coupons: tCoupons.data });
  const slugById = new Map(sCats.data.map((c) => [c.id, c.slug]));

  const creates: CouponUpdateData[] = [];
  const updates: Array<CouponUpdateData & { id: number }> = [];
  for (const c of coupons) {
    const existing = ctx.couponIdByCode.get(norm(c.code));
    if (existing !== undefined && collision === 'skip') {
      result.skipped++;
      continue;
    }
    const { payload, warnings } = buildCouponPayload(c, ctx, slugById);
    warnings.forEach((w) => result.messages.push(`${c.code}: ${w}`));
    if (existing !== undefined) updates.push({ ...payload, id: existing });
    else creates.push(payload);
  }
  await runBatches<CouponUpdateData>(
    creates,
    updates,
    (b) => target.batchCoupons(b as never),
    result
  );
  return result;
}
