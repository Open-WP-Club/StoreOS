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
});
