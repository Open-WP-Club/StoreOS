import { toCents, fromCents } from '../posPricing';
import type { Payment } from '../payments';

// Driver-agnostic fiscal layer. The only concrete driver today is Datecs FP over serial
// (electron/fiscal.js, reached via window.electronAPI.fiscal). UNTESTED on real hardware.

export interface FiscalLine {
  name: string;
  /** Device VAT group letter (e.g. 'Б'); must match how the device is programmed. */
  taxGroup: string;
  price: number; // unit price, VAT included
  quantity: number;
  /** Absolute discount on the whole line (sale discount already folded in). */
  discount: number;
}
export interface FiscalPayment {
  method: 'cash' | 'card';
  amount: number;
}
export interface FiscalSale {
  lines: FiscalLine[];
  payments: FiscalPayment[];
}
export interface FiscalResult {
  success: boolean;
  error?: string;
  /** Close failed: the device may have printed the receipt. Do not retry blindly. */
  ambiguous?: boolean;
}

/** What a fiscal backend must offer; DatecsDriver (electron/fiscal.js) implements it. */
export interface FiscalDriver {
  openReceipt(): Promise<unknown>;
  addLine(line: FiscalLine): Promise<unknown>;
  pay(method: FiscalPayment['method'], amount: number): Promise<unknown>;
  closeReceipt(): Promise<unknown>;
  cancelReceipt(): Promise<unknown>;
  report(kind: 'X' | 'Z'): Promise<unknown>;
}

export interface FiscalConfig {
  port: string;
  baud: number;
  operator: string;
  password: string;
}

// Defaults are a guess (BG devices commonly use Б = 20%); each device is programmed individually.
export const DEFAULT_VAT_MAP = '20=Б,9=В,0=А';

/** Parses "20=Б,9=В,0=А" into a rate -> group map; bad entries are ignored. */
export function parseVatMap(text: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const part of text.split(',')) {
    const [rate, group] = part.split('=').map((s) => s.trim());
    if (rate && group && Number.isFinite(Number(rate))) map.set(Number(rate), group.slice(0, 1));
  }
  return map;
}

/** Group for a VAT rate; null if the rate is not mapped (caller must not guess). */
export function vatGroupFor(rate: number, mapText: string): string | null {
  return parseVatMap(mapText).get(rate) ?? null;
}

/**
 * Builds the fiscal sale from priced cart lines. The sale-level discount is spread over the lines
 * (largest-remainder, in cents) so the device total equals the amount paid. Returns null when the
 * sale cannot be fiscalized (VAT unmapped, non cash/card payment, totals mismatch).
 */
export function buildFiscalSale(input: {
  items: Array<{ name: string; quantity: number; price: number; lineDiscountCents: number }>;
  saleDiscountCents: number;
  payments: Payment[];
  vatRate: number;
  vatMap: string;
}): FiscalSale | null {
  const taxGroup = vatGroupFor(input.vatRate, input.vatMap);
  if (!taxGroup || input.items.length === 0) return null;
  if (input.payments.some((p) => p.method !== 'cash' && p.method !== 'card')) return null;

  const nets = input.items.map((i) => toCents(i.price) * i.quantity - i.lineDiscountCents);
  const base = nets.reduce((s, n) => s + n, 0);
  const share = nets.map((n) => (base > 0 ? Math.floor((n * input.saleDiscountCents) / base) : 0));
  let left = input.saleDiscountCents - share.reduce((s, n) => s + n, 0);
  for (let i = 0; left > 0 && i < share.length; i++, left--) {
    if ((share[i] ?? 0) < (nets[i] ?? 0)) share[i] = (share[i] ?? 0) + 1;
  }

  const lines: FiscalLine[] = input.items.map((i, idx) => ({
    name: i.name,
    taxGroup,
    price: i.price,
    quantity: i.quantity,
    discount: fromCents(i.lineDiscountCents + (share[idx] ?? 0)),
  }));
  const payments = input.payments
    .filter((p) => p.amount > 0)
    .map((p) => ({ method: p.method as 'cash' | 'card', amount: p.amount }));
  const total = base - share.reduce((s, n) => s + n, 0);
  if (payments.reduce((s, p) => s + toCents(p.amount), 0) !== total) return null;
  return { lines, payments };
}

// ---- IPC client + pending queue ----

const PENDING_KEY = 'fiscal_pending';
export interface PendingFiscal {
  id: string;
  sale: FiscalSale;
  error: string;
  ambiguous: boolean;
}

export function loadPending(): PendingFiscal[] {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function savePending(list: PendingFiscal[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}
export function dismissPending(id: string): void {
  savePending(loadPending().filter((p) => p.id !== id));
}

/** Sends the sale to the device. On failure the sale is queued (never lost) and the result says why. */
export async function fiscalize(sale: FiscalSale, config: FiscalConfig): Promise<FiscalResult> {
  let res: FiscalResult;
  try {
    const api = window.electronAPI?.fiscal;
    res = api ? await api.sale({ config, ...sale }) : { success: false, error: 'not available' };
  } catch (e) {
    res = { success: false, error: String((e as Error)?.message ?? e) };
  }
  if (!res.success) {
    savePending([
      ...loadPending(),
      {
        id: crypto.randomUUID(),
        sale,
        error: res.error ?? 'unknown',
        ambiguous: !!res.ambiguous,
      },
    ]);
  }
  return res;
}

/** Retries queued sales one by one (ambiguous ones are skipped: check the device first). */
export async function retryPending(config: FiscalConfig): Promise<{ done: number; left: number }> {
  let done = 0;
  for (const p of loadPending()) {
    if (p.ambiguous) continue;
    const api = window.electronAPI?.fiscal;
    let res: FiscalResult;
    let dispatched = true;
    try {
      if (!api) {
        dispatched = false;
        res = { success: false, error: 'not available' };
      } else res = await api.sale({ config, ...p.sale });
    } catch (e) {
      // IPC rejected after dispatch: the device may have printed it.
      res = { success: false, error: String((e as Error)?.message ?? e), ambiguous: true };
    }
    if (!res.success) {
      // Persist BEFORE stopping so an unknown outcome is never retried blindly.
      updatePending(p.id, {
        error: res.error ?? 'unknown',
        ambiguous: dispatched && !!res.ambiguous,
      });
      break;
    }
    dismissPending(p.id);
    done++;
  }
  return { done, left: loadPending().length };
}

function updatePending(id: string, patch: Partial<PendingFiscal>): void {
  savePending(loadPending().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

/** Operator confirmed on the device that the receipt was NOT printed: allow retrying it. */
export function confirmNotPrinted(id: string): void {
  updatePending(id, { ambiguous: false });
}

export async function fiscalReport(kind: 'X' | 'Z', config: FiscalConfig): Promise<FiscalResult> {
  const api = window.electronAPI?.fiscal;
  if (!api) return { success: false, error: 'not available' };
  return api.report({ config, kind }).catch((e: Error) => ({ success: false, error: e.message }));
}
