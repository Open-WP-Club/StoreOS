/**
 * URL Pattern Utilities
 * Uses the native URLPattern API (Node.js 24+, Chromium 144+) for efficient URL validation
 * and parsing of WooCommerce API endpoints.
 */

// ============================================
// Types
// ============================================

interface StoreUrlValidation {
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

// Pattern for validating store URLs (http/https with optional port)
const storeUrlPattern = new URLPattern({
  protocol: 'http{s}?',
  hostname: '*',
  port: '*',
  pathname: '*',
});

// ============================================
// Validation Functions
// ============================================

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
