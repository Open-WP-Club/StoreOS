import { toCents, fromCents } from './posPricing';

export type PayMethod = 'cash' | 'card' | 'other';
export interface Payment {
  method: PayMethod;
  amount: number;
}

export const PAY_LABEL: Record<PayMethod, string> = {
  cash: 'Каса',
  card: 'Карта',
  other: 'Друго',
};
export const PAYMENTS_META = '_storeos_payments';

export interface PaymentSummary {
  /** Amount actually applied to the sale per payment (cash is net of change). */
  applied: Payment[];
  tendered: number;
  change: number;
  remaining: number;
  valid: boolean;
}

/**
 * Payments must cover the total. Change is only given from cash, so overpaying with
 * card/other (non-cash sum above the total) is invalid.
 */
export function summarizePayments(payments: Payment[], total: number): PaymentSummary {
  const totalC = toCents(total);
  const cleaned = payments.filter((p) => p.amount > 0);
  const sumC = (ps: Payment[]): number => ps.reduce((s, p) => s + toCents(p.amount), 0);
  const paidC = sumC(cleaned);
  const cashC = sumC(cleaned.filter((p) => p.method === 'cash'));
  const overC = Math.max(0, paidC - totalC);
  const changeC = Math.min(overC, cashC);
  const remainingC = Math.max(0, totalC - paidC);
  const valid = (cleaned.length > 0 || totalC === 0) && remainingC === 0 && overC === changeC;
  let cashLeft = cashC - changeC;
  const applied = cleaned.map((p) => {
    if (p.method !== 'cash') return { method: p.method, amount: fromCents(toCents(p.amount)) };
    const take = Math.min(toCents(p.amount), cashLeft);
    cashLeft -= take;
    return { method: p.method, amount: fromCents(take) };
  });
  return {
    applied,
    tendered: fromCents(cashC),
    change: fromCents(changeC),
    remaining: fromCents(remainingC),
    valid,
  };
}

/** Title for the Woo order, e.g. "Каса + Карта". */
export function paymentTitle(applied: Payment[]): string {
  return [...new Set(applied.map((p) => PAY_LABEL[p.method]))].join(' + ');
}

/** Per-method totals for the daily report; legacy transactions without `payments` use `total`. */
export function methodTotals(tx: {
  paymentMethod: string;
  total: number;
  payments?: Payment[];
}): Array<{ label: string; amount: number }> {
  if (!tx.payments?.length) return [{ label: tx.paymentMethod, amount: tx.total }];
  const cents = new Map<string, number>();
  tx.payments.forEach((p) => {
    const label = PAY_LABEL[p.method];
    cents.set(label, (cents.get(label) ?? 0) + toCents(p.amount));
  });
  return [...cents].map(([label, c]) => ({ label, amount: fromCents(c) }));
}
