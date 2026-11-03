import type WooCommerceService from '../services/woocommerce';
import { batchErrorIds } from './batchResult';
import type {
  Product,
  ProductUpdateData,
  ProductVariation,
  VariationCreateData,
  VariationUpdateData,
  WooCommerceCoupon,
  CouponUpdateData,
  WooCommerceProductCategory,
  WooCommerceProductAttribute,
} from '../types';

export type CollisionMode = 'skip' | 'update';

const COPY_CHUNK_SIZE = 25;

export const norm = (s: string | undefined | null): string => (s ?? '').trim().toLowerCase();

export function chunk<T>(arr: T[], size = COPY_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Target-side lookup tables used to remap source references. */
interface TargetContext {
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

interface ProductPayloadResult {
  payload: ProductUpdateData;
  warnings: string[];
}

/** Build a create/update payload from a source product: no ids/links, remapped refs, image URLs only. */
export function buildProductPayload(
  source: Product,
  ctx: TargetContext,
  /** source product id -> sku, used to map upsell/cross-sell links onto existing target products */
  skuBySourceId?: Map<number, string>
): ProductPayloadResult {
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
  // Links map via SKU to products already in the target; the rest are dropped silently.
  // related_ids is read-only in the WooCommerce REST API, so it is not sent.
  const mapLinks = (ids?: number[]): number[] =>
    (ids ?? []).flatMap((id) => {
      const sku = skuBySourceId?.get(id);
      const t = sku ? ctx.productIdBySku.get(norm(sku)) : undefined;
      return t === undefined ? [] : [t];
    });

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
    upsell_ids: mapLinks(source.upsell_ids),
    cross_sell_ids: mapLinks(source.cross_sell_ids),
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

interface PlannedCategory {
  srcId: number;
  /** source id of the parent that is also being created (undefined: top-level or existing parent) */
  parentSrcId?: number;
  /** target id of an already-existing parent (0 = top-level) */
  parentTargetId: number;
  name: string;
  slug: string;
  depth: number;
}

interface CategoryPlan {
  /** Categories to create, parents always before children. */
  toCreate: PlannedCategory[];
  /** source category id -> target id for categories that already exist in the target */
  matched: Map<number, number>;
  warnings: string[];
}

type CatLike = Pick<WooCommerceProductCategory, 'id' | 'name' | 'slug' | 'parent'>;

/** Normalized names from the root down to the category, e.g. "men/shirts". Cycle-safe. */
function namePath(c: CatLike, byId: Map<number, CatLike>): string {
  const names: string[] = [];
  const seen = new Set<number>();
  for (let cur: CatLike | undefined = c; cur && !seen.has(cur.id); cur = byId.get(cur.parent)) {
    seen.add(cur.id);
    names.unshift(norm(cur.name));
  }
  return names.join('/');
}

/**
 * Match needed source categories (plus ancestors) to the target by slug, falling back to
 * the full ancestor name path. Missing ones are planned parents-first.
 */
export function planCategories(
  sourceCats: CatLike[],
  targetCats: CatLike[],
  needed: Array<{ id: number; name: string; slug: string }>
): CategoryPlan {
  const byId = new Map(sourceCats.map((c) => [c.id, c]));
  const tSlug = new Map(targetCats.map((c) => [norm(c.slug), c.id]));
  const tById = new Map(targetCats.map((c) => [c.id, c]));
  const tPath = new Map(targetCats.map((c) => [namePath(c, tById), c.id]));
  const plan: CategoryPlan = { toCreate: [], matched: new Map(), warnings: [] };
  const planned = new Map<number, PlannedCategory>();
  const visiting = new Set<number>();

  const resolve = (src: CatLike): { targetId?: number; planned?: PlannedCategory } => {
    const done = plan.matched.get(src.id);
    if (done !== undefined) return { targetId: done };
    const was = planned.get(src.id);
    if (was) return { planned: was };

    visiting.add(src.id);
    let parent: { targetId?: number; planned?: PlannedCategory } = { targetId: 0 };
    if (src.parent) {
      const p = byId.get(src.parent);
      if (!p) {
        plan.warnings.push(
          `Category "${src.name}": parent #${src.parent} is not in the source list; created top-level`
        );
      } else if (visiting.has(p.id)) {
        plan.warnings.push(`Category "${src.name}": parent cycle detected; created top-level`);
      } else {
        parent = resolve(p);
      }
    }
    visiting.delete(src.id);

    const parentTargetId = parent.targetId ?? 0;
    const existing =
      tSlug.get(norm(src.slug)) ?? (parent.planned ? undefined : tPath.get(namePath(src, byId)));
    if (existing !== undefined) {
      plan.matched.set(src.id, existing);
      return { targetId: existing };
    }
    const entry: PlannedCategory = {
      srcId: src.id,
      parentSrcId: parent.planned?.srcId,
      parentTargetId,
      name: src.name,
      slug: src.slug,
      depth: parent.planned ? parent.planned.depth + 1 : 0,
    };
    planned.set(src.id, entry);
    plan.toCreate.push(entry);
    return { planned: entry };
  };

  for (const n of needed) {
    resolve(byId.get(n.id) ?? { id: n.id, name: n.name, slug: n.slug, parent: 0 });
  }
  return plan;
}

/** Fetch every category (paged) so >100 categories do not truncate the hierarchy. */
export async function fetchAllCategories(
  svc: WooCommerceService
): Promise<{ ok: true; data: WooCommerceProductCategory[] } | { ok: false; error: string }> {
  const all: WooCommerceProductCategory[] = [];
  for (let page = 1; page <= 50; page++) {
    const r = await svc.getProductCategories({ per_page: 100, page });
    if (!r.success) return { ok: false, error: r.error };
    all.push(...r.data);
    if (r.data.length < 100) break;
  }
  return { ok: true, data: all };
}

/**
 * Create the planned categories level by level (chunked batches), then record source slug ->
 * target id in ctx.categoryIdBySlug for payload remapping. Failures become warnings; children
 * of a failed parent are not created.
 */
async function applyCategoryPlan(
  plan: CategoryPlan,
  sourceCats: CatLike[],
  target: WooCommerceService,
  ctx: TargetContext,
  create: boolean,
  messages: string[]
): Promise<void> {
  const slugOf = new Map(sourceCats.map((c) => [c.id, c.slug]));
  const idOf = new Map(plan.matched);
  plan.matched.forEach((tid, sid) => {
    const s = slugOf.get(sid);
    if (s) ctx.categoryIdBySlug.set(norm(s), tid);
  });
  if (!create) return;

  let failed = 0;
  const maxDepth = Math.max(-1, ...plan.toCreate.map((c) => c.depth));
  for (let d = 0; d <= maxDepth; d++) {
    const level: PlannedCategory[] = [];
    for (const c of plan.toCreate.filter((x) => x.depth === d)) {
      if (c.parentSrcId !== undefined && !idOf.has(c.parentSrcId)) {
        failed++;
        messages.push(`Category "${c.name}" not created: its parent failed`);
      } else level.push(c);
    }
    const res = emptyResult(level.length);
    const ids: number[] = [];
    await runBatches(
      level.map((c) => ({
        name: c.name,
        slug: c.slug,
        parent: c.parentSrcId !== undefined ? (idOf.get(c.parentSrcId) ?? 0) : c.parentTargetId,
      })),
      [],
      (b) => target.batchProductCategories(b as never),
      res,
      (got) => ids.push(...got)
    );
    failed += res.failed;
    messages.push(...res.messages.map((m) => `Categories: ${m}`));
    level.forEach((c, i) => {
      const id = ids[i];
      if (id) {
        idOf.set(c.srcId, id);
        ctx.categoryIdBySlug.set(norm(c.slug), id);
      }
    });
  }
  if (failed) {
    messages.push(
      `${failed} of ${plan.toCreate.length} categories could not be created; affected products keep their other categories`
    );
  }
}

export interface ProductCopyPreview {
  willCreate: Product[];
  collisions: Product[];
  /** Categories that do not exist in the target (created first unless disabled). */
  missingCategories: Array<{ slug: string; name: string }>;
  /** Planned new categories in creation order (parents first); depth is the indent level. */
  newCategories: Array<{ slug: string; name: string; depth: number }>;
  categoryWarnings: string[];
  /** Global attributes missing in the target (copied as custom attributes). */
  unmatchedAttributes: string[];
  variableCount: number;
}

export function previewProductCopy(
  products: Product[],
  ctx: TargetContext,
  plan?: CategoryPlan
): ProductCopyPreview {
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
    missingCategories: plan
      ? plan.toCreate.map((c) => ({ slug: c.slug, name: c.name }))
      : [...missing].map(([slug, name]) => ({ slug, name })),
    newCategories: plan?.toCreate.map(({ slug, name, depth }) => ({ slug, name, depth })) ?? [],
    categoryWarnings: plan?.warnings ?? [],
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

interface ProductCopyOptions {
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
): Promise<
  | { ok: true; ctx: TargetContext; categories: WooCommerceProductCategory[] }
  | { ok: false; error: string }
> {
  const [cats, attrs, prods] = await Promise.all([
    fetchAllCategories(target),
    target.getProductAttributes(),
    target.getAllProducts({ per_page: 100 }),
  ]);
  if (!cats.ok) return { ok: false, error: cats.error };
  if (!attrs.success) return { ok: false, error: attrs.error };
  if (!prods.success) return { ok: false, error: prods.error };
  return {
    ok: true,
    categories: cats.data,
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

  const srcCats = await fetchAllCategories(source);
  if (!srcCats.ok) {
    result.messages.push(`Could not read source categories (${srcCats.error}); hierarchy not kept`);
  }
  const sourceCats = srcCats.ok ? srcCats.data : [];
  const plan = planCategories(
    sourceCats,
    loaded.categories,
    products.flatMap((p) => p.categories ?? [])
  );
  result.messages.push(...plan.warnings);
  await applyCategoryPlan(
    plan,
    sourceCats,
    target,
    ctx,
    opts.createMissingCategories,
    result.messages
  );

  const skuBySourceId = new Map<number, string>();
  products.forEach((p) => p.sku && skuBySourceId.set(p.id, p.sku));
  const linkIds = [
    ...new Set(products.flatMap((p) => [...(p.upsell_ids ?? []), ...(p.cross_sell_ids ?? [])])),
  ].filter((id) => !skuBySourceId.has(id));
  for (const ids of chunk(linkIds, 100)) {
    const r = await source.getProducts({ include: ids, per_page: 100 });
    if (r.success) r.data.forEach((p) => p.sku && skuBySourceId.set(p.id, p.sku));
  }

  const creates: Array<{ src: Product; payload: ProductUpdateData }> = [];
  const updates: Array<{ src: Product; payload: ProductUpdateData & { id: number } }> = [];
  for (const p of products) {
    const existing = p.sku ? ctx.productIdBySku.get(norm(p.sku)) : undefined;
    if (existing !== undefined && collision === 'skip') {
      result.skipped++;
      continue;
    }
    const { payload, warnings } = buildProductPayload(p, ctx, skuBySourceId);
    warnings.forEach((w) => result.messages.push(`${p.name}: ${w}`));
    if (existing !== undefined) updates.push({ src: p, payload: { ...payload, id: existing } });
    else creates.push({ src: p, payload });
  }

  onProgress?.('Copying products...');
  const createdVariable: Array<{ src: Product; id: number }> = [];
  const newIdBySrc = new Map<number, number>();
  let cursor = 0;
  await runBatches<ProductUpdateData>(
    creates.map((c) => c.payload),
    updates.map((u) => u.payload),
    (b) => target.batchProducts(b as never),
    result,
    (ids) =>
      ids.forEach((id) => {
        const c = creates[cursor++];
        if (c && id) newIdBySrc.set(c.src.id, id);
        if (c && id && c.src.type === 'variable') createdVariable.push({ src: c.src, id });
      })
  );

  // Second pass: upsell/cross-sell links to products created in this run (ids unknown until now).
  const extra = (ids: number[] | undefined, have: number[]): number[] => [
    ...new Set(
      (ids ?? []).flatMap((id) => newIdBySrc.get(id) ?? []).filter((n) => !have.includes(n))
    ),
  ];
  const linkUpdates = [
    ...creates.map((c) => ({ src: c.src, payload: c.payload, id: newIdBySrc.get(c.src.id) })),
    ...updates.map((u) => ({ src: u.src, payload: u.payload, id: u.payload.id })),
  ].flatMap(({ src, payload, id }) => {
    const p = payload as { upsell_ids?: number[]; cross_sell_ids?: number[] };
    const up = extra(src.upsell_ids, p.upsell_ids ?? []);
    const cross = extra(src.cross_sell_ids, p.cross_sell_ids ?? []);
    if (!id || (!up.length && !cross.length)) return [];
    return [
      {
        id,
        upsell_ids: [...(p.upsell_ids ?? []), ...up],
        cross_sell_ids: [...(p.cross_sell_ids ?? []), ...cross],
      },
    ];
  });
  for (const part of chunk(linkUpdates)) {
    const res = await target.batchProducts({ update: part } as never);
    const bad = res.success ? batchErrorIds(res.data, 'update').length : part.length;
    if (bad) result.messages.push(`Product links: ${bad} of ${part.length} updates failed`);
  }

  // Variations are best-effort. Existing products match by SKU, else by attribute combination.
  const varKey = (v: { sku?: string; attributes: Array<{ name: string; option: string }> }) =>
    v.sku
      ? `sku:${norm(v.sku)}`
      : v.attributes
          .map((a) => `${norm(a.name)}=${norm(a.option)}`)
          .sort()
          .join('|');
  const syncVariations = async (src: Product, id: number, existing: boolean): Promise<void> => {
    const vars = await source.getProductVariations(src.id, { per_page: 100 });
    if (!vars.success) {
      result.messages.push(`${src.name}: could not read variations (${vars.error})`);
      return;
    }
    const batch: { create: VariationCreateData[]; update?: VariationUpdateData[] } = { create: [] };
    if (existing) {
      const cur = await target.getProductVariations(id, { per_page: 100 });
      if (!cur.success) {
        result.messages.push(`${src.name}: could not read target variations (${cur.error})`);
        return;
      }
      const byKey = new Map(cur.data.map((v) => [varKey(v), v.id]));
      batch.update = [];
      for (const v of vars.data) {
        const tid = byKey.get(varKey(v));
        if (tid !== undefined) batch.update.push({ ...buildVariationPayload(v), id: tid });
        else batch.create.push(buildVariationPayload(v));
      }
    } else batch.create = vars.data.map(buildVariationPayload);
    const res = await target.batchProductVariations(id, batch);
    if (!res.success) result.messages.push(`${src.name}: variations failed (${res.error})`);
    else {
      const bad =
        batchErrorIds(res.data, 'create').length + batchErrorIds(res.data, 'update').length;
      if (bad) result.messages.push(`${src.name}: ${bad} of ${vars.data.length} variations failed`);
    }
  };
  for (const { src, id } of createdVariable) await syncVariations(src, id, false);
  for (const u of updates)
    if (u.src.type === 'variable') await syncVariations(u.src, u.payload.id, true);
  return result;
}

interface CouponCopyOptions {
  source: WooCommerceService;
  target: WooCommerceService;
  coupons: WooCommerceCoupon[];
  collision: CollisionMode;
  /** Create restriction categories missing in the target (hierarchy kept). Default false. */
  createMissingCategories?: boolean;
}

export async function executeCouponCopy(opts: CouponCopyOptions): Promise<CopyResult> {
  const { source, target, coupons, collision } = opts;
  const result = emptyResult(coupons.length);
  const [sCats, tCats, tCoupons] = await Promise.all([
    fetchAllCategories(source),
    fetchAllCategories(target),
    target.getAllCoupons({ per_page: 100 }),
  ]);
  if (!sCats.ok || !tCats.ok || !tCoupons.success) {
    result.failed = coupons.length;
    result.messages.push('Could not read categories or coupons from the stores');
    return result;
  }
  const ctx = buildTargetContext({ categories: tCats.data, coupons: tCoupons.data });
  const slugById = new Map(sCats.data.map((c) => [c.id, c.slug]));
  const wanted = new Set(
    coupons.flatMap((c) => [
      ...(c.product_categories ?? []),
      ...(c.excluded_product_categories ?? []),
    ])
  );
  const plan = planCategories(
    sCats.data,
    tCats.data,
    [...wanted].filter((id) => slugById.has(id)).map((id) => ({ id, name: '', slug: '' }))
  );
  result.messages.push(...plan.warnings);
  await applyCategoryPlan(
    plan,
    sCats.data,
    target,
    ctx,
    opts.createMissingCategories === true,
    result.messages
  );

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
