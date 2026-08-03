import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSettings from '../settingsStore';

// Mock the config module
vi.mock('../../constants/config', () => ({
  AUTO_REFRESH: {
    DEFAULT_INTERVAL: 5,
    MIN_INTERVAL: 1,
    MAX_INTERVAL: 60,
  },
}));

describe('settingsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSettings.setState({
      autoRefresh: false,
      autoRefreshInterval: 5,
      refreshOrders: null,
      refreshProducts: null,
      refreshAll: null,
    });
  });

  describe('Auto-Refresh Settings', () => {
    describe('setAutoRefresh', () => {
      it('should enable auto-refresh', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefresh(true);
        });

        expect(result.current.autoRefresh).toBe(true);
      });

      it('should disable auto-refresh', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefresh(true);
        });

        act(() => {
          result.current.setAutoRefresh(false);
        });

        expect(result.current.autoRefresh).toBe(false);
      });
    });

    describe('toggleAutoRefresh', () => {
      it('should toggle from false to true', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.toggleAutoRefresh();
        });

        expect(result.current.autoRefresh).toBe(true);
      });

      it('should toggle from true to false', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefresh(true);
        });

        act(() => {
          result.current.toggleAutoRefresh();
        });

        expect(result.current.autoRefresh).toBe(false);
      });
    });

    describe('setAutoRefreshInterval', () => {
      it('should set auto-refresh interval', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefreshInterval(10);
        });

        expect(result.current.autoRefreshInterval).toBe(10);
      });

      it('should clamp interval to minimum', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefreshInterval(0);
        });

        expect(result.current.autoRefreshInterval).toBe(1);
      });

      it('should clamp interval to maximum', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefreshInterval(100);
        });

        expect(result.current.autoRefreshInterval).toBe(60);
      });

      it('should accept valid intervals', () => {
        const { result } = renderHook(() => useSettings());

        const validIntervals = [1, 5, 15, 30, 60];
        validIntervals.forEach((interval) => {
          act(() => {
            result.current.setAutoRefreshInterval(interval);
          });
          expect(result.current.autoRefreshInterval).toBe(interval);
        });
      });
    });

    describe('getAutoRefreshIntervalMs', () => {
      it('should return interval in milliseconds', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefreshInterval(5);
        });

        expect(result.current.getAutoRefreshIntervalMs()).toBe(300000); // 5 * 60 * 1000
      });

      it('should return correct value for 1 minute', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefreshInterval(1);
        });

        expect(result.current.getAutoRefreshIntervalMs()).toBe(60000);
      });

      it('should return correct value for 60 minutes', () => {
        const { result } = renderHook(() => useSettings());

        act(() => {
          result.current.setAutoRefreshInterval(60);
        });

        expect(result.current.getAutoRefreshIntervalMs()).toBe(3600000);
      });
    });
  });

  describe('Refresh Functions', () => {
    describe('setRefreshFunctions', () => {
      it('should set refreshOrders function', () => {
        const { result } = renderHook(() => useSettings());
        const mockRefresh = vi.fn();

        act(() => {
          result.current.setRefreshFunctions({ refreshOrders: mockRefresh });
        });

        expect(result.current.refreshOrders).toBe(mockRefresh);
      });

      it('should set refreshProducts function', () => {
        const { result } = renderHook(() => useSettings());
        const mockRefresh = vi.fn();

        act(() => {
          result.current.setRefreshFunctions({ refreshProducts: mockRefresh });
        });

        expect(result.current.refreshProducts).toBe(mockRefresh);
      });

      it('should set refreshAll function', () => {
        const { result } = renderHook(() => useSettings());
        const mockRefresh = vi.fn();

        act(() => {
          result.current.setRefreshFunctions({ refreshAll: mockRefresh });
        });

        expect(result.current.refreshAll).toBe(mockRefresh);
      });

      it('should set multiple refresh functions at once', () => {
        const { result } = renderHook(() => useSettings());
        const mockRefreshOrders = vi.fn();
        const mockRefreshProducts = vi.fn();
        const mockRefreshAll = vi.fn();

        act(() => {
          result.current.setRefreshFunctions({
            refreshOrders: mockRefreshOrders,
            refreshProducts: mockRefreshProducts,
            refreshAll: mockRefreshAll,
          });
        });

        expect(result.current.refreshOrders).toBe(mockRefreshOrders);
        expect(result.current.refreshProducts).toBe(mockRefreshProducts);
        expect(result.current.refreshAll).toBe(mockRefreshAll);
      });

      it('should not overwrite existing functions when not provided', () => {
        const { result } = renderHook(() => useSettings());
        const mockRefreshOrders = vi.fn();
        const mockRefreshProducts = vi.fn();

        act(() => {
          result.current.setRefreshFunctions({ refreshOrders: mockRefreshOrders });
        });

        act(() => {
          result.current.setRefreshFunctions({ refreshProducts: mockRefreshProducts });
        });

        expect(result.current.refreshOrders).toBe(mockRefreshOrders);
        expect(result.current.refreshProducts).toBe(mockRefreshProducts);
      });
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to defaults', () => {
      const { result } = renderHook(() => useSettings());
      const mockRefresh = vi.fn();

      // Set various values
      act(() => {
        result.current.setAutoRefresh(true);
        result.current.setAutoRefreshInterval(30);
        result.current.setRefreshFunctions({
          refreshOrders: mockRefresh,
          refreshProducts: mockRefresh,
          refreshAll: mockRefresh,
        });
      });

      // Reset
      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.autoRefresh).toBe(false);
      expect(result.current.autoRefreshInterval).toBe(5);
      expect(result.current.refreshOrders).toBeNull();
      expect(result.current.refreshProducts).toBeNull();
      expect(result.current.refreshAll).toBeNull();
    });
  });

  describe('Integration', () => {
    it('should maintain state across multiple operations', () => {
      const { result } = renderHook(() => useSettings());

      // Perform multiple operations
      act(() => {
        result.current.setAutoRefresh(true);
      });

      act(() => {
        result.current.setAutoRefreshInterval(15);
      });

      const mockRefresh = vi.fn();
      act(() => {
        result.current.setRefreshFunctions({ refreshAll: mockRefresh });
      });

      // Verify all changes persisted
      expect(result.current.autoRefresh).toBe(true);
      expect(result.current.autoRefreshInterval).toBe(15);
      expect(result.current.refreshAll).toBe(mockRefresh);
    });

    it('should allow calling refresh functions', () => {
      const { result } = renderHook(() => useSettings());
      const mockRefreshOrders = vi.fn();
      const mockRefreshProducts = vi.fn();
      const mockRefreshAll = vi.fn();

      act(() => {
        result.current.setRefreshFunctions({
          refreshOrders: mockRefreshOrders,
          refreshProducts: mockRefreshProducts,
          refreshAll: mockRefreshAll,
        });
      });

      // Call the refresh functions
      result.current.refreshOrders();
      result.current.refreshProducts();
      result.current.refreshAll();

      expect(mockRefreshOrders).toHaveBeenCalledTimes(1);
      expect(mockRefreshProducts).toHaveBeenCalledTimes(1);
      expect(mockRefreshAll).toHaveBeenCalledTimes(1);
    });
  });
});
