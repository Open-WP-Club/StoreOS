import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useOffline from '../../stores/offlineStore';
import { tempIdFor } from '../../utils/offlinePlaceholders';
import type { PendingOperationType } from '../../types';

let online = true;
vi.mock('../useOnlineStatus', () => ({ default: () => ({ isOnline: online }) }));
vi.mock('../useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { useOfflineMutation } from '../useOfflineMutation';

const S = 'store-1';
const ops = () => useOffline.getState().pendingOperations;
const queue = (type: PendingOperationType, data: Record<string, unknown>) => {
  const id = useOffline.getState().addPendingOperation(type, data, S);
  return { id, tempId: tempIdFor(id) };
};

function setup() {
  const { result } = renderHook(() => useOfflineMutation());
  const execute = vi.fn().mockResolvedValue('ok');
  const onError = vi.fn();
  const run = async (operationType: PendingOperationType, queueData: Record<string, unknown>) => {
    let res!: Awaited<ReturnType<typeof result.current.mutate>>;
    await act(async () => {
      res = await result.current.mutate({ operationType, queueData, storeId: S, execute, onError });
    });
    return res;
  };
  return { run, execute, onError };
}

describe('useOfflineMutation with offline placeholders', () => {
  beforeEach(() => {
    online = true;
    useOffline.setState({ pendingOperations: [] });
  });

  it.each([true, false])('merges an update into the queued create (online=%s)', async (isOn) => {
    online = isOn;
    const { tempId } = queue('create_product', { name: 'Hat' });
    const { run, execute } = setup();
    const res = await run('update_product', { id: tempId, name: 'Cap' });
    expect(res).toEqual({ queued: true, success: false });
    expect(execute).not.toHaveBeenCalled();
    expect(ops()).toHaveLength(1);
    expect(ops()[0]!.type).toBe('create_product');
    expect(ops()[0]!.data).toMatchObject({ name: 'Cap' });
  });

  it('cancels the queued create on delete without calling the API', async () => {
    const { tempId } = queue('create_category', { name: 'Shoes' });
    const { run, execute } = setup();
    expect(await run('delete_category', { id: tempId })).toEqual({ queued: true, success: false });
    expect(execute).not.toHaveBeenCalled();
    expect(ops()).toHaveLength(0);
  });

  it('returns an already-synced error and reports it via onError', async () => {
    const { run, execute, onError } = setup();
    const res = await run('update_coupon', { id: -42, code: 'X' });
    expect(res).toMatchObject({ queued: false, success: false });
    expect(res.error).toMatch(/already synced/i);
    expect(onError).toHaveBeenCalledWith(res.error);
    expect(execute).not.toHaveBeenCalled();
    expect(ops()).toHaveLength(0);
  });

  it('batch online: executes with real ids only; placeholders are cancelled/merged locally', async () => {
    const a = queue('create_product', { name: 'A' });
    const b = queue('create_product', { name: 'B', regular_price: '1' });
    const { run, execute } = setup();
    await run('batch_products', { delete: [5, a.tempId] });
    expect(execute).toHaveBeenLastCalledWith({ delete: [5] });
    await run('batch_products', {
      update: [
        { id: b.tempId, regular_price: '9' },
        { id: 6, regular_price: '2' },
      ],
    });
    expect(execute).toHaveBeenLastCalledWith({ update: [{ id: 6, regular_price: '2' }] });
    expect(ops()).toHaveLength(1);
    expect(ops()[0]!.data).toMatchObject({ name: 'B', regular_price: '9' });
  });

  it('batch offline: only real ids are queued', async () => {
    online = false;
    const a = queue('create_coupon', { code: 'A' });
    const { run, execute } = setup();
    const res = await run('batch_coupons', { delete: [a.tempId, 3] });
    expect(res).toEqual({ queued: true, success: false });
    expect(execute).not.toHaveBeenCalled();
    const batch = ops().find((o) => o.type === 'batch_coupons');
    expect(batch?.data).toEqual({ delete: [3] });
    expect(ops().some((o) => o.type === 'create_coupon')).toBe(false);
  });

  it('batch of only placeholders makes no API call and queues nothing new', async () => {
    const a = queue('create_product', { name: 'A' });
    const { run, execute } = setup();
    expect(await run('batch_products', { delete: [a.tempId] })).toEqual({
      queued: true,
      success: false,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(ops()).toHaveLength(0);
  });

  it('batch with a stale placeholder fails whole and sends nothing', async () => {
    const { run, execute, onError } = setup();
    const res = await run('batch_products', { delete: [5, -777] });
    expect(res.success).toBe(false);
    expect(res.queued).toBe(false);
    expect(onError).toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(ops()).toHaveLength(0);
  });

  it('non-placeholder batches pass through untouched', async () => {
    const { run, execute } = setup();
    await run('batch_products', { delete: [1, 2] });
    expect(execute).toHaveBeenCalledWith({ delete: [1, 2] });
  });
});
