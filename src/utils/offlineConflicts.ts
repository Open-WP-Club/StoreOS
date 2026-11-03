import useCache from '../stores/cacheStore';
import useStoreConfig from '../stores/storeConfigStore';
import type { OperationBase, OperationConflict, PendingOperation } from '../types';
import type WooCommerceService from '../services/woocommerce';

type Item = Record<string, unknown>;
type OpLike = Pick<PendingOperation, 'type' | 'data'>;

/** Op types that get conflict detection (single-item updates of cached resources). */
const KINDS = {
  update_product: 'products',
  update_stock: 'products',
  update_order: 'orders',
  update_coupon: 'coupons',
} as const;

const kindOf = (type: string): 'products' | 'orders' | 'coupons' | undefined =>
  KINDS[type as keyof typeof KINDS];

// Fields in op data that are not edits of the item itself.
const SKIP = new Set(['id', 'productId', 'meta_data']);

/** Op data normalised to item field names (stock ops may use quantity/stockStatus). */
export function editedFields(op: OpLike): Item {
  const out: Item = {};
  for (const [k, v] of Object.entries(op.data)) {
    if (SKIP.has(k)) continue;
    out[op.type === 'update_stock' ? (STOCK_ALIAS[k] ?? k) : k] = v;
  }
  return out;
}
const STOCK_ALIAS: Record<string, string> = {
  quantity: 'stock_quantity',
  stockStatus: 'stock_status',
};

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

/** Snapshot of the cached item at queue time. Undefined when it can't be determined (replays as before). */
export function captureBase(
  type: PendingOperation['type'],
  data: Record<string, unknown>,
  storeId: string
): OperationBase | undefined {
  const kind = kindOf(type);
  // The cache only holds the current store's data.
  if (!kind || useStoreConfig.getState().currentStoreId !== storeId) return undefined;
  const id = itemId({ type, data });
  const list = useCache.getState().cache[kind]?.data as Item[] | null | undefined;
  const item = list?.find((i) => i.id === id);
  if (!item) return undefined;
  const modified = modifiedOf(item);
  if (!modified) return undefined;
  const prev: Item = {};
  for (const f of Object.keys(editedFields({ type, data }))) prev[f] = item[f] ?? null;
  return { modified, prev };
}

async function fetchServer(
  service: WooCommerceService,
  op: PendingOperation
): Promise<Item | null> {
  const id = itemId(op);
  const kind = kindOf(op.type);
  const res =
    kind === 'orders'
      ? await service.getOrder(id)
      : kind === 'coupons'
        ? await service.getCoupon(id)
        : await service.getProduct(id);
  return res.success ? (res.data as unknown as Item) : null;
}

/**
 * Compare the live server item against the op's base snapshot.
 * Null (replay normally) when: no snapshot (legacy op), server unchanged since queue time,
 * the item can't be fetched, or the server edits touched only other fields.
 */
export async function detectConflict(
  service: WooCommerceService,
  op: PendingOperation
): Promise<OperationConflict | null> {
  const base = op.base;
  if (!base || !kindOf(op.type)) return null;
  const server = await fetchServer(service, op);
  if (!server || !isNewer(modifiedOf(server), base.modified)) return null;
  const mine = editedFields(op);
  // Conflict = server changed the field since the snapshot AND it now differs from what I'm sending.
  const fields = Object.keys(mine).filter(
    (f) => !same(server[f], base.prev[f]) && !same(server[f], mine[f])
  );
  if (!fields.length) return null;
  const serverVals: Item = {};
  for (const f of fields) serverVals[f] = server[f] ?? null;
  return {
    fields,
    server: serverVals,
    // Stock edits can be re-applied as "server quantity + my change".
    stockDelta:
      op.type === 'update_stock' && fields.includes('stock_quantity')
        ? Number(mine.stock_quantity) - Number(base.prev.stock_quantity)
        : undefined,
  };
}

/** New op data adding my stock change onto the server quantity. Null when not applicable. */
export function stockDeltaData(op: PendingOperation): Record<string, unknown> | null {
  const c = op.conflict;
  const serverQty = Number(c?.server.stock_quantity);
  if (!c || c.stockDelta === undefined || Number.isNaN(serverQty) || Number.isNaN(c.stockDelta)) {
    return null;
  }
  const quantity = Math.max(0, serverQty + c.stockDelta);
  const mine = editedFields(op).stock_status;
  const stock_status =
    quantity > 0 ? 'instock' : mine === 'onbackorder' ? 'onbackorder' : 'outofstock';
  return { id: itemId(op), stock_quantity: quantity, stock_status };
}
