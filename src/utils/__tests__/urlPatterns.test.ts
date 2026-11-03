import { validateStoreUrl, normalizeStoreUrl } from '../urlPatterns';

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
