import { describe, it, expect, beforeEach, vi } from 'vitest';
import useOffline from '../../stores/offlineStore';
import {
  mutatePlaceholder,
  placeholdersFor,
  stripPending,
  tempIdFor,
} from '../offlinePlaceholders';
import { replayOperation } from '../offlineReplay';
import type WooCommerceService from '../../services/woocommerce';

const S = 'store-1';
const ops = () => useOffline.getState().pendingOperations;

function queue(type: 'create_product' | 'create_coupon', data: Record<string, unknown>) {
  const id = useOffline.getState().addPendingOperation(type, data, S);
  return { id, tempId: tempIdFor(id) };
}

describe('offline placeholders', () => {
  beforeEach(() => {
    useOffline.setState({ pendingOperations: [] });
  });

  it('derives pending placeholders with negative ids for the matching store only', () => {
    const p = queue('create_product', { name: 'Hat' });
    queue('create_coupon', { code: 'SAVE' });
    useOffline.getState().addPendingOperation('create_product', { name: 'Other' }, 'store-2');

    const products = placeholdersFor('product', ops(), S);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ id: p.tempId, name: 'Hat', _pending: true });
    expect(p.tempId).toBeLessThan(0);
    expect(placeholdersFor('coupon', ops(), S)[0]).toMatchObject({ code: 'SAVE', _pending: true });
  });

  it('merges an update into the queued create instead of queueing an update', () => {
    const { tempId } = queue('create_product', {
      name: 'Hat',
      meta_data: [{ key: '_storeos_client_id', value: 'c1' }],
    });
    const r = mutatePlaceholder('update_product', { id: tempId, name: 'Cap', meta_data: [] }, S);
    expect(r).toEqual({ queued: true, success: false });
    expect(ops()).toHaveLength(1);
    expect(ops()[0]!.data).toMatchObject({ name: 'Cap' });
    expect(ops()[0]!.data.id).toBeUndefined();
    expect(ops()[0]!.data.meta_data).toEqual([{ key: '_storeos_client_id', value: 'c1' }]);
    expect(placeholdersFor('product', ops(), S)[0]!.name).toBe('Cap');
  });

  it('cancels the queued create on delete (coupon)', () => {
    const { tempId } = queue('create_coupon', { code: 'SAVE' });
    expect(mutatePlaceholder('delete_coupon', { id: tempId }, S)).toEqual({
      queued: true,
      success: false,
    });
    expect(ops()).toHaveLength(0);
    expect(placeholdersFor('coupon', ops(), S)).toHaveLength(0);
  });

  it('ignores real ids and reports a placeholder whose create already synced', () => {
    queue('create_product', { name: 'Hat' });
    expect(mutatePlaceholder('update_product', { id: 42, name: 'x' }, S)).toBeNull();
    expect(mutatePlaceholder('create_product', { id: -5 }, S)).toBeNull();
    const r = mutatePlaceholder('delete_product', { id: -123 }, S);
    expect(r).toMatchObject({ queued: false, success: false });
    expect(ops()).toHaveLength(1);
  });

  it('replay: placeholder disappears when the create op is removed; temp ids never hit the API', async () => {
    const { id } = queue('create_coupon', { code: 'SAVE' });
    const service = {
      getCoupons: vi.fn().mockResolvedValue({ success: true, data: [] }),
      createCoupon: vi.fn().mockResolvedValue({ success: true, data: { id: 9 } }),
      updateCoupon: vi.fn(),
    } as unknown as WooCommerceService;
    const op = ops()[0]!;
    expect((await replayOperation(service, op)).success).toBe(true);
    expect(service.createCoupon).toHaveBeenCalledWith({ code: 'SAVE' });
    useOffline.getState().removePendingOperation(id);
    expect(placeholdersFor('coupon', ops(), S)).toHaveLength(0);

    const bad = { ...op, type: 'update_coupon' as const, data: { id: -7, code: 'x' } };
    expect((await replayOperation(service, bad)).success).toBe(false);
    expect(service.updateCoupon).not.toHaveBeenCalled();
  });

  it('discard (op removed) drops the placeholder; empty queue after restart yields none', () => {
    const { id } = queue('create_product', { name: 'Hat' });
    useOffline.getState().removePendingOperation(id);
    expect(placeholdersFor('product', ops(), S)).toEqual([]);
    // A restart rehydrates only pendingOperations; placeholders are never persisted elsewhere.
    expect(placeholdersFor('product', [], S)).toEqual([]);
  });

  it('stripPending removes placeholders before they reach a cache write', () => {
    const real = { id: 1, _pending: undefined };
    const ph = { id: -1, _pending: true };
    expect(stripPending([ph, real])).toEqual([real]);
    const same = [real];
    expect(stripPending(same)).toBe(same);
  });
});
