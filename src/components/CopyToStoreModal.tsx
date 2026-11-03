import { useState, type ReactElement } from 'react';
import Modal from './Modal';
import WooCommerceService from '../services/woocommerce';
import { useStoreConfig } from '../stores';
import {
  executeCouponCopy,
  executeProductCopy,
  fetchAllCategories,
  loadProductTargetContext,
  planCategories,
  previewProductCopy,
  summarizeCopy,
  type CollisionMode,
  type CopyResult,
  type ProductCopyPreview,
} from '../utils/crossStoreCopy';
import type { Coupon, Product, Store } from '../types';

type Props =
  | { kind: 'products'; items: Product[]; sourceStore: Store; onClose: () => void }
  | { kind: 'coupons'; items: Coupon[]; sourceStore: Store; onClose: () => void };

export default function CopyToStoreModal(props: Props): ReactElement {
  const { kind, sourceStore, onClose } = props;
  const stores = useStoreConfig((s) => s.stores).filter((s) => s.id !== sourceStore.id);
  const [targetId, setTargetId] = useState<string>(stores[0]?.id ?? '');
  const [collision, setCollision] = useState<CollisionMode>('skip');
  const [createCats, setCreateCats] = useState(true);
  const [preview, setPreview] = useState<ProductCopyPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CopyResult | null>(null);

  const target = stores.find((s) => s.id === targetId);
  const noun = kind === 'products' ? 'product' : 'coupon';

  const loadPreview = async (): Promise<void> => {
    if (!target || props.kind !== 'products') return;
    setBusy(true);
    setError('');
    const loaded = await loadProductTargetContext(new WooCommerceService(target));
    const src = await fetchAllCategories(new WooCommerceService(sourceStore));
    if (loaded.ok) {
      const plan = planCategories(
        src.ok ? src.data : [],
        loaded.categories,
        props.items.flatMap((p) => p.categories ?? [])
      );
      setPreview(previewProductCopy(props.items, loaded.ctx, plan));
    } else setError(`Could not read the target store: ${loaded.error}`);
    setBusy(false);
  };

  const run = async (): Promise<void> => {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const source = new WooCommerceService(sourceStore);
      const tgt = new WooCommerceService(target);
      setResult(
        props.kind === 'products'
          ? await executeProductCopy({
              source,
              target: tgt,
              products: props.items,
              collision,
              createMissingCategories: createCats,
              onProgress: setProgress,
            })
          : await executeCouponCopy({
              source,
              target: tgt,
              coupons: props.items,
              collision,
              createMissingCategories: createCats,
            })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed');
    } finally {
      setBusy(false);
    }
  };

  const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <Modal
      onClose={onClose}
      closeOnEscape={!busy}
      closeOnBackdrop={!busy}
      aria-label={`Copy ${kind} to another store`}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Copy {props.items.length} {noun}
        {props.items.length !== 1 ? 's' : ''} to another store
      </h3>

      {stores.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Add another store in Setup to copy to.
        </p>
      ) : result ? (
        <div className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
          <p
            className={
              result.failed
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }
          >
            {summarizeCopy(result)}
          </p>
          {result.messages.length > 0 && (
            <ul className="list-disc pl-5 max-h-48 overflow-y-auto text-gray-600 dark:text-gray-400">
              {result.messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="copy-target">
              Target store
            </label>
            <select
              id="copy-target"
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setPreview(null);
              }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={label}>
              If a {kind === 'products' ? 'SKU' : 'code'} already exists in the target
            </span>
            {(['skip', 'update'] as const).map((m) => (
              <label
                key={m}
                className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
              >
                <input type="radio" checked={collision === m} onChange={() => setCollision(m)} />
                {m === 'skip' ? 'Skip it' : 'Update the existing one'}
              </label>
            ))}
          </div>

          {
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                checked={createCats}
                onChange={(e) => setCreateCats(e.target.checked)}
              />
              Create missing categories (otherwise they are skipped)
            </label>
          }

          {kind === 'products' && (
            <div>
              <button
                onClick={() => void loadPreview()}
                disabled={busy || !target}
                className="px-3 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
              >
                Preview
              </button>
              {preview && (
                <ul className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>{preview.willCreate.length} will be created</li>
                  <li>
                    {preview.collisions.length} SKU collision(s) -{' '}
                    {collision === 'skip' ? 'will be skipped' : 'will be updated'}
                  </li>
                  {preview.missingCategories.length > 0 && (
                    <li>
                      {preview.missingCategories.length} new categories (
                      {createCats ? 'will be created' : 'will be skipped'}):
                      <ul className="mt-1 font-mono text-xs">
                        {preview.newCategories.map((c) => (
                          <li key={c.slug} style={{ paddingLeft: `${c.depth * 16}px` }}>
                            {c.depth > 0 ? '└ ' : ''}
                            {c.name}
                          </li>
                        ))}
                      </ul>
                    </li>
                  )}
                  {preview.categoryWarnings.map((w) => (
                    <li key={w} className="text-yellow-700 dark:text-yellow-400">
                      {w}
                    </li>
                  ))}
                  {preview.unmatchedAttributes.length > 0 && (
                    <li className="text-yellow-700 dark:text-yellow-400">
                      Attributes not in target (copied as custom):{' '}
                      {preview.unmatchedAttributes.join(', ')}
                    </li>
                  )}
                  {preview.variableCount > 0 && (
                    <li className="text-yellow-700 dark:text-yellow-400">
                      {preview.variableCount} variable product(s): variations copied best-effort
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
          {kind === 'coupons' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Category restrictions are remapped by slug (missing ones are created with their
              parents if enabled); product restrictions are not copied.
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {busy && progress && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{progress}</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          disabled={busy}
          className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
        >
          {result ? 'Close' : 'Cancel'}
        </button>
        {!result && stores.length > 0 && (
          <button
            onClick={() => void run()}
            disabled={busy || !target}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Copying...' : 'Copy'}
          </button>
        )}
      </div>
    </Modal>
  );
}
