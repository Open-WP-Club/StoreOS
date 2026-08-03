/**
 * Currency formatting utilities
 */

// ============================================
// Types
// ============================================

interface CurrencyData {
  currency?: string;
  currency_symbol?: string;
}

// ============================================
// Functions
// ============================================

/**
 * Format a price with currency symbol
 * Only shows currency symbol if it's provided and valid
 */
export const formatPrice = (price: string | number | null | undefined, currencySymbol: string | null = null): string => {
  // Handle null, undefined, or empty price
  if (price === null || price === undefined || price === '') {
    return '';
  }

  // Convert to string for consistent handling
  const priceStr = String(price);

  // Only show currency symbol if it's provided and not empty
  if (currencySymbol && currencySymbol.trim() !== '') {
    return `${currencySymbol}${priceStr}`;
  }

  // Return just the price without any symbol
  return priceStr;
};

/**
 * Get currency symbol from store settings or product/order data
 * Falls back to no symbol if not available
 */
export const getCurrencySymbol = (data: CurrencyData | null | undefined): string | null => {
  if (!data) return null;

  // Check for currency_symbol (from orders)
  if (data.currency_symbol && data.currency_symbol.trim() !== '') {
    return data.currency_symbol;
  }

  // Check for currency code (could be used to get symbol)
  if (data.currency && data.currency.trim() !== '') {
    // Could expand this to map currency codes to symbols
    // For now, return null to avoid showing incorrect symbols
    return null;
  }

  return null;
};

/**
 * Format currency amount using Intl.NumberFormat
 * Automatically detects currency from data or uses provided currency code
 */
export const formatCurrency = (
  amount: number | string | null | undefined,
  currencyOrData: string | CurrencyData | null = null,
  locale: string = 'en-US'
): string => {
  // Handle null, undefined, or empty amount
  if (amount === null || amount === undefined || amount === '') {
    return '';
  }

  // Convert amount to number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Determine currency code
  let currencyCode = 'USD'; // Default fallback

  if (typeof currencyOrData === 'string' && currencyOrData) {
    // Direct currency code provided
    currencyCode = currencyOrData;
  } else if (typeof currencyOrData === 'object' && currencyOrData) {
    // Extract from data object (order or product)
    if (currencyOrData.currency) {
      currencyCode = currencyOrData.currency;
    }
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(numAmount);
  } catch {
    // Fallback if currency code is invalid
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
    }).format(numAmount);
  }
};

/**
 * Get currency code from data
 */
export const getCurrencyCode = (data: CurrencyData | CurrencyData[] | null | undefined): string => {
  if (!data) return 'USD';

  // If it's an array, try to get currency from first item
  if (Array.isArray(data) && data.length > 0) {
    return getCurrencyCode(data[0]);
  }

  // Check for currency code in object
  if ('currency' in data && data.currency && typeof data.currency === 'string') {
    return data.currency;
  }

  return 'USD';
};
