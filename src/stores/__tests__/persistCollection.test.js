import { vi, describe, it, expect, beforeEach } from 'vitest';
import { persistCollection } from '../cache/persist';
import * as idb from '../../utils/indexedDBCache';

vi.mock('../../utils/indexedDBCache');

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, v: i }));

describe('persistCollection', () => {
  beforeEach(() => {
    idb.saveCollection.mockResolvedValue(true);
    idb.applyCollectionDelta.mockResolvedValue(true);
  });

  it('does a full save without a baseline', async () => {
    await persistCollection('orders', 's', null, mk(3));
    expect(idb.saveCollection).toHaveBeenCalledTimes(1);
    expect(idb.applyCollectionDelta).not.toHaveBeenCalled();
  });

  it('writes only the changed item for a single-item update', async () => {
    const prev = mk(100);
    const next = prev.map((p) => (p.id === 7 ? { ...p, v: 'x' } : p));
    await persistCollection('orders', 's', prev, next);
    expect(idb.saveCollection).not.toHaveBeenCalled();
    expect(idb.applyCollectionDelta).toHaveBeenCalledWith(
      'orders',
      's',
      [{ item: next[6], index: 6 }],
      []
    );
  });

  it('deletes removed items and skips IO when nothing changed', async () => {
    const prev = mk(100);
    await persistCollection('orders', 's', prev, prev.filter((p) => p.id !== 3));
    expect(idb.applyCollectionDelta.mock.calls[0][3]).toEqual([3]);
    idb.applyCollectionDelta.mockClear();
    await persistCollection('orders', 's', prev, [...prev]);
    expect(idb.applyCollectionDelta).not.toHaveBeenCalled();
    expect(idb.saveCollection).not.toHaveBeenCalled();
  });

  it('falls back to a full save when many items changed', async () => {
    const prev = mk(100);
    await persistCollection('orders', 's', prev, prev.map((p) => ({ ...p })));
    expect(idb.saveCollection).toHaveBeenCalledTimes(1);
  });
});
