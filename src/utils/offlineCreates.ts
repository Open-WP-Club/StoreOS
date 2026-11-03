import type { ApiResponse } from '../types';
import type WooCommerceService from '../services/woocommerce';

type Result = { success: boolean; error?: string };
type Meta = Array<{ key?: string; value?: unknown }> | undefined;
type D = Record<string, unknown>;

/** Meta key carrying the client-generated UUID of a queued create (idempotency key). */
export const CLIENT_ID_META = '_storeos_client_id';
/** Create types that get a client id injected when queued (no natural unique key). */
export const CLIENT_ID_TYPES: string[] = ['create_product', 'create_variation', 'create_order'];

const MARGIN_MS = 24 * 60 * 60 * 1000; // tolerate client/server clock skew
const PAGE = 100;
/** Upper cap on pages scanned for a client id (5,000 items); the scan stops early on a match or short page. */
const MAX_PAGES = 50;

const clientIdOf = (meta: Meta): string | undefined =>
  meta?.find((m) => m.key === CLIENT_ID_META)?.value as string | undefined;

const norm = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toLowerCase();

/**
 * Page through a listing until `isMatch` hits, the listing is exhausted (short page) or MAX_PAGES.
 * A failed page is returned as failure so callers never create blindly.
 */
export async function findByClientId<T>(
  fetchPage: (page: number) => Promise<ApiResponse<T[]>>,
  isMatch: (item: T) => boolean
): Promise<ApiResponse<T | undefined>> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetchPage(page);
    if (!r.success) return r;
    const hit = r.data.find(isMatch);
    if (hit) return { success: true, data: hit };
    if (r.data.length < PAGE) break;
  }
  return { success: true, data: undefined };
}

/** Create only if no match exists; a failed lookup is returned as failure so we never create blindly. */
async function createUnlessExists<T>(
  find: () => Promise<ApiResponse<T[]>>,
  matches: (item: T) => boolean,
  create: () => Promise<Result>
): Promise<Result> {
  const res = await find();
  if (!res.success) return res;
  return res.data.some(matches) ? { success: true } : create();
}

export async function createProductOnce(
  service: WooCommerceService,
  d: D,
  queuedAt: number
): Promise<Result> {
  const clientId = clientIdOf(d.meta_data as Meta);
  const sku = typeof d.sku === 'string' ? d.sku.trim() : '';
  if (!sku && !clientId) {
    return { success: false, error: 'Refusing unguarded product create (no SKU or client id)' };
  }
  if (sku) {
    const r = await service.getProducts({ sku });
    if (!r.success) return r;
    if (r.data.length > 0) return { success: true };
  }
  if (clientId) {
    const after = new Date(queuedAt - MARGIN_MS).toISOString();
    const r = await findByClientId(
      (page) =>
        service.getProducts({ after, per_page: PAGE, page, orderby: 'date', order: 'desc' }),
      (p) => clientIdOf(p.meta_data) === clientId
    );
    if (!r.success) return r;
    if (r.data) return { success: true };
  }
  return service.createProduct(d);
}

export const createCouponOnce = (service: WooCommerceService, d: D) =>
  createUnlessExists(
    () => service.getCoupons({ code: String(d.code ?? '') }),
    (c) => norm(c.code) === norm(d.code),
    () => service.createCoupon(d)
  );

export const createCategoryOnce = (service: WooCommerceService, d: D) =>
  createUnlessExists(
    () => service.getProductCategories({ search: String(d.name ?? ''), per_page: PAGE }),
    (c) =>
      (!!d.slug && norm(c.slug) === norm(d.slug)) ||
      (norm(c.name) === norm(d.name) && c.parent === ((d.parent as number | undefined) ?? 0)),
    () => service.createProductCategory(d)
  );

export const createAttributeOnce = (service: WooCommerceService, d: D) =>
  createUnlessExists(
    () => service.getProductAttributes(),
    (a) =>
      norm(a.name) === norm(d.name) ||
      (!!d.slug && norm(a.slug).replace(/^pa_/, '') === norm(d.slug).replace(/^pa_/, '')),
    () => service.createProductAttribute(d)
  );

