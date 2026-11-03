import useCache from '../stores/cacheStore';
import useStoreConfig from '../stores/storeConfigStore';
import { CLIENT_ID_META, findByClientId } from './offlineCreates';
import type { ApiResponse, WooCommerceOrder, WooCommerceProduct } from '../types';

/** Order meta key carrying the client-generated sale UUID (idempotency key). */
export { CLIENT_ID_META };
export const RECENT_TRANSACTIONS_KEY = 'pos_recent_transactions';
export const POS_TX_EVENT = 'pos-transactions-changed';

/** Shape stored in PendingOperation.data for a queued POS sale. */
export interface PosSaleOpData extends Record<string, unknown> {
  clientId: string;
  order: Record<string, unknown>;
}

/** Network-level failures where the request may or may not have reached the server. */
export function isOfflineFailure(r: { success: boolean; code?: string }): boolean {
  return !r.success && (r.code === 'offline' || r.code === 'timeout');
}

interface OrderLookup {
  getOrders: (params: Record<string, unknown>) => Promise<ApiResponse<WooCommerceOrder[]>>;
  createOrder: (data: Record<string, unknown>) => Promise<ApiResponse<WooCommerceOrder>>;
}

const LOOKUP_MARGIN_MS = 24 * 60 * 60 * 1000; // tolerate client/server clock skew
const LOOKUP_PAGE = 100;

/**
 * Create the order unless one carrying the same client id already exists on the server
 * (first attempt reached the server but the response was lost). If the lookup itself fails
 * we do NOT create: a retry later is better than a duplicate sale.
 */
export async function createOrderIdempotent(
  service: OrderLookup,
  order: Record<string, unknown>,
  clientId: string,
  soldAt: number
): Promise<ApiResponse<WooCommerceOrder>> {
  const after = new Date(soldAt - LOOKUP_MARGIN_MS).toISOString();
  const found = await findByClientId(
    (page) =>
      service.getOrders({ after, per_page: LOOKUP_PAGE, page, orderby: 'date', order: 'desc' }),
    (o) => !!o.meta_data?.some((m) => m.key === CLIENT_ID_META && m.value === clientId)
  );
  if (!found.success) return found;
  if (found.data) return { success: true, data: found.data };
  return service.createOrder(order);
}

/** Replay one queued POS sale; on success reconcile the local transaction record. */
export async function replayPosSale(
  service: OrderLookup,
  data: PosSaleOpData,
  soldAt: number
): Promise<ApiResponse<WooCommerceOrder>> {
  const res = await createOrderIdempotent(service, data.order, data.clientId, soldAt);
  if (res.success) resolvePendingSale(data.clientId, res.data.id);
  return res;
}

/** Mark a pending local transaction as synced (orderId) or remove it (null = discarded). */
export function resolvePendingSale(clientId: string, orderId: number | null): void {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_TRANSACTIONS_KEY) ?? '[]') as Array<
      Record<string, unknown>
    >;
    const next = list
      .filter((tx) => orderId !== null || tx.clientId !== clientId)
      .map((tx) =>
        tx.clientId === clientId && orderId !== null ? { ...tx, id: orderId, pending: false } : tx
      );
    localStorage.setItem(RECENT_TRANSACTIONS_KEY, JSON.stringify(next));
  } catch {
    // corrupt/unavailable localStorage: nothing to reconcile
  }
  window.dispatchEvent(new Event(POS_TX_EVENT));
}

/** Decrement cached stock for sold items (managed-stock products only). Server stays the truth on next sync. */
export async function decrementCachedStock(
  items: Array<{ productId: number; quantity: number }>
): Promise<void> {
  const storeId = useStoreConfig.getState().currentStoreId;
  const { data, timestamp } = useCache.getState().cache.products;
  if (!storeId || !data) return;
  const sold = new Map<number, number>();
  items.forEach((i) => sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.quantity));
  const next = data.map((p: WooCommerceProduct) => {
    const qty = sold.get(p.id);
    if (!qty || !p.manage_stock || p.stock_quantity == null) return p;
    const left = p.stock_quantity - qty;
    return {
      ...p,
      stock_quantity: left,
      stock_status: left <= 0 && p.backorders === 'no' ? ('outofstock' as const) : p.stock_status,
    };
  });
  // keep the original timestamp so this patch doesn't make a stale cache look fresh
  await useCache.getState().setCachedProducts(next, storeId, timestamp ?? Date.now());
}
