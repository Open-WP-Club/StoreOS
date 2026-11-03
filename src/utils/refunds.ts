import type {
  CreateRefundRequest,
  OrderLineItem,
  OrderRefundDetail,
  RefundLineItemInput,
} from '../types';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: string | number | undefined): number => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};

interface RefundableItem {
  item: OrderLineItem;
  remainingQty: number;
  remainingTotal: number;
  remainingTax: number;
}

export interface RefundSelection {
  /** Quantity to refund (integer). */
  quantity: number;
  /** Amount to refund excluding tax; defaults to a pro-rata share when omitted. */
  amount?: number;
}

/** Remaining refundable qty/amount per line item, subtracting prior refunds. */
export function getRefundableItems(
  lineItems: OrderLineItem[],
  refunds: OrderRefundDetail[]
): RefundableItem[] {
  const done = new Map<number, { qty: number; total: number; tax: number }>();
  for (const refund of refunds) {
    for (const li of refund.line_items ?? []) {
      const meta = (li.meta_data ?? []).find((m) => m.key === '_refunded_item_id');
      const itemId = meta ? Number(meta.value) : NaN;
      if (!Number.isFinite(itemId)) continue;
      const cur = done.get(itemId) ?? { qty: 0, total: 0, tax: 0 };
      cur.qty += Math.abs(num(li.quantity));
      cur.total += Math.abs(num(li.total));
      cur.tax += Math.abs(num(li.total_tax));
      done.set(itemId, cur);
    }
  }
  return lineItems.map((item) => {
    const d = done.get(item.id) ?? { qty: 0, total: 0, tax: 0 };
    return {
      item,
      remainingQty: Math.max(0, item.quantity - d.qty),
      remainingTotal: Math.max(0, round2(num(item.total) - d.total)),
      remainingTax: Math.max(0, round2(num(item.total_tax) - d.tax)),
    };
  });
}

/** Pro-rata share of `remaining` for `qty` of `remainingQty` (exact remainder on the last unit). */
function share(remaining: number, qty: number, remainingQty: number): number {
  if (remainingQty <= 0) return 0;
  return qty >= remainingQty ? remaining : round2((remaining * qty) / remainingQty);
}

export function defaultRefundAmount(row: RefundableItem, quantity: number): number {
  return share(row.remainingTotal, quantity, row.remainingQty);
}

type RefundBuildResult =
  { ok: true; request: CreateRefundRequest; total: number } | { ok: false; error: string };

/** Validate selections against remaining refundable amounts and build the API payload. */
export function buildRefundRequest(
  rows: RefundableItem[],
  selections: Record<number, RefundSelection | undefined>,
  opts: { restock: boolean; reason?: string; apiRefund?: boolean }
): RefundBuildResult {
  const lineItems: RefundLineItemInput[] = [];
  let total = 0;

  for (const row of rows) {
    const sel = selections[row.item.id];
    if (!sel || (sel.quantity === 0 && !sel.amount)) continue;
    const { quantity } = sel;
    const name = row.item.name;
    if (!Number.isInteger(quantity) || quantity < 0)
      return { ok: false, error: `${name}: invalid quantity` };
    if (quantity > row.remainingQty)
      return { ok: false, error: `${name}: only ${row.remainingQty} left to refund` };
    const amount = round2(sel.amount ?? defaultRefundAmount(row, quantity));
    if (!(amount >= 0)) return { ok: false, error: `${name}: invalid amount` };
    if (amount > row.remainingTotal)
      return {
        ok: false,
        error: `${name}: amount exceeds refundable ${row.remainingTotal.toFixed(2)}`,
      };

    const tax = share(row.remainingTax, quantity, row.remainingQty);
    // Split tax across rate ids proportionally to the original per-rate tax.
    const itemTaxTotal = (row.item.taxes ?? []).reduce((s, t) => s + num(t.total), 0);
    const refund_tax =
      tax > 0 && itemTaxTotal > 0
        ? row.item.taxes
            .filter((t) => num(t.total) > 0)
            .map((t) => ({
              id: t.id,
              refund_total: round2((tax * num(t.total)) / itemTaxTotal).toFixed(2),
            }))
        : [];

    lineItems.push({ id: row.item.id, quantity, refund_total: amount.toFixed(2), refund_tax });
    total += amount + refund_tax.reduce((s, t) => s + num(t.refund_total), 0);
  }

  if (lineItems.length === 0) return { ok: false, error: 'Select at least one item to refund' };
  total = round2(total);
  if (total <= 0) return { ok: false, error: 'Refund total must be greater than zero' };

  return {
    ok: true,
    total,
    request: {
      amount: total.toFixed(2),
      ...(opts.reason?.trim() ? { reason: opts.reason.trim() } : {}),
      line_items: lineItems,
      api_restock: opts.restock,
      ...(opts.apiRefund === undefined ? {} : { api_refund: opts.apiRefund }),
    },
  };
}
