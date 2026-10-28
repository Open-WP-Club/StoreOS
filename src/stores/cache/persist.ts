import { saveCollection, applyCollectionDelta } from '../../utils/indexedDBCache';

type Item = { id: string | number };
type CollectionStore = Parameters<typeof saveCollection>[0];

/** Above this fraction of changed items a full rewrite is cheaper than a delta. */
const DELTA_MAX_RATIO = 0.25;

/**
 * Persist `next` for a collection. Callers typically build `next` by mapping the previous
 * array and replacing one item, so unchanged items keep their object identity; we diff by
 * reference against `prev` (what is already persisted) and write only the changed items.
 * Falls back to a full chunked save when there is no usable baseline or many items changed.
 */
export const persistCollection = async <T extends Item>(
  store: CollectionStore,
  scope: string,
  prev: readonly T[] | null,
  next: readonly T[]
): Promise<void> => {
  if (prev === next) return;
  if (!prev || prev.length === 0) {
    await saveCollection(store, scope, next);
    return;
  }
  const prevById = new Map<string | number, T>();
  for (const p of prev) prevById.set(p.id, p);

  const puts: { item: T; index: number }[] = [];
  const seen = new Set<string | number>();
  next.forEach((item, index) => {
    seen.add(item.id);
    if (prevById.get(item.id) !== item) puts.push({ item, index });
  });
  const deletes: (string | number)[] = [];
  for (const id of prevById.keys()) if (!seen.has(id)) deletes.push(id);

  if ((puts.length + deletes.length) / Math.max(next.length, prev.length) > DELTA_MAX_RATIO) {
    await saveCollection(store, scope, next);
  } else if (puts.length + deletes.length > 0) {
    await applyCollectionDelta(store, scope, puts, deletes);
  }
};
