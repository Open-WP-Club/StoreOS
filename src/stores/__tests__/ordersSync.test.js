import { vi } from 'vitest';
import useCache from '../cacheStore';
import * as indexedDBCache from '../../utils/indexedDBCache';

vi.mock('../../utils/indexedDBCache');

describe('orders delta cursor persistence', () => {
  const sync = { storeId: 's1', at: 123, lastSync: '2026-01-01T00:00:00' };

  it('saves the cursor under the store-scoped key', async () => {
    await useCache.getState().saveOrdersSync('s1', sync);
    expect(indexedDBCache.saveToCache).toHaveBeenCalledWith(
      indexedDBCache.STORES.ORDERS,
      's1_lastSync',
      sync
    );
  });

  it('restores the cursor from IndexedDB', async () => {
    indexedDBCache.getFromCache.mockResolvedValue(sync);
    await expect(useCache.getState().loadOrdersSync('s1')).resolves.toEqual(sync);
    expect(indexedDBCache.getFromCache).toHaveBeenCalledWith(
      indexedDBCache.STORES.ORDERS,
      's1_lastSync',
      expect.any(Number)
    );
  });

  it('returns null when IndexedDB fails', async () => {
    indexedDBCache.getFromCache.mockRejectedValue(new Error('x'));
    await expect(useCache.getState().loadOrdersSync('s1')).resolves.toBeNull();
  });
});
