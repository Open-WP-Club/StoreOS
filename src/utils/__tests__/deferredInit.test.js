import { vi } from 'vitest';
import {
  lazy,
  lazyAsync,
  whenIdle,
  afterPaint,
  createDeferredService,
  idleScheduler,
} from '../deferredInit';

describe('deferredInit utilities', () => {
  describe('lazy', () => {
    it('should not call initializer until first access', () => {
      const initializer = vi.fn(() => 'value');
      const getValue = lazy(initializer);

      expect(initializer).not.toHaveBeenCalled();

      getValue();

      expect(initializer).toHaveBeenCalledTimes(1);
    });

    it('should cache the value after first call', () => {
      const initializer = vi.fn(() => 'value');
      const getValue = lazy(initializer);

      getValue();
      getValue();
      getValue();

      expect(initializer).toHaveBeenCalledTimes(1);
    });

    it('should return the same value on subsequent calls', () => {
      const getValue = lazy(() => ({ data: 'test' }));

      const first = getValue();
      const second = getValue();

      expect(first).toBe(second);
    });

    it('should throw error when initializer returns a Promise', () => {
      const getValue = lazy(() => Promise.resolve('value'));

      expect(() => getValue()).toThrow('Use lazyAsync for async initializers');
    });

    it('should handle different value types', () => {
      const getNumber = lazy(() => 42);
      const getString = lazy(() => 'hello');
      const getObject = lazy(() => ({ key: 'value' }));
      const getArray = lazy(() => [1, 2, 3]);

      expect(getNumber()).toBe(42);
      expect(getString()).toBe('hello');
      expect(getObject()).toEqual({ key: 'value' });
      expect(getArray()).toEqual([1, 2, 3]);
    });

    it('should handle null and undefined values', () => {
      const getNull = lazy(() => null);
      const getUndefined = lazy(() => undefined);

      expect(getNull()).toBeNull();
      expect(getUndefined()).toBeUndefined();
    });
  });

  describe('lazyAsync', () => {
    it('should not call initializer until first access', async () => {
      const initializer = vi.fn(() => Promise.resolve('value'));
      const getValue = lazyAsync(initializer);

      expect(initializer).not.toHaveBeenCalled();

      await getValue();

      expect(initializer).toHaveBeenCalledTimes(1);
    });

    it('should return the same promise on subsequent calls', async () => {
      const initializer = vi.fn(() => Promise.resolve({ data: 'test' }));
      const getValue = lazyAsync(initializer);

      const promise1 = getValue();
      const promise2 = getValue();

      expect(promise1).toBe(promise2);
      expect(initializer).toHaveBeenCalledTimes(1);
    });

    it('should resolve to the correct value', async () => {
      const getValue = lazyAsync(() => Promise.resolve('async value'));

      const result = await getValue();

      expect(result).toBe('async value');
    });

    it('should cache rejected promises', async () => {
      const error = new Error('test error');
      const initializer = vi.fn(() => Promise.reject(error));
      const getValue = lazyAsync(initializer);

      await expect(getValue()).rejects.toThrow('test error');
      await expect(getValue()).rejects.toThrow('test error');

      expect(initializer).toHaveBeenCalledTimes(1);
    });
  });

  describe('whenIdle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should execute function and return result', async () => {
      const fn = vi.fn(() => 'result');

      const promise = whenIdle(fn);

      // Since we don't have requestIdleCallback in test environment,
      // it falls back to setTimeout
      vi.advanceTimersByTime(10);

      const result = await promise;

      expect(fn).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should use fallback when requestIdleCallback is not available', async () => {
      const fn = vi.fn(() => 'fallback result');

      // requestIdleCallback is not available in jsdom
      const promise = whenIdle(fn);

      vi.advanceTimersByTime(10);

      const result = await promise;

      expect(result).toBe('fallback result');
    });
  });

  describe('afterPaint', () => {
    it('should execute function after animation frames', async () => {
      const fn = vi.fn(() => 'painted');

      // Mock requestAnimationFrame
      const originalRAF = global.requestAnimationFrame;
      const callbacks = [];
      global.requestAnimationFrame = vi.fn((cb) => {
        callbacks.push(cb);
        return callbacks.length;
      });

      const promise = afterPaint(fn);

      // Execute first RAF callback
      callbacks[0]();
      // Execute second RAF callback (nested)
      callbacks[1]();

      const result = await promise;

      expect(result).toBe('painted');
      expect(fn).toHaveBeenCalledTimes(1);

      global.requestAnimationFrame = originalRAF;
    });
  });

  describe('createDeferredService', () => {
    it('should create service on first call', () => {
      const factory = vi.fn((name) => ({ name }));
      const getService = createDeferredService(factory);

      const service = getService('test');

      expect(factory).toHaveBeenCalledWith('test');
      expect(service).toEqual({ name: 'test' });
    });

    it('should cache services by arguments', () => {
      const factory = vi.fn((name) => ({ name, id: Math.random() }));
      const getService = createDeferredService(factory);

      const service1 = getService('test');
      const service2 = getService('test');
      const service3 = getService('other');

      expect(service1).toBe(service2); // Same arguments, same instance
      expect(service1).not.toBe(service3); // Different arguments, different instance
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple arguments', () => {
      const factory = vi.fn((a, b, c) => ({ a, b, c }));
      const getService = createDeferredService(factory);

      const service1 = getService(1, 2, 3);
      const service2 = getService(1, 2, 3);
      const service3 = getService(1, 2, 4);

      expect(service1).toBe(service2);
      expect(service1).not.toBe(service3);
    });

    it('should handle object arguments', () => {
      const factory = vi.fn((config) => ({ ...config }));
      const getService = createDeferredService(factory);

      const config = { url: 'http://test.com', key: 'abc' };
      const service1 = getService(config);
      const service2 = getService(config);

      expect(service1).toBe(service2);
    });
  });

  describe('IdleWorkScheduler', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should schedule work to run during idle time', () => {
      const work = vi.fn();

      idleScheduler.schedule(work);

      // Advance timers to allow idle callback
      vi.advanceTimersByTime(10);

      expect(work).toHaveBeenCalled();
    });

    it('should process multiple scheduled items in order', () => {
      const order = [];
      const work1 = vi.fn(() => order.push(1));
      const work2 = vi.fn(() => order.push(2));

      idleScheduler.schedule(work1);
      idleScheduler.schedule(work2);

      // Advance timers multiple times to process queue
      vi.advanceTimersByTime(10);
      vi.advanceTimersByTime(10);

      expect(work1).toHaveBeenCalled();
      expect(work2).toHaveBeenCalled();
      expect(order).toEqual([1, 2]);
    });
  });
});
