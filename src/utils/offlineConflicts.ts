import useCache from '../stores/cacheStore';
import useOffline from '../stores/offlineStore';
import useStoreConfig from '../stores/storeConfigStore';
import type { OperationBase, OperationConflict, PendingOperation } from '../types';
import type WooCommerceService from '../services/woocommerce';

type Item = Record<string, unknown>;
type OpLike = Pick<PendingOperation, 'type' | 'data'>;
type Snap = { modified: string; prev: Item };

type Resource =
  | 'products'
  | 'orders'
  | 'coupons'
  | 'categories'
  | 'attributes'
  | 'terms'
  | 'taxRates'
  | 'reviews'
  | 'variations';

/**
 * Single-item update ops that get conflict detection.
 * Tax classes have no update op: the WooCommerce REST API only lists, creates and deletes them
 * (`/wc/v3/taxes/classes` has no PUT), so there is nothing to conflict.
 */
const SINGLE: Record<string, Resource> = {
  update_product: 'products',
  update_stock: 'products',
  update_order: 'orders',
  update_coupon: 'coupons',
  update_category: 'categories',
  update_attribute: 'attributes',
  update_attribute_term: 'terms',
  update_tax_rate: 'taxRates',
  update_review: 'reviews',
  update_variation: 'variations',
};
/**
 * Batch ops: detection is per `update` item, and per `delete` id for resources with a modified
 * timestamp (a delete is held when the item changed on the server since queue time).
 * batch_variations has no UI caller (Generate all creates online only); its path is API-only.
 */
const BATCH: Record<string, Resource> = {
  batch_reviews: 'reviews',
  batch_products: 'products',
  batch_coupons: 'coupons',
  batch_orders: 'orders',
  batch_variations: 'variations',
};
// These items carry no modified timestamp, so they are compared by value only.
const UNTIMED = new Set<Resource>(['categories', 'attributes', 'terms', 'taxRates', 'reviews']);
const CACHED = new Set<Resource>(['products', 'orders', 'coupons']);

// Fields in op data that are not edits of the item itself.
const SKIP = new Set(['id', 'productId', 'attributeId', 'meta_data']);
const STOCK_ALIAS: Record<string, string> = {
  quantity: 'stock_quantity',
  stockStatus: 'stock_status',
};

/** Item/op data normalised to item field names (stock ops may use quantity/stockStatus). */
export function itemFields(data: Item, stock: boolean): Item {
  const out: Item = {};
  for (const [k, v] of Object.entries(data)) {
    if (SKIP.has(k)) continue;
    out[stock ? (STOCK_ALIAS[k] ?? k) : k] = v;
  }
  return out;
}
export const editedFields = (op: OpLike): Item => itemFields(op.data, op.type === 'update_stock');

const itemId = (op: OpLike): number =>
  (op.type === 'update_stock' ? (op.data.productId ?? op.data.id) : op.data.id) as number;

const modifiedOf = (i: Item): string => String(i.date_modified_gmt ?? i.date_modified ?? '');

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const isNewer = (server: string, base: string): boolean => {
  const s = Date.parse(server);
  const b = Date.parse(base);
  return !Number.isNaN(s) && !Number.isNaN(b) && s > b;
};

const asList = (v: Item | Item[] | undefined): Item[] => (Array.isArray(v) ? v : v ? [v] : []);

function snapshot(r: Resource, item: Item | undefined, edit: Item): Snap | undefined {
  if (!item) return undefined;
  const modified = modifiedOf(item);
  if (!modified && !UNTIMED.has(r)) return undefined;
  const prev: Item = {};
  // Untimed items are compared by value: only fields the snapshot actually knows can conflict.
  for (const f of Object.keys(edit)) if (!UNTIMED.has(r) || f in item) prev[f] = item[f] ?? null;
  return { modified, prev };
}

/**
 * Snapshot of the item at queue time. Source: the store cache (products/orders/coupons) or
 * `current` (the item(s) as the UI shows them, for resources without a cache).
 * Undefined when it can't be determined (replays as before).
 */
