import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useStoreConfig from '../storeConfigStore';
import useActivityLog from '../activityLogStore';

// Suppress console logs from the store during tests
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('storeConfigStore', () => {
  let dateNowCounter = 1000000000000;
  const originalDateNow = Date.now;

  beforeEach(() => {
    // Mock Date.now() to return incrementing values
    dateNowCounter = 1000000000000;
    Date.now = vi.fn(() => dateNowCounter++);

    // Reset the stores before each test
    useStoreConfig.setState({
      stores: [],
      currentStoreId: null,
    });
    useActivityLog.setState({ entries: [] });
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('addStore', () => {
    it('should add a new store', () => {
      const { result } = renderHook(() => useStoreConfig());

      let addedStore;
      act(() => {
        addedStore = result.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        });
      });

      expect(result.current.stores).toHaveLength(1);
      expect(addedStore).toMatchObject({
        name: 'Test Store',
        url: 'https://test.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      });
    });

    it('should generate unique id', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Store 1', url: 'https://store1.com' });
        result.current.addStore({ name: 'Store 2', url: 'https://store2.com' });
      });

      expect(result.current.stores[0].id).not.toBe(result.current.stores[1].id);
    });

    it('should include createdAt timestamp', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Test', url: 'https://test.com' });
      });

      expect(result.current.stores[0].createdAt).toBeTruthy();
    });

    it('should include default loading settings', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Test', url: 'https://test.com' });
      });

      expect(result.current.stores[0].loadingSettings).toEqual({
        batchSize: 50,
        batchDelay: 500,
        posInfiniteScroll: true,
        retryDelaySeconds: 60,
      });
    });

    it('should merge custom loading settings', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Test',
          url: 'https://test.com',
          loadingSettings: { batchSize: 100 },
        });
      });

      expect(result.current.stores[0].loadingSettings.batchSize).toBe(100);
      expect(result.current.stores[0].loadingSettings.batchDelay).toBe(500);
    });

    it('should set first store as current', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'First', url: 'https://first.com' });
      });

      expect(result.current.currentStoreId).toBe(result.current.stores[0].id);
    });

    it('should not change current store when adding additional stores', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'First', url: 'https://first.com' });
      });

      const firstStoreId = result.current.currentStoreId;

      act(() => {
        result.current.addStore({ name: 'Second', url: 'https://second.com' });
      });

      expect(result.current.currentStoreId).toBe(firstStoreId);
    });

    it('should log store_added activity', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Logged Store', url: 'https://logged.com' });
      });

      const entries = useActivityLog.getState().entries;
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action: 'store_added',
        entityType: 'store',
        entityName: 'Logged Store',
      });
    });

    it('should include currency settings', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Test',
          url: 'https://test.com',
          currency: 'EUR',
          currencySymbol: '€',
        });
      });

      expect(result.current.stores[0].currency).toBe('EUR');
      expect(result.current.stores[0].currencySymbol).toBe('€');
    });
  });

  describe('updateStore', () => {
    it('should update store name', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Original', url: 'https://test.com' });
      });

      const storeId = result.current.stores[0].id;

      act(() => {
        result.current.updateStore(storeId, { name: 'Updated' });
      });

      expect(result.current.stores[0].name).toBe('Updated');
    });

    it('should update multiple properties', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Test', url: 'https://test.com' });
      });

      const storeId = result.current.stores[0].id;

      act(() => {
        result.current.updateStore(storeId, {
          name: 'Updated',
          url: 'https://updated.com',
          currency: 'BGN',
        });
      });

      expect(result.current.stores[0].name).toBe('Updated');
      expect(result.current.stores[0].url).toBe('https://updated.com');
      expect(result.current.stores[0].currency).toBe('BGN');
    });

    it('should not update other stores', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Store 1', url: 'https://store1.com' });
        result.current.addStore({ name: 'Store 2', url: 'https://store2.com' });
      });

      const store1Id = result.current.stores[0].id;

      act(() => {
        result.current.updateStore(store1Id, { name: 'Updated' });
      });

      expect(result.current.stores[1].name).toBe('Store 2');
    });
  });

  describe('removeStore', () => {
    it('should remove a store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Test', url: 'https://test.com' });
      });

      const storeId = result.current.stores[0].id;

      act(() => {
        result.current.removeStore(storeId);
      });

      expect(result.current.stores).toHaveLength(0);
    });

    it('should log store_removed activity', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'To Remove', url: 'https://remove.com' });
      });

      const storeId = result.current.stores[0].id;
      // Clear the addStore log entry
      useActivityLog.setState({ entries: [] });

      act(() => {
        result.current.removeStore(storeId);
      });

      const entries = useActivityLog.getState().entries;
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action: 'store_removed',
        entityType: 'store',
        entityName: 'To Remove',
      });
    });

    it('should set next store as current when removing current store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Store 1', url: 'https://store1.com' });
        result.current.addStore({ name: 'Store 2', url: 'https://store2.com' });
      });

      const store1Id = result.current.stores[0].id;
      const store2Id = result.current.stores[1].id;

      // Ensure store 1 is current
      act(() => {
        result.current.setCurrentStore(store1Id);
      });

      act(() => {
        result.current.removeStore(store1Id);
      });

      expect(result.current.currentStoreId).toBe(store2Id);
    });

    it('should set currentStoreId to null when removing last store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Test', url: 'https://test.com' });
      });

      const storeId = result.current.stores[0].id;

      act(() => {
        result.current.removeStore(storeId);
      });

      expect(result.current.currentStoreId).toBeNull();
    });

    it('should not change currentStoreId when removing non-current store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Store 1', url: 'https://store1.com' });
        result.current.addStore({ name: 'Store 2', url: 'https://store2.com' });
      });

      const store1Id = result.current.stores[0].id;
      const store2Id = result.current.stores[1].id;

      // Ensure store 1 is current
      act(() => {
        result.current.setCurrentStore(store1Id);
      });

      act(() => {
        result.current.removeStore(store2Id);
      });

      expect(result.current.currentStoreId).toBe(store1Id);
    });
  });

  describe('setCurrentStore', () => {
    it('should set current store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Store 1', url: 'https://store1.com' });
        result.current.addStore({ name: 'Store 2', url: 'https://store2.com' });
      });

      const store2Id = result.current.stores[1].id;

      act(() => {
        result.current.setCurrentStore(store2Id);
      });

      expect(result.current.currentStoreId).toBe(store2Id);
    });
  });

  describe('getCurrentStore', () => {
    it('should return current store object', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      const currentStore = result.current.getCurrentStore();

      expect(currentStore).toBeDefined();
      expect(currentStore.name).toBe('Test Store');
    });

    it('should return undefined when no store is set', () => {
      const { result } = renderHook(() => useStoreConfig());

      const currentStore = result.current.getCurrentStore();

      expect(currentStore).toBeUndefined();
    });
  });

  describe('getStoreById', () => {
    it('should return store by id', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Store 1', url: 'https://store1.com' });
        result.current.addStore({ name: 'Store 2', url: 'https://store2.com' });
      });

      const store2Id = result.current.stores[1].id;
      const store = result.current.getStoreById(store2Id);

      expect(store).toBeDefined();
      expect(store.name).toBe('Store 2');
    });

    it('should return undefined for non-existent id', () => {
      const { result } = renderHook(() => useStoreConfig());

      const store = result.current.getStoreById('non-existent');

      expect(store).toBeUndefined();
    });
  });

  describe('hasStores', () => {
    it('should return false when no stores', () => {
      const { result } = renderHook(() => useStoreConfig());

      expect(result.current.hasStores()).toBe(false);
    });

    it('should return true when stores exist', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({ name: 'Test', url: 'https://test.com' });
      });

      expect(result.current.hasStores()).toBe(true);
    });
  });
});
