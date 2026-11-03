import { useMemo } from 'react';
import useOffline from '../stores/offlineStore';
import type {
  PendingOperation,
  PendingOperationType,
  WooCommerceCoupon,
  WooCommerceProduct,
} from '../types';

/**
 * Optimistic placeholders for creates queued offline.
 * They are DERIVED from the offline queue (never written to the cache / IndexedDB), so they
 * vanish automatically when the op is replayed, discarded, cancelled or absent after a restart.
 */
type Kind = 'product' | 'coupon';
type D = Record<string, unknown>;

const CREATE: Record<Kind, PendingOperationType> = {
  product: 'create_product',
  coupon: 'create_coupon',
};
const UPDATE: Record<string, Kind> = { update_product: 'product', update_coupon: 'coupon' };
const DELETE: Record<string, Kind> = { delete_product: 'product', delete_coupon: 'coupon' };

/** Stable negative id for a queued op (real WooCommerce ids are always positive). */
export function tempIdFor(opId: string): number {
  let h = 5381;
  for (let i = 0; i < opId.length; i++) h = ((h * 33) ^ opId.charCodeAt(i)) >>> 0;
  return -((h % 2147483646) + 1);
}

export const isPlaceholderId = (id: unknown): boolean => typeof id === 'number' && id < 0;

/** Drop UI-only placeholders before anything is persisted. */
export const stripPending = <T extends { _pending?: boolean }>(items: T[]): T[] =>
  items.some((i) => i._pending) ? items.filter((i) => !i._pending) : items;

function build(kind: Kind, op: PendingOperation): WooCommerceProduct | WooCommerceCoupon {
  const now = new Date(op.timestamp).toISOString();
  const base = { id: tempIdFor(op.id), date_created: now, date_modified: now, _pending: true };
  if (kind === 'coupon') {
    return {
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
      ...op.data,
      ...base,
    } as unknown as WooCommerceCoupon;
  }
  return {
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
    ...op.data,
    ...base,
  } as unknown as WooCommerceProduct;
}

type Item<K extends Kind> = K extends 'product' ? WooCommerceProduct : WooCommerceCoupon;

export function placeholdersFor<K extends Kind>(
  kind: K,
  ops: PendingOperation[],
  storeId: string | null | undefined
): Item<K>[] {
  return ops
    .filter((o) => o.type === CREATE[kind] && o.storeId === storeId)
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

/**
 * Update/delete of a placeholder never reaches the API: an update merges into the queued create,
 * a delete cancels it. Returns null for non-placeholder targets (normal behaviour).
 */
export function mutatePlaceholder(
  type: PendingOperationType,
  data: D,
  storeId: string
): Outcome | null {
  const kind = UPDATE[type] ?? DELETE[type];
  if (!kind || !isPlaceholderId(data.id)) return null;
  const store = useOffline.getState();
  const create = store.pendingOperations.find(
    (o) => o.type === CREATE[kind] && o.storeId === storeId && tempIdFor(o.id) === data.id
  );
  if (!create) {
    return {
      queued: false,
      success: false,
      error: 'This item has already synced. Refresh and retry.',
    };
  }
  if (type in DELETE) {
    store.removePendingOperation(create.id);
  } else {
    const merged: D = { ...create.data, ...data };
    delete merged.id;
    // Keep the queued create's meta (client id); append any new entries.
    const meta = [
      ...((create.data.meta_data as unknown[]) ?? []),
      ...(Array.isArray(data.meta_data) ? data.meta_data : []),
    ];
    if (meta.length) merged.meta_data = meta;
    else delete merged.meta_data;
    store.updatePendingOperation(create.id, { data: merged });
  }
  return { queued: true, success: false };
}
