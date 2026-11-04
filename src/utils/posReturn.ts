import type { CreateRefundRequest, OrderLineItem, WooCommerceOrder } from '../types';
import { buildReceipt, type Receipt } from './receipt';
import { RECENT_TRANSACTIONS_KEY, POS_TX_EVENT } from './posOfflineSale';

export const POS_RETURNS_KEY = 'pos_returns';
export const POS_RETURNS_EVENT = 'pos-returns-changed';

export type ReturnMethod = 'cash' | 'original';
export const RETURN_METHOD_LABEL: Record<ReturnMethod, string> = {
  cash: 'Каса (в брой)',
  original: 'Към оригиналния метод',
};

export interface PosReturn {
  orderId: number;
  refundId: number;
  /** Store the return belongs to; absent on old records (treated as the current store). */
  storeId?: string;
  /** Positive refunded amount incl. tax. */
  total: number;
  method: ReturnMethod;
  restocked: boolean;
  timestamp: string;
  items: Array<{ productId: number; name: string; quantity: number; amount: number }>;
}

/** "#1234", "1234" -> 1234; anything else -> null. */
export function parseOrderNumber(input: string): number | null {
  const m = /^\s*#?(\d{1,10})\s*$/.exec(input);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 ? n : null;
}

/** Refund via payment gateway only when returning to the original method. */
export const apiRefundFor = (method: ReturnMethod): boolean => method === 'original';

/** Summarise a built refund request into a stored return record. */
export function toPosReturn(
  order: WooCommerceOrder,
  request: CreateRefundRequest,
  refundId: number,
  method: ReturnMethod,
  storeId?: string,
  timestamp = new Date().toISOString()
): PosReturn {
  const byId = new Map<number, OrderLineItem>(order.line_items.map((li) => [li.id, li]));
  return {
    orderId: order.id,
    refundId,
    ...(storeId && { storeId }),
    total: Math.abs(parseFloat(request.amount)) || 0,
    method,
    restocked: !!request.api_restock,
    timestamp,
    items: request.line_items.map((l) => ({
      productId: byId.get(l.id)?.product_id ?? 0,
      name: byId.get(l.id)?.name ?? `#${l.id}`,
      quantity: l.quantity,
      amount: parseFloat(l.refund_total) || 0,
    })),
  };
}

export function returnsInRange(list: PosReturn[], start: number, end: number): PosReturn[] {
  return list.filter((r) => {
    const t = new Date(r.timestamp).getTime();
    return t >= start && t < end;
  });
}

function loadAll(): PosReturn[] {
  try {
    const v = JSON.parse(localStorage.getItem(POS_RETURNS_KEY) ?? '[]');
    return Array.isArray(v) ? (v as PosReturn[]) : [];
  } catch {
    return [];
  }
}

/** Returns for a store; records without storeId count for every store (legacy). */
export function loadReturns(storeId?: string): PosReturn[] {
  return loadAll().filter((r) => !storeId || !r.storeId || r.storeId === storeId);
}

/** Persist a return (newest first, capped) and mark a fully-returned POS transaction. */
export function saveReturn(r: PosReturn, fullyRefunded = false): void {
  try {
    localStorage.setItem(POS_RETURNS_KEY, JSON.stringify([r, ...loadAll()].slice(0, 200)));
    if (fullyRefunded) {
      const txs = JSON.parse(localStorage.getItem(RECENT_TRANSACTIONS_KEY) ?? '[]') as Array<{
        id: number;
        storeId?: string;
        refunded?: boolean;
      }>;
      const same = (t: { id: number; storeId?: string }): boolean =>
        t.id === r.orderId && (!t.storeId || !r.storeId || t.storeId === r.storeId);
      localStorage.setItem(
        RECENT_TRANSACTIONS_KEY,
        JSON.stringify(txs.map((t) => (same(t) ? { ...t, refunded: true } : t)))
      );
    }
  } catch {
    // Intentional: history is best-effort; the refund already exists on the server.
  }
  // Refresh in-memory lists before they can overwrite what we just wrote.
  window.dispatchEvent(new Event(POS_TX_EVENT));
  window.dispatchEvent(new Event(POS_RETURNS_EVENT));
}

/** Refund receipt: negative amounts, flagged kind 'refund'. */
export function buildReturnReceipt(r: PosReturn, storeName: string, vatRate?: number): Receipt {
  return buildReceipt({
    storeName,
    kind: 'refund',
    items: r.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.quantity > 0 ? -i.amount / i.quantity : -i.amount,
    })),
    total: -r.total,
    paymentMethod: RETURN_METHOD_LABEL[r.method],
    orderId: r.orderId,
    date: r.timestamp,
    vatRate,
  });
}
