import { useMemo } from 'react';
import useOffline from '../stores/offlineStore';
import type {
  PendingOperation,
  PendingOperationType,
  ProductVariation,
  WooCommerceAttributeTerm,
  WooCommerceCoupon,
  WooCommerceOrder,
  WooCommerceProduct,
  WooCommerceProductAttribute,
  WooCommerceProductCategory,
  WooCommerceTaxClass,
  WooCommerceTaxRate,
} from '../types';

/**
 * Optimistic placeholders for creates queued offline.
 * They are DERIVED from the offline queue (never written to the cache / IndexedDB), so they
 * vanish automatically when the op is replayed, discarded, cancelled or absent after a restart.
 */
type D = Record<string, unknown>;

interface KindDef {
  create: PendingOperationType;
  update?: PendingOperationType;
  delete?: PendingOperationType;
  batch?: PendingOperationType;
  defaults: D;
}

const KINDS = {
  // Orders are created offline by the POS; they can't be deleted one by one (only via batch_orders).
  order: {
    create: 'create_order',
    update: 'update_order',
    batch: 'batch_orders',
    defaults: {
      parent_id: 0,
      number: '',
      status: 'pending',
      currency: '',
      discount_total: '0',
      shipping_total: '0',
      total: '0',
      total_tax: '0',
      customer_id: 0,
      customer_note: '',
      billing: {},
      shipping: {},
      payment_method: '',
      payment_method_title: '',
      date_paid: null,
      date_completed: null,
      meta_data: [],
      line_items: [],
      tax_lines: [],
      shipping_lines: [],
      fee_lines: [],
      coupon_lines: [],
      refunds: [],
    },
  },
  product: {
    create: 'create_product',
    update: 'update_product',
    delete: 'delete_product',
    batch: 'batch_products',
    defaults: {
      name: '',
      sku: '',
      type: 'simple',
      status: 'publish',
      price: '',
      regular_price: '',
      sale_price: '',
      stock_quantity: null,
      stock_status: 'instock',
      manage_stock: false,
      description: '',
      short_description: '',
      categories: [],
      tags: [],
      images: [],
      attributes: [],
      variations: [],
      meta_data: [],
    },
  },
  coupon: {
    create: 'create_coupon',
    update: 'update_coupon',
    delete: 'delete_coupon',
    batch: 'batch_coupons',
    defaults: {
      code: '',
      amount: '0',
      discount_type: 'percent',
      description: '',
      date_expires: null,
      usage_count: 0,
      individual_use: false,
      product_ids: [],
      excluded_product_ids: [],
      usage_limit: null,
      usage_limit_per_user: null,
      free_shipping: false,
      product_categories: [],
      excluded_product_categories: [],
      exclude_sale_items: false,
      minimum_amount: '',
      maximum_amount: '',
      email_restrictions: [],
      used_by: [],
      meta_data: [],
    },
  },
  category: {
    create: 'create_category',
    update: 'update_category',
    delete: 'delete_category',
    defaults: {
      name: '',
      slug: '',
      parent: 0,
      description: '',
      display: 'default',
      image: null,
      menu_order: 0,
      count: 0,
    },
  },
  attribute: {
    create: 'create_attribute',
    update: 'update_attribute',
    delete: 'delete_attribute',
    defaults: { name: '', slug: '', type: 'select', order_by: 'menu_order', has_archives: false },
  },
  term: {
    create: 'create_attribute_term',
    update: 'update_attribute_term',
    delete: 'delete_attribute_term',
    defaults: { name: '', slug: '', description: '', menu_order: 0, count: 0 },
  },
  tax_rate: {
    create: 'create_tax_rate',
    update: 'update_tax_rate',
    delete: 'delete_tax_rate',
    defaults: {
      country: '',
      state: '',
      postcode: '',
      city: '',
      postcodes: [],
      cities: [],
      rate: '',
      name: '',
      priority: 1,
      compound: false,
      shipping: true,
      order: 0,
      class: '',
    },
  },
  // Tax classes have no update; they are deleted by slug (a pending one also carries its temp id).
  tax_class: {
    create: 'create_tax_class',
    delete: 'delete_tax_class',
    defaults: { name: '', slug: '' },
  },
  variation: {
    create: 'create_variation',
    update: 'update_variation',
    delete: 'delete_variation',
    batch: 'batch_variations',
    defaults: {
      description: '',
      sku: '',
      price: '',
      regular_price: '',
      sale_price: '',
      on_sale: false,
      status: 'publish',
      virtual: false,
      downloadable: false,
      manage_stock: false,
      stock_quantity: null,
      stock_status: 'instock',
      attributes: [],
      image: null,
      meta_data: [],
    },
  },
} satisfies Record<string, KindDef>;

