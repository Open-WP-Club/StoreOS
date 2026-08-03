import { vi } from 'vitest';
import {
  getMemoryUsage,
  formatBytes,
  getMemoryStatus,
  clearOldCache,
  startMemoryMonitor,
  stopMemoryMonitor,
  getMemoryReport,
} from '../memoryMonitor';
import useCache from '../../stores/cacheStore';
import useNotifications from '../../stores/notificationStore';

// Mock the cacheStore
vi.mock('../../stores/cacheStore', () => ({
  __esModule: true,
  default: {
    getState: vi.fn(),
  },
}));

// Mock the notificationStore - startMemoryMonitor surfaces memory pressure
// via in-app notifications rather than console.warn/info (see commit 796eb7f).
vi.mock('../../stores/notificationStore', () => ({
  __esModule: true,
  default: {
    getState: vi.fn(),
  },
}));

describe('memoryMonitor', () => {
  const MB = 1024 * 1024;

  // Mock performance.memory
  const mockPerformanceMemory = {
    usedJSHeapSize: 100 * MB,
    totalJSHeapSize: 200 * MB,
    jsHeapSizeLimit: 2048 * MB,
  };

  let originalPerformance;

  beforeEach(() => {
    // Save original performance object
    originalPerformance = global.performance;

    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock useCache getState
    useCache.getState.mockReturnValue({
      cache: {
        products: { data: null, timestamp: null },
        orders: { data: null, timestamp: null },
      },
      clearCacheForType: vi.fn().mockResolvedValue(undefined),
    });

    // Mock useNotifications getState
    useNotifications.getState.mockReturnValue({
      addNotification: vi.fn(),
    });
  });

  afterEach(() => {
    // Restore original performance object
    global.performance = originalPerformance;
    vi.useRealTimers();
    stopMemoryMonitor();
  });

  describe('getMemoryUsage', () => {
    it('should return memory info when available', () => {
      global.performance = {
        ...originalPerformance,
        memory: mockPerformanceMemory,
      };

      const memory = getMemoryUsage();

      expect(memory).toEqual(mockPerformanceMemory);
    });

    it('should return null when memory API is not available', () => {
      global.performance = {
        ...originalPerformance,
        memory: undefined,
      };

      const memory = getMemoryUsage();

      expect(memory).toBeNull();
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(2048)).toBe('2.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatBytes(MB)).toBe('1.0 MB');
      expect(formatBytes(100 * MB)).toBe('100.0 MB');
      expect(formatBytes(1.5 * MB)).toBe('1.5 MB');
    });

    it('should format large values correctly', () => {
      expect(formatBytes(1024 * MB)).toBe('1024.0 MB');
      expect(formatBytes(2048 * MB)).toBe('2048.0 MB');
    });
  });

  describe('getMemoryStatus', () => {
    it('should return "unknown" when memory API is not available', () => {
      global.performance = {
        ...originalPerformance,
        memory: undefined,
      };

      expect(getMemoryStatus()).toBe('unknown');
    });

    it('should return "normal" for low memory usage', () => {
      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 100 * MB, // 100 MB
          totalJSHeapSize: 200 * MB,
          jsHeapSizeLimit: 2048 * MB,
        },
      };

      expect(getMemoryStatus()).toBe('normal');
    });

    it('should return "high" for high memory usage', () => {
      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 450 * MB, // 450 MB (>400 MB threshold)
          totalJSHeapSize: 500 * MB,
          jsHeapSizeLimit: 2048 * MB,
        },
      };

      expect(getMemoryStatus()).toBe('high');
    });

    it('should return "critical" for critical memory usage', () => {
      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 650 * MB, // 650 MB (>600 MB threshold)
          totalJSHeapSize: 700 * MB,
          jsHeapSizeLimit: 2048 * MB,
        },
      };

      expect(getMemoryStatus()).toBe('critical');
    });
  });

  describe('clearOldCache', () => {
    it('should clear old products cache when aggressive=true', async () => {
      const clearCacheForType = vi.fn().mockResolvedValue(undefined);
      const now = Date.now();
      const oldTimestamp = now - 35 * 60 * 1000; // 35 minutes ago

      useCache.getState.mockReturnValue({
        cache: {
          products: { data: ['product'], timestamp: oldTimestamp },
          orders: { data: null, timestamp: null },
        },
        clearCacheForType,
      });

      await clearOldCache(true);

      expect(clearCacheForType).toHaveBeenCalledWith('products');
    });

    it('should clear very old orders cache', async () => {
      const clearCacheForType = vi.fn().mockResolvedValue(undefined);
      const now = Date.now();
      const veryOldTimestamp = now - 65 * 60 * 1000; // 65 minutes ago (> 1 hour)

      useCache.getState.mockReturnValue({
        cache: {
          products: { data: null, timestamp: null },
          orders: { data: ['order'], timestamp: veryOldTimestamp },
        },
        clearCacheForType,
      });

      await clearOldCache(false);

      expect(clearCacheForType).toHaveBeenCalledWith('orders');
    });

    it('should not clear recent cache', async () => {
      const clearCacheForType = vi.fn().mockResolvedValue(undefined);
      const now = Date.now();
      const recentTimestamp = now - 10 * 60 * 1000; // 10 minutes ago

      useCache.getState.mockReturnValue({
        cache: {
          products: { data: ['product'], timestamp: recentTimestamp },
          orders: { data: ['order'], timestamp: recentTimestamp },
        },
        clearCacheForType,
      });

      await clearOldCache(false);

      expect(clearCacheForType).not.toHaveBeenCalled();
    });
  });

  describe('startMemoryMonitor', () => {
    it('should not start if memory API is unavailable', () => {
      global.performance = {
        ...originalPerformance,
        memory: undefined,
      };
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      startMemoryMonitor();

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('should start monitoring when memory API is available', () => {
      global.performance = {
        ...originalPerformance,
        memory: mockPerformanceMemory,
      };
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      startMemoryMonitor();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('should not start multiple monitors', () => {
      global.performance = {
        ...originalPerformance,
        memory: mockPerformanceMemory,
      };
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      startMemoryMonitor();
      startMemoryMonitor();

      // The second call is a no-op since a monitor is already running
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('should clear old cache and notify on critical memory', async () => {
      const clearCacheForType = vi.fn().mockResolvedValue(undefined);
      const addNotification = vi.fn();
      const now = Date.now();
      const oldTimestamp = now - 35 * 60 * 1000;

      useCache.getState.mockReturnValue({
        cache: {
          products: { data: ['product'], timestamp: oldTimestamp },
          orders: { data: ['order'], timestamp: oldTimestamp },
        },
        clearCacheForType,
      });
      useNotifications.getState.mockReturnValue({ addNotification });

      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 650 * MB, // Critical
          totalJSHeapSize: 700 * MB,
          jsHeapSizeLimit: 2048 * MB,
        },
      };

      startMemoryMonitor();

      // Advance timers to trigger the interval
      await vi.advanceTimersByTimeAsync(60000);

      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'High Memory Usage',
          body: expect.stringContaining('650.0 MB'),
        })
      );
      expect(clearCacheForType).toHaveBeenCalledWith('products');
      expect(clearCacheForType).toHaveBeenCalledWith('orders');
    });
  });

  describe('stopMemoryMonitor', () => {
    it('should stop the monitor', () => {
      global.performance = {
        ...originalPerformance,
        memory: mockPerformanceMemory,
      };

      startMemoryMonitor();
      stopMemoryMonitor();

      // Should not throw and monitor should be stopped
    });

    it('should handle stopping when not started', () => {
      // Should not throw
      stopMemoryMonitor();
    });
  });

  describe('getMemoryReport', () => {
    it('should return null when memory API is not available', () => {
      global.performance = {
        ...originalPerformance,
        memory: undefined,
      };

      expect(getMemoryReport()).toBeNull();
    });

    it('should return formatted memory report', () => {
      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 100 * MB,
          totalJSHeapSize: 200 * MB,
          jsHeapSizeLimit: 2048 * MB,
        },
      };

      const report = getMemoryReport();

      expect(report).toEqual({
        used: '100.0 MB',
        total: '200.0 MB',
        limit: '2048.0 MB',
        percentage: 5, // (100 / 2048) * 100 ≈ 5%
        status: 'normal',
      });
    });

    it('should calculate percentage correctly', () => {
      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 512 * MB,
          totalJSHeapSize: 1024 * MB,
          jsHeapSizeLimit: 2048 * MB,
        },
      };

      const report = getMemoryReport();

      expect(report.percentage).toBe(25);
    });
  });

  describe('Memory Thresholds', () => {
    it('should use 400 MB as high threshold', () => {
      // 399 MB should be normal
      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 399 * MB,
          totalJSHeapSize: 500 * MB,
          jsHeapSizeLimit: 2048 * MB,
        },
      };
      expect(getMemoryStatus()).toBe('normal');

      // 401 MB should be high
      global.performance.memory.usedJSHeapSize = 401 * MB;
      expect(getMemoryStatus()).toBe('high');
    });

    it('should use 600 MB as critical threshold', () => {
      // 599 MB should be high
      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 599 * MB,
          totalJSHeapSize: 700 * MB,
          jsHeapSizeLimit: 2048 * MB,
        },
      };
      expect(getMemoryStatus()).toBe('high');

      // 601 MB should be critical
      global.performance.memory.usedJSHeapSize = 601 * MB;
      expect(getMemoryStatus()).toBe('critical');
    });
  });
});
