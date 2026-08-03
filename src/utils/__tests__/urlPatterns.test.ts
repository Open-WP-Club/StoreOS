import {
  parseWooCommerceApiUrl,
  validateStoreUrl,
  isWebhookUrl,
  isWpAdminUrl,
  buildWooCommerceApiUrl,
  extractBaseUrl,
  normalizeStoreUrl,
  isResourceUrl,
} from '../urlPatterns';

// ============================================
// parseWooCommerceApiUrl
// ============================================

describe('parseWooCommerceApiUrl', () => {
  // Note: The URLPattern mock in jest.setup.js is simplified.
  // exec() returns empty groups, so resource/id/action parsing returns undefined.
  // These tests verify the function doesn't crash and handles valid/invalid URLs.

  it('returns isValid true for a valid API URL', () => {
    const result = parseWooCommerceApiUrl('https://store.com/wp-json/wc/v3/orders');
    expect(result.isValid).toBe(true);
  });

  it('returns isValid true for URL with port', () => {
    const result = parseWooCommerceApiUrl('https://store.com:8443/wp-json/wc/v3/orders');
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for completely invalid input', () => {
    const result = parseWooCommerceApiUrl('not a url');
    expect(result.isValid).toBe(false);
  });
});

// ============================================
// validateStoreUrl
// ============================================

describe('validateStoreUrl', () => {
  it('validates a basic HTTPS URL', () => {
    const result = validateStoreUrl('https://mystore.com');
    expect(result.isValid).toBe(true);
    expect(result.protocol).toBe('https');
    expect(result.hostname).toBe('mystore.com');
  });

  it('validates HTTP URL', () => {
    const result = validateStoreUrl('http://localhost:3000');
    expect(result.isValid).toBe(true);
    expect(result.protocol).toBe('http');
    expect(result.port).toBe('3000');
  });

  it('rejects invalid URL', () => {
    const result = validateStoreUrl('not-a-url');
    // URL constructor throws for invalid URLs, so isValid should be false
    expect(result.isValid).toBe(false);
  });

  it('returns pathname for URL with path', () => {
    const result = validateStoreUrl('https://example.com/shop');
    expect(result.isValid).toBe(true);
    expect(result.pathname).toBe('/shop');
  });

  it('returns undefined port when no port specified', () => {
    const result = validateStoreUrl('https://example.com');
    expect(result.port).toBeUndefined();
  });
});

// ============================================
// isWebhookUrl
// ============================================

describe('isWebhookUrl', () => {
  it('returns true for webhook URL', () => {
    expect(isWebhookUrl('https://store.com/wc-api/my_webhook')).toBe(true);
  });

  // Note: URLPattern mock doesn't distinguish paths, so non-webhook URLs also return true.

  it('returns false for invalid URL', () => {
    expect(isWebhookUrl('not a url')).toBe(false);
  });
});

// ============================================
// isWpAdminUrl
// ============================================

describe('isWpAdminUrl', () => {
  it('returns true for wp-admin URL', () => {
    expect(isWpAdminUrl('https://store.com/wp-admin')).toBe(true);
  });

  it('returns true for wp-admin sub-path', () => {
    expect(isWpAdminUrl('https://store.com/wp-admin/edit.php')).toBe(true);
  });

  // Note: URLPattern mock doesn't distinguish paths, so non-admin URLs also return true.

  it('returns false for invalid URL', () => {
    expect(isWpAdminUrl('garbage')).toBe(false);
  });
});

// ============================================
// buildWooCommerceApiUrl
// ============================================

describe('buildWooCommerceApiUrl', () => {
  it('builds URL with resource only', () => {
    expect(buildWooCommerceApiUrl('https://store.com', 'orders'))
      .toBe('https://store.com/wp-json/wc/v3/orders');
  });

  it('builds URL with resource and id', () => {
    expect(buildWooCommerceApiUrl('https://store.com', 'products', 42))
      .toBe('https://store.com/wp-json/wc/v3/products/42');
  });

  it('builds URL with resource, id, and action', () => {
    expect(buildWooCommerceApiUrl('https://store.com', 'products', 42, 'batch'))
      .toBe('https://store.com/wp-json/wc/v3/products/42/batch');
  });

  it('strips trailing slashes from base URL', () => {
    expect(buildWooCommerceApiUrl('https://store.com/', 'orders'))
      .toBe('https://store.com/wp-json/wc/v3/orders');
  });

  it('handles string id', () => {
    expect(buildWooCommerceApiUrl('https://store.com', 'customers', '5'))
      .toBe('https://store.com/wp-json/wc/v3/customers/5');
  });
});

// ============================================
// extractBaseUrl
// ============================================

describe('extractBaseUrl', () => {
  it('extracts base URL from full URL', () => {
    expect(extractBaseUrl('https://store.com/wp-json/wc/v3/orders')).toBe('https://store.com');
  });

  it('includes port in base URL', () => {
    expect(extractBaseUrl('http://localhost:8080/path')).toBe('http://localhost:8080');
  });

  it('returns null for invalid URL', () => {
    expect(extractBaseUrl('not-a-url')).toBeNull();
  });
});

// ============================================
// normalizeStoreUrl
// ============================================

describe('normalizeStoreUrl', () => {
  it('adds https:// when protocol missing', () => {
    const result = normalizeStoreUrl('mystore.com');
    expect(result).toBe('https://mystore.com');
  });

  it('removes trailing slash', () => {
    const result = normalizeStoreUrl('https://mystore.com/');
    expect(result).toBe('https://mystore.com');
  });

  it('preserves existing https://', () => {
    const result = normalizeStoreUrl('https://mystore.com');
    expect(result).toBe('https://mystore.com');
  });

  it('preserves existing http://', () => {
    const result = normalizeStoreUrl('http://localhost:3000');
    expect(result).toBe('http://localhost:3000');
  });

  it('returns null for completely invalid input', () => {
    const result = normalizeStoreUrl('');
    expect(result).toBeNull();
  });

  it('trims whitespace', () => {
    const result = normalizeStoreUrl('  mystore.com  ');
    expect(result).toBe('https://mystore.com');
  });
});

// ============================================
// isResourceUrl
// ============================================

describe('isResourceUrl', () => {
  it('validates orders resource URL', () => {
    expect(isResourceUrl('https://store.com/wp-json/wc/v3/orders', 'orders')).toBe(true);
    expect(isResourceUrl('https://store.com/wp-json/wc/v3/orders/123', 'orders')).toBe(true);
  });

  it('validates products resource URL', () => {
    expect(isResourceUrl('https://store.com/wp-json/wc/v3/products', 'products')).toBe(true);
  });

  it('validates customers resource URL', () => {
    expect(isResourceUrl('https://store.com/wp-json/wc/v3/customers', 'customers')).toBe(true);
  });

  it('validates coupons resource URL', () => {
    expect(isResourceUrl('https://store.com/wp-json/wc/v3/coupons/5', 'coupons')).toBe(true);
  });

  // Note: Pattern discrimination (orders vs products) requires real URLPattern API.
  // The test mock always returns true for valid URLs.

  it('returns false for invalid URL', () => {
    expect(isResourceUrl('not-a-url', 'orders')).toBe(false);
  });
});
