import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useOffline from '../offlineStore';

// Mock fetch for checkOnlineStatus tests
global.fetch = vi.fn();

describe('offlineStore', () => {
  const mockOperation = {
    type: 'update_order',
    data: { id: 1, status: 'completed' },
    storeId: 'test-store-1',
  };

  beforeEach(() => {
    // Reset store state before each test
    useOffline.setState({
      isOnline: true,
      pendingOperations: [],
      lastSyncAttempt: null,
    });

    // Reset fetch mock
    vi.clearAllMocks();
    global.fetch.mockResolvedValue({ ok: true });

    // Reset navigator.onLine (jsdom default)
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  describe('Online/Offline Status', () => {
    it('should initialize with isOnline true when navigator.onLine is true', () => {
      const { result } = renderHook(() => useOffline());
      expect(result.current.isOnline).toBe(true);
    });

    it('should set online status', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.setOnline(false);
      });

      expect(result.current.isOnline).toBe(false);

      act(() => {
        result.current.setOnline(true);
      });

      expect(result.current.isOnline).toBe(true);
    });

    it('should check online status and return true when connected', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useOffline());

      let status;
      await act(async () => {
        status = await result.current.checkOnlineStatus();
      });

      expect(status).toBe(true);
      expect(result.current.isOnline).toBe(true);
    });

    it('should check online status and return false when fetch fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useOffline());

      let status;
      await act(async () => {
        status = await result.current.checkOnlineStatus();
      });

      expect(status).toBe(false);
      expect(result.current.isOnline).toBe(false);
    });

    it('should return false when navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      const { result } = renderHook(() => useOffline());

      let status;
      await act(async () => {
        status = await result.current.checkOnlineStatus();
      });

      expect(status).toBe(false);
      expect(result.current.isOnline).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Pending Operations', () => {
    it('should add a pending operation and return its ID', () => {
      const { result } = renderHook(() => useOffline());

      let operationId;
      act(() => {
        operationId = result.current.addPendingOperation(
          mockOperation.type,
          mockOperation.data,
          mockOperation.storeId
        );
      });

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
      expect(result.current.pendingOperations).toHaveLength(1);
      expect(result.current.pendingOperations[0]).toMatchObject({
        id: operationId,
        type: mockOperation.type,
        data: mockOperation.data,
        storeId: mockOperation.storeId,
        retryCount: 0,
      });
      expect(result.current.pendingOperations[0].timestamp).toBeDefined();
    });

    it('should add multiple pending operations', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
        result.current.addPendingOperation('create_product', { name: 'Test' }, 'store-1');
        result.current.addPendingOperation('update_stock', { id: 2, qty: 10 }, 'store-2');
      });

      expect(result.current.pendingOperations).toHaveLength(3);
    });

    it('should generate unique IDs for operations', () => {
      const { result } = renderHook(() => useOffline());

      const ids = [];
      act(() => {
        for (let i = 0; i < 5; i++) {
          ids.push(result.current.addPendingOperation('update_order', { id: i }, 'store-1'));
        }
      });

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should remove a pending operation by ID', () => {
      const { result } = renderHook(() => useOffline());

      let operationId;
      act(() => {
        operationId = result.current.addPendingOperation(
          mockOperation.type,
          mockOperation.data,
          mockOperation.storeId
        );
      });

      expect(result.current.pendingOperations).toHaveLength(1);

      act(() => {
        result.current.removePendingOperation(operationId);
      });

      expect(result.current.pendingOperations).toHaveLength(0);
    });

    it('should update a pending operation', () => {
      const { result } = renderHook(() => useOffline());

      let operationId;
      act(() => {
        operationId = result.current.addPendingOperation(
          mockOperation.type,
          mockOperation.data,
          mockOperation.storeId
        );
      });

      act(() => {
        result.current.updatePendingOperation(operationId, {
          retryCount: 2,
          lastError: 'Connection timeout',
        });
      });

      expect(result.current.pendingOperations[0].retryCount).toBe(2);
      expect(result.current.pendingOperations[0].lastError).toBe('Connection timeout');
    });

    it('should not update non-existent operation', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation(
          mockOperation.type,
          mockOperation.data,
          mockOperation.storeId
        );
      });

      act(() => {
        result.current.updatePendingOperation('non-existent-id', { retryCount: 5 });
      });

      expect(result.current.pendingOperations[0].retryCount).toBe(0);
    });

    it('should get all pending operations', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
        result.current.addPendingOperation('create_product', { name: 'Test' }, 'store-2');
      });

      const operations = result.current.getPendingOperations();
      expect(operations).toHaveLength(2);
    });

    it('should filter pending operations by storeId', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
        result.current.addPendingOperation('create_product', { name: 'Test' }, 'store-2');
        result.current.addPendingOperation('update_stock', { id: 2 }, 'store-1');
      });

      const store1Operations = result.current.getPendingOperations('store-1');
      expect(store1Operations).toHaveLength(2);
      store1Operations.forEach((op) => {
        expect(op.storeId).toBe('store-1');
      });

      const store2Operations = result.current.getPendingOperations('store-2');
      expect(store2Operations).toHaveLength(1);
      expect(store2Operations[0].storeId).toBe('store-2');
    });

    it('should clear all pending operations', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
        result.current.addPendingOperation('create_product', { name: 'Test' }, 'store-2');
      });

      expect(result.current.pendingOperations).toHaveLength(2);

      act(() => {
        result.current.clearPendingOperations();
      });

      expect(result.current.pendingOperations).toHaveLength(0);
    });

    it('should clear pending operations for specific store', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
        result.current.addPendingOperation('create_product', { name: 'Test' }, 'store-2');
        result.current.addPendingOperation('update_stock', { id: 2 }, 'store-1');
      });

      expect(result.current.pendingOperations).toHaveLength(3);

      act(() => {
        result.current.clearPendingOperations('store-1');
      });

      expect(result.current.pendingOperations).toHaveLength(1);
      expect(result.current.pendingOperations[0].storeId).toBe('store-2');
    });
  });

  describe('Sync Management', () => {
    it('should set last sync attempt timestamp', () => {
      const { result } = renderHook(() => useOffline());
      const timestamp = Date.now();

      act(() => {
        result.current.setLastSyncAttempt(timestamp);
      });

      expect(result.current.lastSyncAttempt).toBe(timestamp);
    });

    it('should increment retry count for an operation', () => {
      const { result } = renderHook(() => useOffline());

      let operationId;
      act(() => {
        operationId = result.current.addPendingOperation(
          mockOperation.type,
          mockOperation.data,
          mockOperation.storeId
        );
      });

      expect(result.current.pendingOperations[0].retryCount).toBe(0);

      act(() => {
        result.current.incrementRetryCount(operationId);
      });

      expect(result.current.pendingOperations[0].retryCount).toBe(1);

      act(() => {
        result.current.incrementRetryCount(operationId);
        result.current.incrementRetryCount(operationId);
      });

      expect(result.current.pendingOperations[0].retryCount).toBe(3);
    });

    it('should get failed operations (retryCount >= MAX_RETRY_COUNT)', () => {
      const { result } = renderHook(() => useOffline());

      let operationId1, operationId2;
      act(() => {
        operationId1 = result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
        operationId2 = result.current.addPendingOperation('create_product', { name: 'Test' }, 'store-1');
      });

      // Increment operation1 to MAX_RETRY_COUNT (3)
      act(() => {
        result.current.incrementRetryCount(operationId1);
        result.current.incrementRetryCount(operationId1);
        result.current.incrementRetryCount(operationId1);
      });

      // Leave operation2 with retryCount of 1
      act(() => {
        result.current.incrementRetryCount(operationId2);
      });

      const failedOperations = result.current.getFailedOperations();
      expect(failedOperations).toHaveLength(1);
      expect(failedOperations[0].id).toBe(operationId1);
    });

    it('should return empty array when no failed operations', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
      });

      const failedOperations = result.current.getFailedOperations();
      expect(failedOperations).toHaveLength(0);
    });
  });

  describe('Persistence', () => {
    it('should persist pendingOperations to localStorage', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
      });

      // Check localStorage
      const storedData = JSON.parse(localStorage.getItem('woocommerce-offline-store') || '{}');
      expect(storedData.state.pendingOperations).toHaveLength(1);
    });

    it('should persist lastSyncAttempt to localStorage', () => {
      const { result } = renderHook(() => useOffline());
      const timestamp = Date.now();

      act(() => {
        result.current.setLastSyncAttempt(timestamp);
      });

      const storedData = JSON.parse(localStorage.getItem('woocommerce-offline-store') || '{}');
      expect(storedData.state.lastSyncAttempt).toBe(timestamp);
    });

    it('should not persist isOnline state', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.setOnline(false);
      });

      // isOnline should not be in the persisted state
      const storedData = JSON.parse(localStorage.getItem('woocommerce-offline-store') || '{}');
      expect(storedData.state.isOnline).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle removing non-existent operation', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
      });

      expect(result.current.pendingOperations).toHaveLength(1);

      act(() => {
        result.current.removePendingOperation('non-existent-id');
      });

      expect(result.current.pendingOperations).toHaveLength(1);
    });

    it('should handle incrementing retry count for non-existent operation', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
      });

      const originalRetryCount = result.current.pendingOperations[0].retryCount;

      act(() => {
        result.current.incrementRetryCount('non-existent-id');
      });

      expect(result.current.pendingOperations[0].retryCount).toBe(originalRetryCount);
    });

    it('should handle clearing operations for non-existent store', () => {
      const { result } = renderHook(() => useOffline());

      act(() => {
        result.current.addPendingOperation('update_order', { id: 1 }, 'store-1');
      });

      act(() => {
        result.current.clearPendingOperations('non-existent-store');
      });

      expect(result.current.pendingOperations).toHaveLength(1);
    });

    it('should handle empty data object in operation', () => {
      const { result } = renderHook(() => useOffline());

      let operationId;
      act(() => {
        operationId = result.current.addPendingOperation('update_order', {}, 'store-1');
      });

      expect(result.current.pendingOperations[0].data).toEqual({});
      expect(operationId).toBeDefined();
    });
  });
});
