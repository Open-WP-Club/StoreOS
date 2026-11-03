import type { ApiResponse } from '../types';
import type WooCommerceService from '../services/woocommerce';

type Result = { success: boolean; error?: string };
type Meta = Array<{ key?: string; value?: unknown }> | undefined;
type D = Record<string, unknown>;

/** Meta key carrying the client-generated UUID of a queued create (idempotency key). */
export const CLIENT_ID_META = '_storeos_client_id';
/** Create types that get a client id injected when queued (no natural unique key). */
export const CLIENT_ID_TYPES: string[] = ['create_product', 'create_variation'];

const MARGIN_MS = 24 * 60 * 60 * 1000; // tolerate client/server clock skew
const PAGE = 100;
const MAX_PAGES = 5;

export const clientIdOf = (meta: Meta): string | undefined =>
  meta?.find((m) => m.key === CLIENT_ID_META)?.value as string | undefined;

const norm = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toLowerCase();

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
    for (let page = 1; page <= MAX_PAGES; page++) {
      const r = await service.getProducts({
        after,
        per_page: PAGE,
        page,
        orderby: 'date',
        order: 'desc',
      });
      if (!r.success) return r;
      if (r.data.some((p) => clientIdOf(p.meta_data) === clientId)) return { success: true };
      if (r.data.length < PAGE) break;
    }
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

export const createVariationOnce = (service: WooCommerceService, d: D) => {
  const { productId, ...data } = d;
  const clientId = clientIdOf(data.meta_data as Meta);
  return createUnlessExists(
    () => service.getProductVariations(productId as number, { per_page: PAGE }),
    (v) => !!clientId && clientIdOf((v as { meta_data?: Meta }).meta_data) === clientId,
    () => service.createProductVariation(productId as number, data)
  );
};
