import { useState, type ReactElement } from 'react';
import Modal from './Modal';
import { countDifferences, findProductByCode } from '../utils/barcodeScanner';
import type { Product } from '../types';

interface StockCountModalProps {
  products: Product[];
  onClose: () => void;
  /** Applies new quantities through the page's offline-aware stock update path. */
  onApply: (changes: Array<{ productId: number; counted: number }>) => Promise<unknown>;
  /** Receive delivered goods: the entered quantity is added to the system stock instead of replacing it. */
  receive?: boolean;
}

/** Scan items, enter counted quantities, review differences, then apply. */
export default function StockCountModal({
  products,
  onClose,
  onApply,
  receive = false,
}: StockCountModalProps): ReactElement {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);
  // productId -> counted (kept as string so the field can be empty while typing)
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [order, setOrder] = useState<number[]>([]);

  const scan = (raw: string): void => {
    const product = findProductByCode(products, raw);
    setCode('');
    if (!product) return setMessage(`No product with code ${raw}`);
    if (!product.manage_stock) return setMessage(`${product.name} does not manage stock`);
    setMessage('');
    setCounts((c) => ({ ...c, [product.id]: String((parseInt(c[product.id] ?? '0') || 0) + 1) }));
    setOrder((o) => (o.includes(product.id) ? o : [product.id, ...o]));
  };

  const rows = order.flatMap((id) => {
    const p = products.find((x) => x.id === id);
    return p
      ? [
          {
            product: p,
            system: p.stock_quantity ?? 0,
            counted: (receive ? (p.stock_quantity ?? 0) : 0) + (parseInt(counts[id] ?? '') || 0),
          },
        ]
      : [];
  });
  const diffs = countDifferences(
    rows.map((r) => ({ productId: r.product.id, system: r.system, counted: r.counted }))
  );

  const apply = async (): Promise<void> => {
    setApplying(true);
    try {
      await onApply(diffs.map((d) => ({ productId: d.productId, counted: d.counted })));
      onClose();
    } catch {
      // The caller reports the failure; keep the modal open so the count isn't lost.
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={receive ? 'Receive stock' : 'Stock count'}
      className="w-full max-w-2xl mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5"
    >
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- scanner input must be ready on open
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && code.trim()) {
            e.preventDefault();
            scan(code);
          }
        }}
        placeholder="Scan a barcode / SKU and press Enter"
        aria-label="Scan barcode"
        className="w-full mt-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
      {message && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p>}

      <div className="mt-3 max-h-80 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No items scanned yet.</p>
        ) : (
          <table className="w-full text-sm text-gray-900 dark:text-white">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-1">Product</th>
                <th className="py-1">System</th>
                <th className="py-1">{receive ? 'Received' : 'Counted'}</th>
                <th className="py-1">Diff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const diff = r.counted - r.system;
                return (
                  <tr key={r.product.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-1 pr-2">{r.product.name}</td>
                    <td className="py-1">{r.system}</td>
                    <td className="py-1">
                      <input
                        type="number"
                        min="0"
                        aria-label={`${receive ? 'Received' : 'Counted'} ${r.product.name}`}
                        value={counts[r.product.id] ?? ''}
                        onChange={(e) =>
                          setCounts((c) => ({ ...c, [r.product.id]: e.target.value }))
                        }
                        className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </td>
                    <td
                      className={`py-1 font-medium ${
                        diff === 0
                          ? 'text-gray-500 dark:text-gray-400'
                          : diff > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={apply}
          disabled={applying || diffs.length === 0}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white"
        >
          Apply {diffs.length} change{diffs.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
