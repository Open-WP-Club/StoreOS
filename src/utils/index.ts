/**
 * Utility exports
 * Central export point for all utility functions
 */

// Date and time utilities (enhanced with Temporal API)
export {
  formatDate,
  formatDateTime,
  formatTime,
  getRelativeTime,
  nowISO,
  todayString,
  toPlainDate,
  daysBetween,
  addDays,
  getDateRange,
  isTemporalAvailable,
  formatDuration,
} from './dateTime';

// Currency utilities
export { formatCurrency, formatPrice, getCurrencySymbol, getCurrencyCode } from './currency';

// CSV export utilities
export { exportToCSV } from './csvExport';

// Search utilities
export {
  searchProducts,
  searchOrders,
  searchCustomers,
  universalSearch,
  applyProductFilters,
  applyOrderFilters,
  generateAutocompleteSuggestions,
  highlightMatch,
} from './searchService';

// IndexedDB cache utilities
export {
  saveToCache,
  getFromCache,
  clearCacheStore,
  clearAllCache,
  deleteDatabase,
  getIndexedDBStatus,
  STORES,
} from './indexedDBCache';

// I18n utilities
export { t, getSupportedLanguages, isLanguageSupported, getLanguageInfo } from './i18n';

// Memory monitor utilities
export { startMemoryMonitor, stopMemoryMonitor, getMemoryUsage, getMemoryStatus, formatBytes, getMemoryReport, clearOldCache } from './memoryMonitor';

// Startup metrics
export { startupMetrics } from './startupMetrics';
