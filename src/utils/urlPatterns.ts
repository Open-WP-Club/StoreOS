/**
 * URL Pattern Utilities
 * Uses the native URLPattern API (Node.js 24+, Chromium 144+) for efficient URL validation
 * and parsing of WooCommerce API endpoints.
 */

// ============================================
// Types
// ============================================

export interface WooCommerceUrlInfo {
  isValid: boolean;
  baseUrl?: string;
  resource?: string;
  id?: string;
  action?: string;
}

export interface StoreUrlValidation {
  isValid: boolean;
  protocol?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  error?: string;
}

// ============================================
// URL Patterns (using native URLPattern API)
// ============================================

// Pattern for WooCommerce REST API v3 endpoints
const wooCommerceApiPattern = new URLPattern({
  pathname: '/wp-json/wc/v3/:resource{/:id}?{/:action}?',
});

// Pattern for validating store URLs (http/https with optional port)
const storeUrlPattern = new URLPattern({
  protocol: 'http{s}?',
  hostname: '*',
  port: '*',
  pathname: '*',
});

// Pattern for WooCommerce webhook URLs
const webhookPattern = new URLPattern({
  pathname: '/wc-api/:webhook_name',
});

// Pattern for WordPress admin URLs
const wpAdminPattern = new URLPattern({
  pathname: '/wp-admin{/*}?',
});

// ============================================
// Validation Functions
// ============================================

/**
 * Validates and parses a WooCommerce API URL
 * @param url - The URL to validate
 * @returns WooCommerceUrlInfo with parsed details
 */
export function parseWooCommerceApiUrl(url: string): WooCommerceUrlInfo {
  try {
    const result = wooCommerceApiPattern.exec(url);

    if (!result) {
      return { isValid: false };
    }

    const { resource, id, action } = result.pathname.groups;

    return {
      isValid: true,
      baseUrl: `${result.protocol.input}//${result.hostname.input}${result.port.input ? ':' + result.port.input : ''}`,
      resource: resource || undefined,
      id: id || undefined,
      action: action || undefined,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Validates a WooCommerce store URL
 * @param url - The store URL to validate
 * @returns StoreUrlValidation with details
 */
export function validateStoreUrl(url: string): StoreUrlValidation {
  try {
    // First check basic URL validity
    const urlObj = new URL(url);

    // Then check against our pattern
    const result = storeUrlPattern.exec(url);

    if (!result) {
      return {
        isValid: false,
        error: 'Invalid URL format. Must be http:// or https://',
      };
    }

    return {
      isValid: true,
      protocol: urlObj.protocol.replace(':', ''),
      hostname: urlObj.hostname,
      port: urlObj.port || undefined,
      pathname: urlObj.pathname,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid URL',
    };
  }
}

/**
 * Checks if a URL is a WooCommerce webhook URL
 * @param url - The URL to check
 * @returns boolean
 */
export function isWebhookUrl(url: string): boolean {
  try {
    return webhookPattern.test(url);
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is a WordPress admin URL
 * @param url - The URL to check
 * @returns boolean
 */
export function isWpAdminUrl(url: string): boolean {
  try {
    return wpAdminPattern.test(url);
  } catch {
    return false;
  }
}

/**
 * Builds a WooCommerce API URL from parts
 * @param baseUrl - The store base URL
 * @param resource - The API resource (orders, products, customers, etc.)
 * @param id - Optional resource ID
 * @param action - Optional action (e.g., 'batch')
 * @returns The constructed API URL
 */
export function buildWooCommerceApiUrl(
  baseUrl: string,
  resource: string,
  id?: string | number,
  action?: string
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  let url = `${cleanBase}/wp-json/wc/v3/${resource}`;

  if (id !== undefined) {
    url += `/${id}`;
  }

  if (action) {
    url += `/${action}`;
  }

  return url;
}

/**
 * Extracts the base URL from a full WooCommerce URL
 * @param url - The full URL
 * @returns The base URL or null if invalid
 */
export function extractBaseUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return null;
  }
}

/**
 * Normalizes a store URL by removing trailing slashes and ensuring protocol
 * @param url - The URL to normalize
 * @returns Normalized URL or null if invalid
 */
export function normalizeStoreUrl(url: string): string | null {
  try {
    // Add protocol if missing
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const validation = validateStoreUrl(normalizedUrl);
    if (!validation.isValid) {
      return null;
    }

    // Remove trailing slash
    return normalizedUrl.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

// ============================================
// Resource-specific patterns
// ============================================

const resourcePatterns = {
  orders: new URLPattern({ pathname: '/wp-json/wc/v3/orders{/:id}?' }),
  products: new URLPattern({ pathname: '/wp-json/wc/v3/products{/:id}?' }),
  customers: new URLPattern({ pathname: '/wp-json/wc/v3/customers{/:id}?' }),
  coupons: new URLPattern({ pathname: '/wp-json/wc/v3/coupons{/:id}?' }),
} as const;

/**
 * Validates a URL against a specific WooCommerce resource type
 * @param url - The URL to validate
 * @param resource - The expected resource type
 * @returns boolean
 */
export function isResourceUrl(
  url: string,
  resource: keyof typeof resourcePatterns
): boolean {
  try {
    return resourcePatterns[resource].test(url);
  } catch {
    return false;
  }
}
