import { renderHook, act } from '@testing-library/react';
import useActivityLog from '../activityLogStore';

describe('activityLogStore', () => {
  beforeEach(() => {
    useActivityLog.setState({
      entries: [],
      maxEntries: 500,
    });
  });

  describe('logActivity', () => {
    it('adds an entry to the log', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'order_status_changed',
          entityType: 'order',
          entityId: 42,
          entityName: 'Order #42',
          storeId: 'store-1',
          storeName: 'Test Store',
        });
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]).toMatchObject({
        action: 'order_status_changed',
        entityType: 'order',
        entityId: 42,
        entityName: 'Order #42',
        storeId: 'store-1',
        storeName: 'Test Store',
      });
    });

    it('generates unique id and timestamp', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          storeId: null,
        });
      });

      const entry = result.current.entries[0]!;
      expect(entry.id).toBeTruthy();
      expect(entry.timestamp).toBeTruthy();
      expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
    });

    it('returns the created entry', () => {
      const { result } = renderHook(() => useActivityLog());

      let entry;
      act(() => {
        entry = result.current.logActivity({
          action: 'product_updated',
          entityType: 'product',
          entityId: 10,
          storeId: 'store-1',
        });
      });

      expect(entry).toMatchObject({
        action: 'product_updated',
        entityId: 10,
      });
      expect(entry!.id).toBeTruthy();
    });

    it('prepends new entries (newest first)', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          entityName: 'First',
          storeId: null,
        });
        result.current.logActivity({
          action: 'product_updated',
          entityType: 'product',
          entityName: 'Second',
          storeId: null,
        });
      });

      expect(result.current.entries[0]!.entityName).toBe('Second');
      expect(result.current.entries[1]!.entityName).toBe('First');
    });

    it('stores change details', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'order_status_changed',
          entityType: 'order',
          entityId: 5,
          storeId: 'store-1',
          changes: {
            status: { from: 'pending', to: 'processing' },
          },
        });
      });

      expect(result.current.entries[0]!.changes).toEqual({
        status: { from: 'pending', to: 'processing' },
      });
    });

    it('stores details string', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'product_bulk_updated',
          entityType: 'product',
          storeId: 'store-1',
          details: 'Bulk updated 5 products',
        });
      });

      expect(result.current.entries[0]!.details).toBe('Bulk updated 5 products');
    });

    it('enforces maxEntries limit', () => {
      useActivityLog.setState({ maxEntries: 5 });
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        for (let i = 0; i < 8; i++) {
          result.current.logActivity({
            action: 'product_updated',
            entityType: 'product',
            entityName: `Product ${i}`,
            storeId: null,
          });
        }
      });

      expect(result.current.entries).toHaveLength(5);
      // Newest should be first
      expect(result.current.entries[0]!.entityName).toBe('Product 7');
    });
  });

  describe('clearLog', () => {
    it('removes all entries', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          storeId: null,
        });
        result.current.logActivity({
          action: 'order_updated',
          entityType: 'order',
          storeId: null,
        });
      });

      expect(result.current.entries).toHaveLength(2);

      act(() => {
        result.current.clearLog();
      });

      expect(result.current.entries).toHaveLength(0);
    });
  });

  describe('clearLogForStore', () => {
    it('removes only entries for the specified store', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          entityName: 'Store 1 Product',
          storeId: 'store-1',
        });
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          entityName: 'Store 2 Product',
          storeId: 'store-2',
        });
        result.current.logActivity({
          action: 'order_updated',
          entityType: 'order',
          entityName: 'Store 1 Order',
          storeId: 'store-1',
        });
      });

      act(() => {
        result.current.clearLogForStore('store-1');
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]!.storeId).toBe('store-2');
    });
  });

  describe('getEntriesForStore', () => {
    it('returns entries for a specific store', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          storeId: 'store-1',
        });
        result.current.logActivity({
          action: 'order_updated',
          entityType: 'order',
          storeId: 'store-2',
        });
        result.current.logActivity({
          action: 'product_deleted',
          entityType: 'product',
          storeId: 'store-1',
        });
      });

      const store1Entries = result.current.getEntriesForStore('store-1');
      expect(store1Entries).toHaveLength(2);
      store1Entries.forEach((e) => expect(e.storeId).toBe('store-1'));
    });

    it('returns entries with null storeId when queried with null', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'settings_changed',
          entityType: 'system',
          storeId: null,
        });
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          storeId: 'store-1',
        });
      });

      const nullEntries = result.current.getEntriesForStore(null);
      expect(nullEntries).toHaveLength(1);
      expect(nullEntries[0]!.action).toBe('settings_changed');
    });
  });

  describe('getEntriesByType', () => {
    it('returns entries filtered by entity type', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'order_status_changed',
          entityType: 'order',
          storeId: null,
        });
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          storeId: null,
        });
        result.current.logActivity({
          action: 'order_updated',
          entityType: 'order',
          storeId: null,
        });
      });

      const orderEntries = result.current.getEntriesByType('order');
      expect(orderEntries).toHaveLength(2);
      orderEntries.forEach((e) => expect(e.entityType).toBe('order'));
    });
  });

  describe('getEntriesByAction', () => {
    it('returns entries filtered by action', () => {
      const { result } = renderHook(() => useActivityLog());

      act(() => {
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          storeId: null,
        });
        result.current.logActivity({
          action: 'product_updated',
          entityType: 'product',
          storeId: null,
        });
        result.current.logActivity({
          action: 'product_created',
          entityType: 'product',
          storeId: null,
        });
      });

      const created = result.current.getEntriesByAction('product_created');
      expect(created).toHaveLength(2);
      created.forEach((e) => expect(e.action).toBe('product_created'));
    });
  });
});
