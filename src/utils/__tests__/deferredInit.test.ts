import { describe, it, expect, vi, afterEach } from 'vitest';
import deferred, {
  lazy,
  lazyAsync,
  whenIdle,
  afterPaint,
  preloadModule,
  createDeferredService,
  idleScheduler,
} from '../deferredInit';

describe('deferredInit', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).requestIdleCallback;
  });

  it('lazy computes once and caches', () => {
    const init = vi.fn(() => 42);
    const get = lazy(init);
    expect(init).not.toHaveBeenCalled();
    expect(get()).toBe(42);
    expect(get()).toBe(42);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('lazy throws for async initializers', () => {
    const get = lazy(() => Promise.resolve(1));
    expect(() => get()).toThrow('Use lazyAsync');
  });

  it('lazyAsync caches the promise', async () => {
    const init = vi.fn(async () => 'x');
    const get = lazyAsync(init);
    expect(await get()).toBe('x');
    expect(await get()).toBe('x');
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('whenIdle uses requestIdleCallback when available', async () => {
    const ric = vi.fn((cb: () => void) => cb());
    (window as unknown as Record<string, unknown>).requestIdleCallback = ric;
    await expect(whenIdle(() => 'ok', 500)).resolves.toBe('ok');
    expect(ric).toHaveBeenCalledWith(expect.any(Function), { timeout: 500 });
  });

  it('whenIdle falls back to setTimeout', async () => {
    vi.useFakeTimers();
    const p = whenIdle(() => 'late');
    await vi.advanceTimersByTimeAsync(5);
    await expect(p).resolves.toBe('late');
  });

  it('afterPaint resolves after two animation frames', async () => {
    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', raf);
    await expect(afterPaint(() => 7)).resolves.toBe(7);
    expect(raf).toHaveBeenCalledTimes(2);
  });

  it('preloadModule invokes the import and swallows failures', async () => {
    const ok = vi.fn(() => Promise.resolve({}));
    await expect(preloadModule(ok)).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalled();
    await expect(preloadModule(() => Promise.reject(new Error('x')))).resolves.toBeUndefined();
  });

  it('createDeferredService memoizes by args', () => {
    const factory = vi.fn((a: number, b: number) => ({ sum: a + b }));
    const svc = createDeferredService(factory);
    expect(svc(1, 2)).toBe(svc(1, 2));
    expect(svc(2, 2)).not.toBe(svc(1, 2));
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('idleScheduler runs queued work in order', async () => {
    vi.useFakeTimers();
    const order: number[] = [];
    idleScheduler.schedule(() => order.push(1));
    idleScheduler.schedule(() => order.push(2));
    await vi.advanceTimersByTimeAsync(50);
    expect(order).toEqual([1, 2]);
  });

  it('default export exposes helpers', () => {
    expect(deferred.lazy).toBe(lazy);
    expect(deferred.idleScheduler).toBe(idleScheduler);
  });
});
