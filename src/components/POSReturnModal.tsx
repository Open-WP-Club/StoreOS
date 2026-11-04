import { ReactElement, useMemo, useState } from 'react';
import { RotateCcw, Loader2, Search, Printer } from 'lucide-react';
import { useStoreConfig, useAppSettings } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { useToast } from '../contexts/ToastContext';
import { formatPrice, storeCurrencySymbol } from '../utils/currency';
import {
  buildRefundRequest,
  defaultRefundAmount,
  getRefundableItems,
  type RefundSelection,
} from '../utils/refunds';
import {
  apiRefundFor,
  buildReturnReceipt,
  parseOrderNumber,
  RETURN_METHOD_LABEL,
  saveReturn,
  toPosReturn,
  type PosReturn,
  type ReturnMethod,
} from '../utils/posReturn';
import { decrementCachedStock } from '../utils/posOfflineSale';
import { printReceipt } from '../utils/printReceipt';
import type { RecentTransaction } from '../hooks/usePOSDailyReport';
import type { OrderRefundDetail, WooCommerceOrder } from '../types';
import Modal from './Modal';

interface POSReturnModalProps {
  recentTransactions: RecentTransaction[];
  onClose: () => void;
}

const inputCls =
  'px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

/** POS "return item": look up an order, pick items/quantities, refund + optional restock. */
export function POSReturnModal({ recentTransactions, onClose }: POSReturnModalProps): ReactElement {
  const currentStore = useStoreConfig((s) => s.getCurrentStore());
  const defaultPrinter = useAppSettings((s) => s.defaultPrinter);
  const toast = useToast();
  const symbol = storeCurrencySymbol(currentStore);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<WooCommerceOrder | null>(null);
  const [refunds, setRefunds] = useState<OrderRefundDetail[]>([]);
  const [selections, setSelections] = useState<Record<number, RefundSelection>>({});
  const [restock, setRestock] = useState(true);
  const [method, setMethod] = useState<ReturnMethod>('cash');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState<PosReturn | null>(null);

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  const rows = useMemo(
    () => getRefundableItems(order?.line_items ?? [], refunds),
    [order, refunds]
  );
  const result = buildRefundRequest(rows, selections, {
    restock,
    reason: reason || 'POS връщане',
    apiRefund: apiRefundFor(method),
  });

  const lookup = async (id: number): Promise<void> => {
    if (!currentStore) return;
    if (offline) return setError('Няма връзка. Връщанията не се записват офлайн.');
    setLoading(true);
    setError(null);
    setOrder(null);
    setSelections({});
    try {
      const service = new WooCommerceService(currentStore);
      const [o, r] = await Promise.all([service.getOrder(id), service.getOrderRefunds(id)]);
      if (!o.success) setError('Поръчката не е намерена: ' + o.error);
      else if (!r.success) setError('Грешка при зареждане на връщанията: ' + r.error);
      else {
        setOrder(o.data);
        setRefunds(r.data);
      }
    } catch {
      setError('Грешка при зареждане на поръчката');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (): void => {
    const id = parseOrderNumber(query);
    if (id === null) return setError('Въведете валиден номер на поръчка');
    void lookup(id);
  };

  const setQty = (id: number, raw: string): void => {
    const row = rows.find((r) => r.item.id === id);
    if (!row) return;
    const quantity = Math.min(Math.max(parseInt(raw, 10) || 0, 0), row.remainingQty);
    setSelections((s) => ({ ...s, [id]: { quantity } }));
    setError(null);
  };

  const handlePrint = async (r: PosReturn): Promise<void> => {
    const receipt = buildReturnReceipt(
      r,
      currentStore?.name ?? '',
      useAppSettings.getState().receiptVatRate
    );
    const ok = await printReceipt(receipt, {
      printer: defaultPrinter,
      openDrawer: false,
      currencySymbol: symbol,
      store: currentStore,
    });
    if (!ok) toast.warning('Касовата бележка не можа да се отпечата.');
  };

  /** Re-read prior refunds after a failed/ambiguous submit; resubmit stays blocked until it works. */
  const reconcile = async (): Promise<void> => {
    if (!currentStore || !order) return;
    setStale(true);
    try {
      const r = await new WooCommerceService(currentStore).getOrderRefunds(order.id);
      if (r.success) {
        setRefunds(r.data);
        setSelections({});
        setStale(false);
        setError(
          'Връщането може да е преминало. Данните са опреснени - проверете остатъка преди нов опит.'
        );
      } else {
        setError('Неясен резултат и опресняването не успя. Натиснете "Опресни".');
      }
    } catch {
      setError('Неясен резултат и опресняването не успя. Натиснете "Опресни".');
    }
  };

  const submit = async (): Promise<void> => {
    if (!currentStore || !order || submitting || stale) return;
    if (offline) return setError('Няма връзка. Връщанията не се записват офлайн.');
    if (!result.ok) return setError(result.error);
    setSubmitting(true);
    let res;
    try {
      res = await new WooCommerceService(currentStore).createRefund(order.id, result.request);
    } catch {
      setError('Грешка при възстановяване');
      await reconcile();
      setSubmitting(false);
      return;
    }
    if (!res.success) {
      setError('Грешка при възстановяване: ' + res.error);
      await reconcile();
      setSubmitting(false);
      return;
    }
    // Server accepted the refund: from here on nothing may be reported as a refund failure.
    const record = toPosReturn(order, result.request, res.data.id, method, currentStore.id);
    setDone(record);
    setSubmitting(false);
    try {
      const fully = rows.every(
        (r) => r.remainingQty === (selections[r.item.id]?.quantity ?? 0) || r.remainingQty === 0
      );
      saveReturn(record, fully);
      toast.success(`Върнати ${formatPrice(record.total, symbol)} по поръчка #${order.id}`);
      if (restock) {
        // Server already restocked (api_restock); keep the local product cache in sync.
        await decrementCachedStock(
          record.items.filter((i) => i.productId > 0).map((i) => ({ ...i, quantity: -i.quantity }))
        );
      }
    } catch {
      toast.warning('Връщането е записано, но локалните данни не се обновиха.');
    }
    try {
      await handlePrint(record);
    } catch {
      toast.warning('Касовата бележка не можа да се отпечата.');
    }
  };

  const candidates = recentTransactions
    .filter(
      (t) => t.id > 0 && !t.refunded && (t.storeId === undefined || t.storeId === currentStore?.id)
    )
    .slice(0, 8);

  return (
    <Modal
      onClose={onClose}
      closeOnEscape={!submitting}
      closeOnBackdrop={!submitting}
      aria-label="Връщане на артикул"
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <RotateCcw className="w-5 h-5 text-red-600" />
        Връщане на артикул
      </h3>

      {offline && (
        <p
          role="alert"
          className="mb-3 p-3 text-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
        >
          Няма връзка. Връщанията изискват интернет и не се записват офлайн.
        </p>
      )}

      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-green-700 dark:text-green-400">
            Върнати {formatPrice(done.total, symbol)} по поръчка #{done.orderId}
            {done.restocked ? ' (артикулите са върнати в наличност)' : ''}.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => void handlePrint(done)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Печат на бележка
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Затвори
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              inputMode="numeric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Номер на поръчка"
              aria-label="Номер на поръчка"
              className={`flex-1 ${inputCls} py-2`}
            />
            <button
              onClick={handleSearch}
              disabled={loading || offline}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Търси
            </button>
          </div>

          {!order && candidates.length > 0 && (
            <div className="mb-3">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                Скорошни транзакции
              </p>
              <div className="flex flex-wrap gap-2">
                {candidates.map((t) => (
                  <button
                    key={`${t.id}-${t.timestamp}`}
                    onClick={() => {
                      setQuery(String(t.id));
                      void lookup(t.id);
                    }}
                    disabled={loading || offline}
                    className="px-3 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    #{t.id}
                    {t.customerName ? ` · ${t.customerName}` : ''} · {formatPrice(t.total, symbol)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {order && (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Поръчка #{order.id}
              </p>
              <table className="min-w-full text-sm mb-3">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th scope="col" className="py-2">
                      Артикул
                    </th>
                    <th scope="col" className="py-2">
                      Остава
                    </th>
                    <th scope="col" className="py-2">
                      Върни
                    </th>
                    <th scope="col" className="py-2 text-right">
                      Сума
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const qty = selections[row.item.id]?.quantity ?? 0;
                    return (
                      <tr
                        key={row.item.id}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <td className="py-2 pr-2 text-gray-900 dark:text-white">{row.item.name}</td>
                        <td className="py-2 pr-2 text-gray-600 dark:text-gray-400">
                          {row.remainingQty}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min={0}
                            max={row.remainingQty}
                            disabled={row.remainingQty === 0 || submitting}
                            aria-label={`Количество за връщане: ${row.item.name}`}
                            value={qty}
                            onChange={(e) => setQty(row.item.id, e.target.value)}
                            className={`w-20 ${inputCls}`}
                          />
                        </td>
                        <td className="py-2 text-right text-gray-700 dark:text-gray-300">
                          {formatPrice(defaultRefundAmount(row, qty), symbol)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center gap-4 mb-3 text-sm text-gray-700 dark:text-gray-300">
                <label className="flex items-center gap-2">
                  Метод:
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as ReturnMethod)}
                    aria-label="Метод на възстановяване"
                    className={inputCls}
                  >
                    {(Object.keys(RETURN_METHOD_LABEL) as ReturnMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {RETURN_METHOD_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={restock}
                    onChange={(e) => setRestock(e.target.checked)}
                  />
                  Върни в наличност
                </label>
              </div>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Причина (по избор)"
                aria-label="Причина за връщане"
                className={`w-full ${inputCls} py-2 mb-3`}
              />
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {order && `Общо (с ДДС): ${formatPrice(result.ok ? result.total : 0, symbol)}`}
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50"
              >
                Отказ
              </button>
              {order && stale && (
                <button
                  onClick={() => void reconcile()}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  Опресни
                </button>
              )}
              {order && (
                <button
                  onClick={() => void submit()}
                  disabled={submitting || offline || stale || !result.ok}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Върни
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export default POSReturnModal;