export type Kind = keyof typeof KINDS;
const kindEntries = Object.entries(KINDS) as Array<[Kind, KindDef]>;
const kindOf = (pick: (k: KindDef) => PendingOperationType | undefined, type: string) =>
  kindEntries.find(([, k]) => pick(k) === type)?.[0];

/** Stable negative id for a queued op (real WooCommerce ids are always positive). */
export function tempIdFor(opId: string): number {
  let h = 5381;
  for (let i = 0; i < opId.length; i++) h = ((h * 33) ^ opId.charCodeAt(i)) >>> 0;
  return -((h % 2147483646) + 1);
}

/** WooCommerce-style slug (tax class slugs are derived from the name). */
const slugify = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const isPlaceholderId = (id: unknown): boolean => typeof id === 'number' && id < 0;

/** Drop UI-only placeholders before anything is persisted. */
export const stripPending = <T extends { _pending?: boolean }>(items: T[]): T[] =>
  items.some((i) => i._pending) ? items.filter((i) => !i._pending) : items;

interface ItemMap {
  product: WooCommerceProduct;
  coupon: WooCommerceCoupon;
  order: WooCommerceOrder;
  category: WooCommerceProductCategory;
  attribute: WooCommerceProductAttribute;
  term: WooCommerceAttributeTerm;
  tax_rate: WooCommerceTaxRate;
  tax_class: WooCommerceTaxClass;
  variation: ProductVariation;
}
type Item<K extends Kind> = ItemMap[K];

const isPosOp = (op: PendingOperation): boolean =>
  typeof op.data.clientId === 'string' && typeof op.data.order === 'object' && !!op.data.order;

function build(kind: Kind, op: PendingOperation): unknown {
  const now = new Date(op.timestamp).toISOString();
  const slug = kind === 'tax_class' ? slugify(String(op.data.name ?? '')) : undefined;
  // POS sales are queued as { clientId, order }: show the order payload.
  const payload = kind === 'order' && isPosOp(op) ? (op.data.order as D) : op.data;
  return {
    ...KINDS[kind].defaults,
    ...payload,
    ...(slug !== undefined && { slug }),
    id: tempIdFor(op.id),
    date_created: now,
    date_modified: now,
    ...(kind === 'order' && { date_created_gmt: now, date_modified_gmt: now }),
    _pending: true,
  };
}

export function placeholdersFor<K extends Kind>(
  kind: K,
  ops: PendingOperation[],
  storeId: string | null | undefined
): Item<K>[] {
  return ops
    .filter((o) => o.type === KINDS[kind].create && o.storeId === storeId)
    .map((o) => build(kind, o) as Item<K>)
    .reverse(); // newest first, like a fresh server create
}

/** Hook: the current store's placeholders for a list page. */
export function usePlaceholders<K extends Kind>(
  kind: K,
  storeId: string | null | undefined
): Item<K>[] {
  const ops = useOffline((s) => s.pendingOperations);
  return useMemo(() => placeholdersFor(kind, ops, storeId), [kind, ops, storeId]);
}

type Outcome = { queued: true; success: false } | { queued: false; success: false; error: string };
const SYNCED = 'This item has already synced. Refresh and retry.';

const findCreate = (kind: Kind, id: unknown, storeId: string): PendingOperation | undefined =>
  useOffline
    .getState()
    .pendingOperations.find(
      (o) => o.type === KINDS[kind].create && o.storeId === storeId && tempIdFor(o.id) === id
    );

