import { ReactElement, FormEvent, useState } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { buildTrackingMeta, trackingNote, TRACKING_META_KEY } from '../utils/tracking';
import type { Order } from '../types';

interface Props {
  order: Order;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  /** Called after tracking + note were saved (refresh order / notes). */
  onSaved: () => void;
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm';

/** Save tracking number + carrier as order meta and post it as a customer note. */
export default function OrderTrackingSection({ order, showToast, onSaved }: Props): ReactElement {
  const activeStore = useStoreConfig((s) => s.getCurrentStore)();
  const existing = order.meta_data?.find((m) => m.key === TRACKING_META_KEY)?.value as
    { number?: string; carrier?: string } | undefined;
  const [number, setNumber] = useState(existing?.number ?? '');
  const [carrier, setCarrier] = useState(existing?.carrier ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const n = number.trim();
    const c = carrier.trim();
    if (!activeStore || !n || saving) return;
    setSaving(true);
    try {
      const wc = new WooCommerceService(activeStore);
      const res = await wc.updateOrder(order.id, {
        meta_data: buildTrackingMeta(order.meta_data ?? [], n, c) as never,
      });
      if (!res.success) {
        showToast('Грешка при запис на проследяване: ' + (res.error || 'Unknown error'), 'error');
        return;
      }
      const note = await wc.addOrderNote(order.id, trackingNote(n, c), true);
      showToast(
        note.success ? 'Проследяването е записано' : 'Записано, но бележката не е добавена',
        note.success ? 'success' : 'error'
      );
      onSaved();
    } catch (err) {
      showToast('Грешка: ' + (err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Проследяване
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
        <input
          aria-label="Номер за проследяване"
          className={inputCls}
          placeholder="Номер за проследяване"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <input
          aria-label="Куриер"
          className={inputCls}
          placeholder="Куриер (напр. Speedy)"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        />
        <button
          type="submit"
          disabled={!number.trim() || saving}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Запази и уведоми клиента
        </button>
      </form>
    </div>
  );
}
