/**
 * Deferred Initialization Utility
 *
 * Provides lazy loading patterns for heavy modules and services.
 * Helps improve startup performance by deferring non-critical initialization.
 */

type InitializerFn<T> = () => T | Promise<T>;

/**
 * Creates a lazily initialized value that's only computed on first access.
 * Uses a simple cache pattern for synchronous initialization.
 */
export function lazy<T>(initializer: InitializerFn<T>): () => T {
  let value: T | undefined;
  let initialized = false;

  return () => {
    if (!initialized) {
      const result = initializer();
      if (result instanceof Promise) {
        throw new Error('Use lazyAsync for async initializers');
      }
      value = result;
      initialized = true;
    }
    return value as T;
  };
}

/**
 * Creates a lazily initialized async value.
 * Caches the promise to prevent multiple initializations.
 */
export function lazyAsync<T>(initializer: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;

  return () => {
    if (!promise) {
      promise = initializer();
    }
    return promise;
  };
}

/**
 * Defers execution until the browser is idle.
 * Falls back to setTimeout if requestIdleCallback is not available.
 */
export function whenIdle<T>(fn: () => T, timeout = 2000): Promise<T> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
        .requestIdleCallback(
          () => resolve(fn()),
          { timeout }
        );
    } else {
      setTimeout(() => resolve(fn()), 1);
    }
  });
}

/**
 * Defers execution until after the next animation frame.
 * Useful for non-critical UI updates.
 */
export function afterPaint<T>(fn: () => T): Promise<T> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve(fn());
      });
    });
  });
}

/**
 * Preloads a module in the background without blocking.
 * Returns a promise that resolves when the module is loaded.
 */
export function preloadModule(moduleImport: () => Promise<unknown>): Promise<void> {
  return whenIdle(() => {
    moduleImport().catch(() => {
      // Silently handle preload failures
    });
  }).then(() => undefined);
}

/**
 * Creates a service that's initialized on first use.
 * Useful for API services that might not be needed immediately.
 */
export function createDeferredService<T, Args extends unknown[]>(
  factory: (...args: Args) => T
): (...args: Args) => T {
  const cache = new Map<string, T>();

  return (...args: Args) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) {
      cache.set(key, factory(...args));
    }
    return cache.get(key) as T;
  };
}

/**
 * Schedules non-critical work to run during idle periods.
 * Tasks are processed in order, one per idle callback.
 */
class IdleWorkScheduler {
  private queue: Array<() => void> = [];
  private isProcessing = false;

  schedule(work: () => void): void {
    this.queue.push(work);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    const processNext = (): void => {
      const work = this.queue.shift();
      if (work) {
        whenIdle(() => {
          work();
          if (this.queue.length > 0) {
            processNext();
          } else {
            this.isProcessing = false;
          }
        });
      } else {
        this.isProcessing = false;
      }
    };

    processNext();
  }
}

export const idleScheduler = new IdleWorkScheduler();

export default {
  lazy,
  lazyAsync,
  whenIdle,
  afterPaint,
  preloadModule,
  createDeferredService,
  idleScheduler,
};
