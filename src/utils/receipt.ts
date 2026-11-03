import { formatPrice } from './currency';
import { PAY_LABEL, type Payment } from './payments';

interface ReceiptInput {
  storeName: string;
  items: Array<{ name: string; quantity: number; price: number; discount?: number }>;
  /** Total discount amount incl. line discounts (positive). */
  discount?: number;
  total: number;
  paymentMethod: string;
  /** Split-payment breakdown (applied amounts); shown when more than one. */
  payments?: Payment[];
  tendered?: number;
  change?: number;
  /** Server order id; 0/undefined means the sale is still pending (offline). */
  orderId?: number;
  date?: Date | string;
  /** Prices include VAT at this percent (BG default 20). */
  vatRate?: number;
  /** Optional logo image URL (https only; anything else is dropped). */
  logoUrl?: string | null;
}

export interface Receipt {
  storeName: string;
  lines: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    /** Gross line total (before line discount). */
    total: number;
    discount: number;
  }>;
  subtotal: number;
  discount: number;
  vatRate: number;
  vat: number;
  total: number;
  paymentMethod: string;
  payments: Payment[];
  tendered: number | null;
  change: number | null;
  /** null = pending (offline sale, no order number yet). */
  orderId: number | null;
  date: string;
  logoUrl: string | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function buildReceipt(input: ReceiptInput): Receipt {
  const lines = input.items.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.price,
    total: round2(i.price * i.quantity),
    discount: round2(i.discount ?? 0),
  }));
  const vatRate = input.vatRate ?? 20;
  return {
    storeName: input.storeName,
    lines,
    subtotal: round2(lines.reduce((s, l) => s + l.total, 0)),
    discount: round2(input.discount ?? 0),
    vatRate,
    vat: round2((input.total * vatRate) / (100 + vatRate)),
    total: round2(input.total),
    paymentMethod: input.paymentMethod,
    payments: input.payments ?? [],
    tendered: input.tendered && input.tendered > 0 ? input.tendered : null,
    change: input.change && input.change > 0 ? input.change : null,
    orderId: input.orderId && input.orderId > 0 ? input.orderId : null,
    date: new Date(input.date ?? Date.now()).toISOString(),
    logoUrl: input.logoUrl && /^https:\/\//i.test(input.logoUrl) ? input.logoUrl : null,
  };
}

/** Escape untrusted text (store, product and customer strings) for HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c
  );
}

/** 80mm thermal layout. All dynamic strings are escaped; CSP forbids scripts. */
export function renderReceiptHtml(r: Receipt, currencySymbol: string | null = null): string {
  const money = (n: number): string => escapeHtml(formatPrice(n, currencySymbol));
  const row = (l: string, v: string): string =>
    `<div class="row"><span>${l}</span><span>${v}</span></div>`;
  const when = new Date(r.date).toLocaleString('bg-BG');
  const lines = r.lines
    .map(
      (l) =>
        `<div class="item">${escapeHtml(l.name)}</div>` +
        row(`${escapeHtml(l.quantity)} x ${money(l.unitPrice)}`, money(l.total)) +
        (l.discount > 0 ? row('Отстъпка', '-' + money(l.discount)) : '')
    )
    .join('');
  const order = r.orderId === null ? 'Чака синхронизация' : `Поръчка #${escapeHtml(r.orderId)}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline'">
<style>
@page { size: 80mm auto; margin: 0; }
body { width: 72mm; margin: 0 auto; padding: 4mm 0; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
.c { text-align: center; } .b { font-weight: bold; }
.row { display: flex; justify-content: space-between; gap: 6px; }
.item { margin-top: 4px; word-break: break-word; }
hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
.logo { display: block; margin: 0 auto 4px; max-width: 48mm; max-height: 20mm; filter: grayscale(1) contrast(1.5); }
.total { font-size: 15px; font-weight: bold; }
</style></head><body>
${r.logoUrl ? `<img class="logo" src="${escapeHtml(r.logoUrl)}" alt="">` : ''}
<div class="c b">${escapeHtml(r.storeName)}</div>
<div class="c">${escapeHtml(when)}</div>
<div class="c">${order}</div>
<hr>${lines}<hr>
${r.discount > 0 ? row('Междинна сума', money(r.subtotal)) + row('Отстъпка', '-' + money(r.discount)) : ''}
${r.vatRate > 0 ? row(`ДДС ${escapeHtml(r.vatRate)}% (вкл.)`, money(r.vat)) : ''}
<div class="row total"><span>ОБЩО</span><span>${money(r.total)}</span></div>
<hr>
${
  r.payments.length > 1
    ? r.payments.map((p) => row(escapeHtml(PAY_LABEL[p.method]), money(p.amount))).join('')
    : row('Плащане', escapeHtml(r.paymentMethod))
}
${r.tendered !== null ? row('Получени', money(r.tendered)) : ''}
${r.change !== null ? row('Ресто', money(r.change)) : ''}
<hr><div class="c">Благодарим Ви!</div>
</body></html>`;
}
