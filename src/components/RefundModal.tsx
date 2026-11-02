import { ReactElement, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import {
  buildRefundRequest,
  defaultRefundAmount,
  getRefundableItems,
  type RefundSelection,
} from '../utils/refunds';
import type { CreateRefundRequest, Order, OrderRefundDetail } from '../types';

interface RefundModalProps {
  order: Order;
  /** Prior refunds (GET orders/{id}/refunds); null while loading. */
  refunds: OrderRefundDetail[] | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (request: CreateRefundRequest) => void;
}

/** Partial / per-line-item refund dialog with restock toggle and reason. */
export function RefundModal({
  order,
  refunds,
  submitting,
  onCancel,
  onSubmit,
}: RefundModalProps): ReactElement {
  const rows = useMemo(
    () => getRefundableItems(order.line_items || [], refunds ?? []),
    [order.line_items, refunds]
  );
  const [selections, setSelections] = useState<Record<number, RefundSelection>>({});
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [submitting, onCancel]);

  const result = buildRefundRequest(rows, selections, { restock, reason });
  const symbol = order.currency_symbol;

  const setQty = (id: number, raw: string): void => {
    const row = rows.find((r) => r.item.id === id);
    if (!row) return;
    const quantity = Math.min(Math.max(parseInt(raw, 10) || 0, 0), row.remainingQty);
    setSelections((s) => ({ ...s, [id]: { quantity } }));
    setError(null);
  };
  const setAmount = (id: number, raw: string): void => {
    setSelections((s) => ({
      ...s,
      [id]: { quantity: s[id]?.quantity ?? 0, amount: parseFloat(raw) || 0 },
    }));
    setError(null);
  };

  const submit = (): void => {
    if (!result.ok) return setError(result.error);
    onSubmit(result.request);
  };

  const inputCls =
    'w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
      onClick={() => !submitting && onCancel()}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Refund order #${order.id}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-red-600" />
          Refund order #{order.id}
        </h3>

        {refunds === null ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading previous refunds...</p>
        ) : (
          <table className="min-w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <th className="py-2">Item</th>
                <th className="py-2">Left</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sel = selections[row.item.id];
                const qty = sel?.quantity ?? 0;
                const disabled = row.remainingQty === 0 || submitting;
                return (
                  <tr key={row.item.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-2 text-gray-900 dark:text-white">{row.item.name}</td>
                    <td className="py-2 pr-2 text-gray-600 dark:text-gray-400">
                      {row.remainingQty} / {formatPrice(row.remainingTotal, symbol)}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        max={row.remainingQty}
                        disabled={disabled}
                        aria-label={`Quantity to refund for ${row.item.name}`}
                        value={qty}
                        onChange={(e) => setQty(row.item.id, e.target.value)}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={disabled}
                        aria-label={`Amount to refund for ${row.item.name}`}
                        value={sel?.amount ?? defaultRefundAmount(row, qty)}
                        onChange={(e) => setAmount(row.item.id, e.target.value)}
                        className={inputCls}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-3">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          Restock refunded items
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          aria-label="Refund reason"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-3"
        />

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Total (incl. tax): {formatPrice(result.ok ? result.total : 0, symbol)}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || refunds === null || !result.ok}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Refund
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RefundModal;
