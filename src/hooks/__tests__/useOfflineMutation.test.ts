import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const addPendingOperation = vi.fn();
const showToast = vi.fn();
let online = true;

vi.mock('../../stores/offlineStore', () => ({
  default: (selector: (s: unknown) => unknown) => selector({ addPendingOperation }),
}));
vi.mock('../useOnlineStatus', () => ({ default: () => ({ isOnline: online }) }));
vi.mock('../useToast', () => ({ useToast: () => ({ showToast }) }));

import { useOfflineMutation } from '../useOfflineMutation';
import useCache from '../../stores/cacheStore';
import useStoreConfig from '../../stores/storeConfigStore';

const base = {
  operationType: 'updateOrderStatus' as never,
  queueData: { id: 1 },
  storeId: 's1',
};

describe('useOfflineMutation', () => {
  beforeEach(() => {
    online = true;
  });

  it('executes and calls onSuccess when online', async () => {
    const execute = vi.fn().mockResolvedValue('ok');
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useOfflineMutation());
    let res;
    await act(async () => {
      res = await result.current.mutate({ ...base, execute, onSuccess });
    });
    expect(res).toEqual({ queued: false, success: true });
    expect(onSuccess).toHaveBeenCalledWith('ok');
    expect(addPendingOperation).not.toHaveBeenCalled();
  });

  it('reports error message when execute throws', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useOfflineMutation());
    let res;
    await act(async () => {
      res = await result.current.mutate({
        ...base,
        execute: () => Promise.reject(new Error('nope')),
        onError,
      });
    });
    expect(res).toEqual({ queued: false, success: false, error: 'nope' });
    expect(onError).toHaveBeenCalledWith('nope');
  });

  it('uses a generic message for non-Error rejections', async () => {
    const { result } = renderHook(() => useOfflineMutation());
    let res;
    await act(async () => {
      res = await result.current.mutate({ ...base, execute: () => Promise.reject('str') });
    });
    expect(res).toEqual({ queued: false, success: false, error: 'Operation failed' });
  });

  it('queues and toasts instead of executing when offline', async () => {
    online = false;
    const execute = vi.fn();
    const { result } = renderHook(() => useOfflineMutation());
    let res;
    await act(async () => {
      res = await result.current.mutate({ ...base, execute });
    });
    expect(res).toEqual({ queued: true, success: false });
    expect(execute).not.toHaveBeenCalled();
    expect(addPendingOperation).toHaveBeenCalledWith('updateOrderStatus', { id: 1 }, 's1');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('offline'), 'warning');
  });

  it('offline update of a cached item queues a base snapshot', async () => {
    online = false;
    const c = useCache.getState().cache;
    useStoreConfig.setState({ currentStoreId: 's1' } as never);
    useCache.setState({
      cache: {
        ...c,
        orders: {
          ...c.orders,
          data: [{ id: 7, status: 'processing', date_modified_gmt: '2024-01-01T10:00:00' }],
        },
      },
    } as never);
    const { result } = renderHook(() => useOfflineMutation());
    await act(async () => {
      await result.current.mutate({
        operationType: 'update_order',
        queueData: { id: 7, status: 'completed' },
        storeId: 's1',
        execute: vi.fn(),
      });
    });
    expect(addPendingOperation).toHaveBeenCalledWith(
      'update_order',
      { id: 7, status: 'completed' },
      's1',
      { modified: '2024-01-01T10:00:00', prev: { status: 'processing' } }
    );
  });

  it('offline create_product/create_variation get a client id meta; others do not', async () => {
    online = false;
    const { result } = renderHook(() => useOfflineMutation());
    await act(async () => {
      await result.current.mutate({
        ...base,
        operationType: 'create_product',
        queueData: { name: 'x' },
        execute: vi.fn(),
      });
      await result.current.mutate({
        ...base,
        operationType: 'create_category',
        queueData: { name: 'x' },
        execute: vi.fn(),
      });
    });
    const [productCall, categoryCall] = addPendingOperation.mock.calls;
    expect(productCall![1].meta_data[0]).toMatchObject({ key: '_storeos_client_id' });
    expect(categoryCall![1]).toEqual({ name: 'x' });
  });

  it('mutateApi queues offline and throws on failed ApiResponse online', async () => {
    const { result } = renderHook(() => useOfflineMutation());
    const onError = vi.fn();
    let res;
    await act(async () => {
      res = await result.current.mutateApi(
        'delete_review',
        { id: 1 },
        's1',
        async () => ({ success: false, error: 'boom' }),
        onError
      );
    });
    expect(res).toEqual({ queued: false, success: false, error: 'boom' });
    expect(onError).toHaveBeenCalledWith('boom');
    online = false;
    const { result: r2 } = renderHook(() => useOfflineMutation());
    await act(async () => {
      res = await r2.current.mutateApi('delete_review', { id: 1 }, 's1', vi.fn());
    });
    expect(res).toEqual({ queued: true, success: false });
  });
});
