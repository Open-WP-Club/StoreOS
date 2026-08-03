/**
 * Memory Monitor Utility
 *
 * Monitors memory usage and automatically clears cache when memory pressure is high.
 * Uses the Performance API for memory metrics when available.
 */

import useCache from '../stores/cacheStore';
import useNotifications from '../stores/notificationStore';

// Memory thresholds (in bytes)
const MB = 1024 * 1024;
const HIGH_MEMORY_THRESHOLD = 400 * MB; // 400 MB
const CRITICAL_MEMORY_THRESHOLD = 600 * MB; // 600 MB

// Check interval (in milliseconds)
const CHECK_INTERVAL = 60000; // 1 minute

// Cache age thresholds (in milliseconds)
const OLD_CACHE_AGE = 30 * 60 * 1000; // 30 minutes
const VERY_OLD_CACHE_AGE = 60 * 60 * 1000; // 1 hour

// Extend Performance interface for memory info
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/**
 * Get current memory usage if available
 */
export function getMemoryUsage(): PerformanceMemory | null {
  const perf = performance as PerformanceWithMemory;
  return perf.memory || null;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/**
 * Get memory status
 */
export function getMemoryStatus(): 'normal' | 'high' | 'critical' | 'unknown' {
  const memory = getMemoryUsage();
  if (!memory) return 'unknown';

  if (memory.usedJSHeapSize >= CRITICAL_MEMORY_THRESHOLD) return 'critical';
  if (memory.usedJSHeapSize >= HIGH_MEMORY_THRESHOLD) return 'high';
  return 'normal';
}

/**
 * Clear old cache entries based on memory pressure
 */
export async function clearOldCache(aggressive = false): Promise<void> {
  const cacheState = useCache.getState();
  const cache = cacheState.cache;
  const now = Date.now();
  const threshold = aggressive ? OLD_CACHE_AGE : VERY_OLD_CACHE_AGE;

  // Check products cache
  if (cache.products.timestamp && now - cache.products.timestamp > threshold) {
    await cacheState.clearCacheForType('products');
  }

  // Check orders cache
  if (cache.orders.timestamp && now - cache.orders.timestamp > threshold) {
    await cacheState.clearCacheForType('orders');
  }
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isMonitoring = false;

/**
 * Start memory monitoring
 */
export function startMemoryMonitor(): void {
  if (isMonitoring) return;

  const memory = getMemoryUsage();
  if (!memory) {
    return;
  }

  isMonitoring = true;

  monitorInterval = setInterval(async () => {
    const currentMemory = getMemoryUsage();
    if (!currentMemory) return;

    const status = getMemoryStatus();

    if (status === 'critical') {
      useNotifications.getState().addNotification({
        type: 'info',
        title: 'High Memory Usage',
        body: `Memory at ${formatBytes(currentMemory.usedJSHeapSize)} — old cache cleared automatically.`,
      });
      await clearOldCache(true);
    } else if (status === 'high') {
      useNotifications.getState().addNotification({
        type: 'info',
        title: 'Memory Pressure',
        body: `Memory at ${formatBytes(currentMemory.usedJSHeapSize)} — clearing stale cache.`,
      });
      await clearOldCache(false);
    }
  }, CHECK_INTERVAL);
}

/**
 * Stop memory monitoring
 */
export function stopMemoryMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  isMonitoring = false;
}

/**
 * Get memory usage report
 */
export function getMemoryReport(): {
  used: string;
  total: string;
  limit: string;
  percentage: number;
  status: ReturnType<typeof getMemoryStatus>;
} | null {
  const memory = getMemoryUsage();
  if (!memory) return null;

  return {
    used: formatBytes(memory.usedJSHeapSize),
    total: formatBytes(memory.totalJSHeapSize),
    limit: formatBytes(memory.jsHeapSizeLimit),
    percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100),
    status: getMemoryStatus(),
  };
}

export default {
  startMemoryMonitor,
  stopMemoryMonitor,
  getMemoryUsage,
  getMemoryReport,
  getMemoryStatus,
  clearOldCache,
  formatBytes,
};