/** Merge an update (data.id = temp id) into the queued create it targets. */
function mergeInto(create: PendingOperation, data: D): void {
  // POS sales keep their order payload under `order` (replay reads it from there).
  if (isPosOp(create)) {
    const inner = mergeData(create.data.order as D, data);
    useOffline
      .getState()
      .updatePendingOperation(create.id, { data: { ...create.data, order: inner } });
    return;
  }
  useOffline.getState().updatePendingOperation(create.id, { data: mergeData(create.data, data) });
}

function mergeData(target: D, data: D): D {
  const merged: D = { ...target, ...data };
  delete merged.id;
  // Keep the queued create's meta (client id); append any new entries.
  const meta = [
    ...((target.meta_data as unknown[]) ?? []),
    ...(Array.isArray(data.meta_data) ? data.meta_data : []),
  ];
  if (meta.length) merged.meta_data = meta;
  else delete merged.meta_data;
  return merged;
}

/**
 * Update/delete of a placeholder never reaches the API: an update merges into the queued create,
 * a delete cancels it. Returns null for non-placeholder targets (normal behaviour).
 */
export function mutatePlaceholder(
  type: PendingOperationType,
  data: D,
  storeId: string
): Outcome | null {
  // A stock edit of a pending product just sets its stock fields on the queued create.
  const stock = type === 'update_stock';
  const kind: Kind | undefined = stock
    ? 'product'
    : (kindOf((k) => k.update, type) ?? kindOf((k) => k.delete, type));
  const id = stock ? (data.productId ?? data.id) : data.id;
  if (!kind || !isPlaceholderId(id)) return null;
  const create = findCreate(kind, id, storeId);
  if (!create) return { queued: false, success: false, error: SYNCED };
  if (type === (KINDS[kind] as KindDef).delete)
    useOffline.getState().removePendingOperation(create.id);
  else if (stock) {
    const { quantity, stockStatus, stock_quantity, stock_status } = data;
    const qty = quantity ?? stock_quantity;
    const status = stockStatus ?? stock_status;
    mergeInto(create, {
      manage_stock: true,
      ...(qty !== undefined && { stock_quantity: qty }),
      ...(status !== undefined && { stock_status: status }),
    });
  } else mergeInto(create, data);
  return { queued: true, success: false };
}

type BatchOutcome = { data: D | null } | { error: string };

/**
 * Bulk edit/delete containing placeholder ids: deletes cancel the queued creates, updates merge
 * into them, and only the real ids are returned (data null when nothing real is left).
 * All-or-nothing: if any placeholder has already synced nothing is applied. Null = no placeholders.
 */
export function interceptBatch(
  type: PendingOperationType,
  data: D,
  storeId: string
): BatchOutcome | null {
  const kind = kindOf((k) => k.batch, type);
  if (!kind) return null;
  const updates = (Array.isArray(data.update) ? data.update : []) as Array<D>;
  const deletes = (Array.isArray(data.delete) ? data.delete : []) as number[];
  const phUpdates = updates.filter((u) => isPlaceholderId(u.id));
  const phDeletes = deletes.filter(isPlaceholderId);
  if (!phUpdates.length && !phDeletes.length) return null;

  const targets = [...phUpdates.map((u) => u.id), ...phDeletes];
  const creates = targets.map((id) => findCreate(kind, id, storeId));
  if (creates.some((c) => !c)) return { error: SYNCED };

  phUpdates.forEach((u) => mergeInto(findCreate(kind, u.id, storeId)!, u));
  phDeletes.forEach((id) =>
    useOffline.getState().removePendingOperation(findCreate(kind, id, storeId)!.id)
  );

  const rest: D = { ...data };
  const realUpdates = updates.filter((u) => !isPlaceholderId(u.id));
  const realDeletes = deletes.filter((id) => !isPlaceholderId(id));
  if (realUpdates.length) rest.update = realUpdates;
  else delete rest.update;
  if (realDeletes.length) rest.delete = realDeletes;
  else delete rest.delete;
  const left = ['create', 'update', 'delete'].some((k) => rest[k] !== undefined);
  return { data: left ? rest : null };
}