export function captureBase(
  type: PendingOperation['type'],
  data: Record<string, unknown>,
  storeId: string,
  current?: Item | Item[]
): OperationBase | undefined {
  const r = SINGLE[type] ?? BATCH[type];
  // The cache only holds the current store's data.
  if (!r || useStoreConfig.getState().currentStoreId !== storeId) return undefined;
  const cached = CACHED.has(r)
    ? ((useCache.getState().cache[r as 'products']?.data as Item[] | null | undefined) ?? [])
    : [];
  const pool = [...asList(current), ...cached];
  if (SINGLE[type]) {
    const id = itemId({ type, data });
    const edit = editedFields({ type, data });
    const snap = snapshot(
      r,
      pool.find((i) => i.id === id),
      edit
    );
    if (!UNTIMED.has(r) || !snap) return snap;
    // UI lists are patched optimistically, so the item may already show my own queued 1st edit.
    // Keep the 1st edit's server baseline for the fields it covers (re-queue-safe: fields the 1st
    // edit didn't touch still hold their server values in the UI).
    const first = useOffline
      .getState()
      .pendingOperations.find(
        (o) =>
          o.type === type &&
          o.storeId === storeId &&
          (type === 'update_attribute_term' ? o.data.attributeId === data.attributeId : true) &&
          o.data.id === id
      );
    if (!first) return snap;
    if (!first.base) return undefined; // legacy op without a baseline: stay unchecked
    for (const f of Object.keys(snap.prev)) {
      if (f in first.base.prev) snap.prev[f] = first.base.prev[f];
    }
    return snap;
  }
  const items: Record<string, Snap> = {};
  for (const u of (data.update as Item[] | undefined) ?? []) {
    const snap = snapshot(
      r,
      pool.find((i) => i.id === u.id),
      itemFields(u, false)
    );
    if (snap) items[String(u.id)] = snap;
  }
  // Deleting something edited elsewhere meanwhile is a conflict too (timed resources only).
  if (!UNTIMED.has(r)) {
    for (const id of (data.delete as number[] | undefined) ?? []) {
      const snap = snapshot(
        r,
        pool.find((i) => i.id === id),
        {}
      );
      if (snap) items[String(id)] = snap;
    }
  }
  return Object.keys(items).length ? { modified: '', prev: {}, items } : undefined;
}

async function fetchItem(
  s: WooCommerceService,
  r: Resource,
  id: number,
  ctx: Item
): Promise<Item | null> {
  const res = await {
    products: () => s.getProduct(id),
    orders: () => s.getOrder(id),
    coupons: () => s.getCoupon(id),
    categories: () => s.getProductCategory(id),
    attributes: () => s.getProductAttribute(id),
    terms: () => s.getAttributeTerm(ctx.attributeId as number, id),
    taxRates: () => s.getTaxRate(id),
    reviews: () => s.getReview(id),
    variations: () => s.getProductVariation(ctx.productId as number, id),
  }[r]();
  return res.success ? (res.data as unknown as Item) : null;
}

/**
 * Fields where the server changed since the snapshot AND now differs from what I'm sending.
 * Empty when the server is unchanged since queue time (timed items) or only other fields changed.
 */
function conflictFields(server: Item, base: Snap, mine: Item): string[] {
  if (base.modified && !isNewer(modifiedOf(server), base.modified)) return [];
  return Object.keys(mine).filter(
    (f) => f in base.prev && !same(server[f], base.prev[f]) && !same(server[f], mine[f])
  );
}

const pick = (server: Item, fields: string[]): Item =>
  Object.fromEntries(fields.map((f) => [f, server[f] ?? null]));

/**
 * Compare the live server item against a single-item op's base snapshot.
 * Null (replay normally) when: no snapshot (legacy op), server unchanged since queue time,
 * the item can't be fetched, or the server edits touched only other fields.
 */
export async function detectConflict(
  service: WooCommerceService,
  op: PendingOperation
): Promise<OperationConflict | null> {
  const r = SINGLE[op.type];
  if (!op.base || !r) return null;
  const server = await fetchItem(service, r, itemId(op), op.data);
  if (!server) return null;
  const mine = editedFields(op);
  const fields = conflictFields(server, op.base, mine);
  if (!fields.length) return null;
  return {
    fields,
    server: pick(server, fields),
    // Stock edits can be re-applied as "server quantity + my change".
    stockDelta:
      op.type === 'update_stock' && fields.includes('stock_quantity')
        ? Number(mine.stock_quantity) - Number(op.base.prev.stock_quantity)
        : undefined,
  };
}

/**
 * Per-item detection for a batch op. Null when nothing is held back. Otherwise `clean` is the
 * batch data to send now and `held` the remainder (conflicting update items) to keep as a conflicted op.
 * ponytail: one fetch per snapshotted update item; fine for typical batch sizes.
 */
