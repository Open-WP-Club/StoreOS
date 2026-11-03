import { useState, ReactElement } from 'react';
import { X, Upload } from 'lucide-react';
import { useStoreConfig } from '../stores';
import useOffline from '../stores/offlineStore';
import useOnlineStatus from '../hooks/useOnlineStatus';
import WooCommerceService from '../services/woocommerce';
import { batchErrorIds } from '../utils/batchResult';
import {
  IMPORT_FIELDS,
  autoMapHeaders,
  chunk,
  computeImportDiff,
  parseCSV,
  type ColumnMapping,
  type ImportAction,
} from '../utils/csvImport';
import type { Product } from '../types';
import Modal from './Modal';

interface ImportModalProps {
  products: Product[];
  onClose: () => void;
  /** Called after an import that changed something (to refresh the product cache). */
  onImported: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const BADGE: Record<ImportAction, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  unchanged: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  invalid: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

/** Pick file -> map columns -> dry-run preview -> run in batches of 100. All cell text is rendered as plain text. */
export default function ImportModal({
  products,
  onClose,
  onImported,
  showToast,
}: ImportModalProps): ReactElement {
  const getCurrentStore = useStoreConfig((s) => s.getCurrentStore);
  const { isOnline } = useOnlineStatus();
  const addPendingOperation = useOffline((s) => s.addPendingOperation);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [step, setStep] = useState<'map' | 'preview'>('map');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const parsed = parseCSV(await file.text());
    if (parsed.length < 2) {
      setError('The file has no data rows.');
      return;
    }
    setError('');
    setRows(parsed);
    setMapping(autoMapHeaders(parsed[0] ?? []));
    setStep('map');
  };

  const diff =
    rows && mapping && step === 'preview' ? computeImportDiff(rows, mapping, products) : [];
  const toRun = diff.filter((d) => d.action === 'create' || d.action === 'update');
  const count = (a: ImportAction): number => diff.filter((d) => d.action === a).length;

  const run = async (): Promise<void> => {
    const store = getCurrentStore();
    if (!store || progress) return;
    const total = toRun.length;
    if (!isOnline) {
      // Creates are only replay-safe with a SKU (WC rejects duplicate SKUs); otherwise a replay could duplicate.
      if (toRun.some((r) => r.action === 'create' && !r.payload.sku)) {
        showToast('Rows without a SKU can only be imported while online', 'warning');
        return;
      }
      for (const part of chunk(toRun, 100)) {
        addPendingOperation(
          'batch_products',
          {
            create: part.filter((r) => r.action === 'create').map((r) => r.payload),
            update: part
              .filter((r) => r.action === 'update')
              .map((r) => ({ id: r.id as number, ...r.payload })),
          },
          store.id
        );
      }
      showToast(`Offline: ${total} products queued, they will import on reconnect`, 'warning');
      onClose();
      return;
    }
    const service = new WooCommerceService(store);
    let failed = 0;
    setProgress({ done: 0, total });
    for (const part of chunk(toRun, 100)) {
      const create = part.filter((r) => r.action === 'create').map((r) => r.payload);
      const update = part
        .filter((r) => r.action === 'update')
        .map((r) => ({ id: r.id as number, ...r.payload }));
      const res = await service.batchProducts({ create, update });
      if (res.success) {
        failed +=
          batchErrorIds(res.data, 'create').length + batchErrorIds(res.data, 'update').length;
      } else failed += part.length;
      setProgress((p) => ({ done: Math.min((p?.done ?? 0) + part.length, total), total }));
    }
    setProgress(null);
    if (failed > 0) showToast(`Import: ${failed} of ${total} failed`, 'error');
    else showToast(`Imported ${total} products`, 'success');
    if (failed < total) onImported();
    onClose();
  };

  const cls =
    'border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

  return (
    <Modal
      onClose={onClose}
      closeOnBackdrop={false}
      closeOnEscape={!progress}
      aria-label="Import products"
      className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] mx-4 overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Import products from CSV
        </h2>
        <button
          onClick={onClose}
          disabled={!!progress}
          aria-label="Close modal"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <label className="flex items-center gap-2">
          <Upload className="w-4 h-4" />
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFile(e.target.files?.[0])}
            aria-label="CSV file"
          />
        </label>
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

        {rows && mapping && step === 'map' && (
          <div className="space-y-2">
            <p>
              Match file columns to product fields. Rows are matched to existing products by SKU;
              empty cells are ignored.
            </p>
            {IMPORT_FIELDS.map(({ field, label }) => (
              <div key={field} className="flex items-center gap-3">
                <span className="w-36">
                  {label}
                  {field === 'sku' ? ' *' : ''}
                </span>
                <select
                  aria-label={label}
                  className={cls}
                  value={mapping[field]}
                  onChange={(e) => setMapping({ ...mapping, [field]: Number(e.target.value) })}
                >
                  <option value={-1}>— not imported —</option>
                  {(rows[0] ?? []).map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {step === 'preview' && (
          <>
            <p>
              {count('create')} to create, {count('update')} to update, {count('unchanged')}{' '}
              unchanged, {count('invalid')} invalid
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-3">Line</th>
                  <th className="pr-3">SKU</th>
                  <th className="pr-3">Action</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {diff
                  .filter((d) => d.action !== 'unchanged')
                  .map((d) => (
                    <tr
                      key={d.line}
                      className="border-b border-gray-100 dark:border-gray-700 align-top"
                    >
                      <td className="py-2 pr-3">{d.line}</td>
                      <td className="pr-3 break-all">{d.sku}</td>
                      <td className="pr-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${BADGE[d.action]}`}>
                          {d.action}
                        </span>
                      </td>
                      <td>
                        {d.errors.map((e, i) => (
                          <div key={i} className="text-red-600 dark:text-red-400">
                            {e}
                          </div>
                        ))}
                        {d.action === 'update' &&
                          d.changes.map((c) => (
                            <div key={c.field}>
                              {c.field}:{' '}
                              <span className="line-through opacity-60">{c.from || '—'}</span> →{' '}
                              {c.to}
                            </div>
                          ))}
                        {d.action === 'create' &&
                          d.changes.map((c) => (
                            <div key={c.field}>
                              {c.field}: {c.to}
                            </div>
                          ))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}

        {progress && (
          <div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
              <div
                className="h-2 bg-blue-600 rounded"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <p className="mt-1">
              {progress.done} / {progress.total}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
        {step === 'preview' && (
          <button
            onClick={() => setStep('map')}
            disabled={!!progress}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
          >
            Back
          </button>
        )}
        {rows && step === 'map' && (
          <button
            onClick={() => setStep('preview')}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Preview
          </button>
        )}
        {step === 'preview' && (
          <button
            onClick={() => void run()}
            disabled={!!progress || toRun.length === 0}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Import {toRun.length} products
          </button>
        )}
      </div>
    </Modal>
  );
}
