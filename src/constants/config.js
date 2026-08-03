/**
 * Application Configuration Constants
 *
 * Centralizes all magic numbers and configuration values
 * to make the codebase more maintainable and consistent.
 */

// ============================================
// Time Constants (in milliseconds)
// ============================================

export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
};

// ============================================
// Cache Expiry Times
// ============================================

export const CACHE_EXPIRY = {
  // Products - split caching like orders
  // Recent products (modified < 7 days) - moderate update frequency
  PRODUCTS_RECENT: 30 * TIME.MINUTE,
  // Old products (modified >= 7 days) - rarely change
  PRODUCTS_OLD: 7 * TIME.DAY,
  // Legacy key for backward compatibility
  PRODUCTS: 30 * TIME.MINUTE,

  // Orders - split caching
  // Recent orders (< 7 days old) - high update frequency
  ORDERS_RECENT: 15 * TIME.MINUTE,
  // Old orders (>= 7 days old) - rarely change
  ORDERS_OLD: 7 * TIME.DAY,
  // Completed orders - almost never change (only manual refresh)
  ORDERS_COMPLETED: 180 * TIME.DAY,

  // Customers - moderate update frequency
  CUSTOMERS: 1 * TIME.HOUR,

  // Coupons - rarely change
  COUPONS: 2 * TIME.HOUR,

  // Default expiry for other cache types
  DEFAULT: 30 * TIME.MINUTE,
};

// ============================================
// Order Age Threshold
// ============================================

export const ORDER_AGE = {
  // Orders older than this are considered "old" for caching purposes
  SPLIT_THRESHOLD: 7 * TIME.DAY,
};

// ============================================
// Product Age Threshold
// ============================================

export const PRODUCT_AGE = {
  // Products not modified in this time are considered "old" for caching
  SPLIT_THRESHOLD: 7 * TIME.DAY,
};

// ============================================
// Inventory Thresholds
// ============================================

export const INVENTORY = {
  // Products with stock <= this value are considered "low stock"
  LOW_STOCK_THRESHOLD: 5,

  // Products with stock <= this are "critical"
  CRITICAL_STOCK_THRESHOLD: 2,
};

// ============================================
// Pagination Defaults
// ============================================

export const PAGINATION = {
  // Default number of items per page
  DEFAULT_PAGE_SIZE: 25,

  // Available page size options
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],

  // Maximum items per API request
  API_MAX_PER_PAGE: 100,
};

// ============================================
// Search Configuration
// ============================================

export const SEARCH = {
  // Debounce delay for search input (ms)
  DEBOUNCE_DELAY: 300,

  // Minimum characters to trigger search
  MIN_CHARS: 1,

  // Maximum recent searches to store
  MAX_RECENT_SEARCHES: 10,

  // Fuzzy search threshold (0-1, higher = stricter)
  FUZZY_THRESHOLD: 0.6,

  // Minimum score for search results
  MIN_SCORE: 0.3,
};

// ============================================
// API Configuration
// ============================================

export const API = {
  // Delay between batch requests (ms) - rate limiting protection
  BATCH_DELAY: 500,

  // Request timeout (ms)
  TIMEOUT: 30 * TIME.SECOND,

  // Maximum retry attempts
  MAX_RETRIES: 3,

  // Delay between retries (ms)
  RETRY_DELAY: 1000,
};

// ============================================
// UI Configuration
// ============================================

export const UI = {
  // Toast notification duration (ms)
  TOAST_DURATION: 5000,

  // Animation durations
  ANIMATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },

  // Scroll behavior
  SCROLL: {
    BEHAVIOR: 'smooth',
    TOP_OFFSET: 0,
  },
};

// ============================================
// Auto-Refresh Settings
// ============================================

export const AUTO_REFRESH = {
  // Default interval (minutes)
  DEFAULT_INTERVAL: 5,

  // Minimum allowed interval (minutes)
  MIN_INTERVAL: 1,

  // Maximum allowed interval (minutes)
  MAX_INTERVAL: 60,

  // Available interval options
  INTERVAL_OPTIONS: [1, 2, 5, 10, 15, 30, 60],
};

// ============================================
// Error Messages
// ============================================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'Your credentials are invalid. Please re-authenticate.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  TIMEOUT: 'Request timed out. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Get user-friendly error message from error object
 * @param {Error|Object} error - The error to get message from
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(error) {
  if (!error) return ERROR_MESSAGES.UNKNOWN;

  const errorCode = error.code || error.response?.status;
  const errorMessage = error.message || error.response?.data?.message;

  switch (errorCode) {
    case 'NETWORK_ERROR':
    case 'ERR_NETWORK':
      return ERROR_MESSAGES.NETWORK_ERROR;
    case 401:
      return ERROR_MESSAGES.UNAUTHORIZED;
    case 404:
      return ERROR_MESSAGES.NOT_FOUND;
    case 500:
    case 502:
    case 503:
      return ERROR_MESSAGES.SERVER_ERROR;
    case 'ECONNABORTED':
      return ERROR_MESSAGES.TIMEOUT;
    default:
      return errorMessage || ERROR_MESSAGES.UNKNOWN;
  }
}

export default {
  TIME,
  CACHE_EXPIRY,
  ORDER_AGE,
  PRODUCT_AGE,
  INVENTORY,
  PAGINATION,
  SEARCH,
  API,
  UI,
  AUTO_REFRESH,
  ERROR_MESSAGES,
  getErrorMessage,
};