export async function splitBatch(
  service: WooCommerceService,
  op: PendingOperation
): Promise<{
  clean: Record<string, unknown>;
  held: { data: Record<string, unknown>; base: OperationBase; conflict: OperationConflict };
} | null> {
  const r = BATCH[op.type];
  const snaps = op.base?.items;
  if (!r || !snaps) return null;
  const keep: Item[] = [];
  const held: Item[] = [];
  const keepDel: number[] = [];
  const heldDel: number[] = [];
  const items: NonNullable<OperationConflict['items']> = [];
  const heldSnaps: Record<string, Snap> = {};
  for (const u of (op.data.update as Item[] | undefined) ?? []) {
    const snap = snaps[String(u.id)];
    const server = snap ? await fetchItem(service, r, u.id as number, op.data) : null;
    const fields = server && snap ? conflictFields(server, snap, itemFields(u, false)) : [];
    if (!server || !snap || !fields.length) {
      keep.push(u);
      continue;
    }
    held.push(u);
    heldSnaps[String(u.id)] = snap;
    items.push({ id: u.id as number, fields, server: pick(server, fields) });
  }
  // A delete is held when the item was modified on the server after the queue-time snapshot.
  for (const id of (op.data.delete as number[] | undefined) ?? []) {
    const snap = snaps[String(id)];
    const server = snap?.modified ? await fetchItem(service, r, id, op.data) : null;
    if (!server || !snap || !isNewer(modifiedOf(server), snap.modified)) {
      keepDel.push(id);
      continue;
    }
    heldDel.push(id);
    heldSnaps[String(id)] = snap;
    items.push({ id, fields: ['deleted'], server: { deleted: false } });
  }
  if (!held.length && !heldDel.length) return null;
  const rest = { ...op.data };
  delete rest.create;
  delete rest.update;
  delete rest.delete;
  return {
    clean: withLists(op.data, keep, keepDel),
    held: {
      data: withLists(rest, held, heldDel),
      base: { modified: '', prev: {}, items: heldSnaps },
      conflict: { fields: [], server: {}, items },
    },
  };
}

/** Batch data with its update/delete lists replaced; empty lists are dropped. */
function withLists(data: Record<string, unknown>, update: Item[], del: number[]) {
  const out = { ...data };
  delete out.update;
  delete out.delete;
  if (update.length) out.update = update;
  if (del.length) out.delete = del;
  return out;
}

/** Batch op containing only update item `id` (no snapshot, so it is not re-checked). */
export function singleItemOp(op: PendingOperation, id: number): PendingOperation {
  const update = ((op.data.update as Item[] | undefined) ?? []).filter((u) => u.id === id);
  const del = ((op.data.delete as number[] | undefined) ?? []).filter((d) => d === id);
  return { ...op, data: withLists(op.data, update, del), base: undefined, conflict: undefined };
}

/**
 * Updates for the op after held batch item `id` was resolved.
 * Null when no held items remain (the op is finished).
 */
export function withoutHeldItem(
  op: PendingOperation,
  id: number
): Partial<PendingOperation> | null {
  const items = (op.conflict?.items ?? []).filter((i) => i.id !== id);
  if (!items.length) return null;
  const snaps = { ...op.base?.items };
  delete snaps[String(id)];
  return {
    data: withLists(
      op.data,
      ((op.data.update as Item[] | undefined) ?? []).filter((u) => u.id !== id),
      ((op.data.delete as number[] | undefined) ?? []).filter((d) => d !== id)
    ),
    base: { modified: '', prev: {}, items: snaps },
    conflict: { fields: [], server: {}, items },
  };
}

/** Current server quantity of a stock op's product (null when unreadable). */
export async function freshStockDeltaData(
  service: WooCommerceService,
  op: PendingOperation
): Promise<Record<string, unknown> | null> {
  const server = await fetchItem(service, 'products', itemId(op), op.data);
  return server ? stockDeltaData(op, Number(server.stock_quantity)) : null;
}

/** After a resolution the cached copy may be stale: drop it so it reloads from the server. */
export function invalidateCached(op: PendingOperation): void {
  const r = SINGLE[op.type] ?? BATCH[op.type];
  if (r && CACHED.has(r) && useStoreConfig.getState().currentStoreId === op.storeId) {
    void useCache.getState().clearCacheForType(r as 'products');
  }
}

/** New op data adding my stock change onto the server quantity. Null when not applicable. */
export function stockDeltaData(
  op: PendingOperation,
  serverQty = Number(op.conflict?.server.stock_quantity)
): Record<string, unknown> | null {
  const c = op.conflict;
  if (!c || c.stockDelta === undefined || Number.isNaN(serverQty) || Number.isNaN(c.stockDelta)) {
    return null;
  }
  const quantity = Math.max(0, serverQty + c.stockDelta);
  const mine = editedFields(op).stock_status;
  const stock_status =
    quantity > 0 ? 'instock' : mine === 'onbackorder' ? 'onbackorder' : 'outofstock';
  return { id: itemId(op), stock_quantity: quantity, stock_status };
}
