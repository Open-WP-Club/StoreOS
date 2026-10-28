import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Ensure TextEncoder/TextDecoder survive jsdom environment
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

// Mock localStorage with functional storage
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key]);
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

// Mock IndexedDB
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
} as unknown as IDBFactory;

// Mock URLPattern API (Node.js 24+ / Chromium 144+)
class URLPatternMock {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;

  constructor(init?: Record<string, string>) {
    this.protocol = init?.protocol || '*';
    this.hostname = init?.hostname || '*';
    this.port = init?.port || '*';
    this.pathname = init?.pathname || '*';
    this.search = init?.search || '*';
    this.hash = init?.hash || '*';
  }

  test(input: string | URL) {
    try {
      if (typeof input === 'string') {
        new URL(input);
        return true;
      }
      return true;
    } catch {
      return false;
    }
  }

  exec(input: string | URL) {
    try {
      const url = typeof input === 'string' ? new URL(input) : input;
      return {
        inputs: [input],
        protocol: { input: url?.protocol || '', groups: {} },
        hostname: { input: url?.hostname || '', groups: {} },
        port: { input: url?.port || '', groups: {} },
        pathname: { input: url?.pathname || '', groups: {} },
        search: { input: url?.search || '', groups: {} },
        hash: { input: url?.hash || '', groups: {} },
      };
    } catch {
      return null;
    }
  }
}

(global as Record<string, unknown>).URLPattern = URLPatternMock;

// Mock window.location.reload to prevent jsdom "Not implemented: navigation" errors
Object.defineProperty(window, 'location', {
  writable: true,
  value: {
    ...window.location,
    reload: vi.fn(),
  },
});

// Suppress jsdom "Not implemented: navigation" errors from <a> tag clicks.
// These are harmless in tests - jsdom doesn't support page navigation.
// jsdom emits these via window._virtualConsole as "jsdomError" events.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = typeof args[0] === 'string' ? args[0] : args[0] instanceof Error ? args[0].message : String(args[0]);
  if (message.includes('Not implemented: navigation')) return;
  originalConsoleError.apply(console, args);
};

// Also suppress at the jsdom virtual console level
if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)._virtualConsole) {
  const vc = (window as unknown as Record<string, unknown>)._virtualConsole as { on: (event: string, handler: (error: Error) => void) => void; removeAllListeners: (event: string) => void };
  vc.removeAllListeners('jsdomError');
  vc.on('jsdomError', (error: Error) => {
    if (error.message?.includes('Not implemented: navigation')) return;
    // Re-emit other jsdom errors to console.error
    originalConsoleError(error);
  });
}