export const createTermOnce = (service: WooCommerceService, d: D) => {
  const { attributeId, ...data } = d;
  return createUnlessExists(
    () => service.getAttributeTerms(attributeId as number),
    (t) => norm(t.name) === norm(data.name) || (!!data.slug && norm(t.slug) === norm(data.slug)),
    () => service.createAttributeTerm(attributeId as number, data)
  );
};

export const createTaxRateOnce = (service: WooCommerceService, d: D) =>
  createUnlessExists(
    () => service.getTaxRates({ per_page: PAGE, class: d.class as string | undefined }),
    (r) =>
      norm(r.name) === norm(d.name) &&
      norm(r.rate) === norm(d.rate) &&
      norm(r.country) === norm(d.country) &&
      norm(r.state) === norm(d.state) &&
      norm(r.postcode) === norm(d.postcode) &&
      norm(r.city) === norm(d.city) &&
      (r.priority ?? 1) === ((d.priority as number | undefined) ?? 1),
    () => service.createTaxRate(d)
  );

export const createTaxClassOnce = (service: WooCommerceService, d: D) =>
  createUnlessExists(
    () => service.getTaxClasses(),
    (c) => norm(c.name) === norm(d.name) || norm(c.slug) === norm(d.name),
    () => service.createTaxClass(d as { name: string })
  );

export async function createVariationOnce(service: WooCommerceService, d: D): Promise<Result> {
  const { productId, ...data } = d;
  const clientId = clientIdOf(data.meta_data as Meta);
  if (clientId) {
    const r = await findByClientId(
      (page) => service.getProductVariations(productId as number, { per_page: PAGE, page }),
      (v) => clientIdOf((v as { meta_data?: Meta }).meta_data) === clientId
    );
    if (!r.success) return r;
    if (r.data) return { success: true };
  }
  return service.createProductVariation(productId as number, data);
}

/** Non-POS order create, guarded by client id (scan orders created since the op was queued). */
export async function createOrderOnce(
  service: WooCommerceService,
  d: D,
  queuedAt: number
): Promise<Result> {
  const clientId = clientIdOf(d.meta_data as Meta);
  if (!clientId) return { success: false, error: 'Refusing unguarded order create (no client id)' };
  const after = new Date(queuedAt - MARGIN_MS).toISOString();
  const r = await findByClientId(
    (page) => service.getOrders({ after, per_page: PAGE, page, orderby: 'date', order: 'desc' }),
    (o) => clientIdOf(o.meta_data) === clientId
  );
  if (!r.success) return r;
  return r.data ? { success: true } : service.createOrder(d);
}

/**
 * Batch creates replayed after a lost response must not duplicate: drop create items whose SKU
 * (products) or code (coupons) already exists. Items without that key are sent as is.
 * A failed lookup fails the op (never create blindly).
 */
export async function dropExistingCreates(
  service: WooCommerceService,
  kind: 'products' | 'coupons',
  d: D
): Promise<ApiResponse<D>> {
  const creates = (d.create as D[] | undefined) ?? [];
  const keep: D[] = [];
  for (const item of creates) {
    let exists = false;
    if (kind === 'products') {
      const sku = typeof item.sku === 'string' ? item.sku.trim() : '';
      if (sku) {
        const r = await service.getProducts({ sku });
        if (!r.success) return r;
        exists = r.data.length > 0;
      }
    } else if (item.code) {
      const r = await service.getCoupons({ code: String(item.code) });
      if (!r.success) return r;
      exists = r.data.some((c) => norm(c.code) === norm(item.code));
    }
    if (!exists) keep.push(item);
  }
  const out = { ...d };
  if (keep.length) out.create = keep;
  else delete out.create;
  return { success: true, data: out };
}

/** True when a queued op targets this product (itself, its stock, a batch entry or a variation). */
export function opTouchesProduct(
  op: { type: string; storeId: string; data: D },
  storeId: string,
  productId: number
): boolean {
  if (op.storeId !== storeId) return false;
  const d = op.data;
  if (op.type === 'update_product' || op.type === 'delete_product') return d.id === productId;
  if (op.type === 'update_stock') return d.productId === productId;
  if (op.type.endsWith('_variation') || op.type === 'batch_variations') {
    return d.productId === productId;
  }
  if (op.type === 'batch_products') {
    const b = d as { update?: Array<{ id?: number }>; delete?: number[] };
    return !!b.update?.some((u) => u.id === productId) || !!b.delete?.includes(productId);
  }
  return false;
}
