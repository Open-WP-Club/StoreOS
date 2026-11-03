import { describe, it, expect, beforeEach, vi } from 'vitest';
import useOffline from '../../stores/offlineStore';
import {
  interceptBatch,
  mutatePlaceholder,
  placeholdersFor,
  stripPending,
  tempIdFor,
} from '../offlinePlaceholders';
import { replayOperation } from '../offlineReplay';
import type { PendingOperationType } from '../../types';
import type WooCommerceService from '../../services/woocommerce';

const S = 'store-1';
const ops = () => useOffline.getState().pendingOperations;

function queue(type: PendingOperationType, data: Record<string, unknown>) {
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

  describe('other kinds', () => {
    it.each([
      ['category', 'create_category', 'update_category', 'delete_category', { name: 'Shoes' }],
      ['attribute', 'create_attribute', 'update_attribute', 'delete_attribute', { name: 'Color' }],
      ['tax_rate', 'create_tax_rate', 'update_tax_rate', 'delete_tax_rate', { rate: '20' }],
      [
        'term',
        'create_attribute_term',
        'update_attribute_term',
        'delete_attribute_term',
        { attributeId: 3, name: 'Red' },
      ],
      [
        'variation',
        'create_variation',
        'update_variation',
        'delete_variation',
        { productId: 5, regular_price: '9' },
      ],
    ] as const)('%s: placeholder, merge-update, cancel-on-delete', (kind, c, u, d, data) => {
      const { tempId } = queue(c, { ...data });
      const [ph] = placeholdersFor(kind, ops(), S);
      expect(ph).toMatchObject({ id: tempId, _pending: true, ...data });
      // other store / other kinds do not leak in
      expect(placeholdersFor(kind, ops(), 'store-2')).toEqual([]);

      const patch = kind === 'tax_rate' ? { rate: '25' } : { name: 'Edited', regular_price: '11' };
      expect(mutatePlaceholder(u, { ...data, id: tempId, ...patch }, S)).toEqual({
        queued: true,
        success: false,
      });
      expect(ops()).toHaveLength(1);
      expect(ops()[0]!.type).toBe(c);
      expect(ops()[0]!.data).toMatchObject({ ...data, ...patch });
      expect(ops()[0]!.data.id).toBeUndefined();

      expect(mutatePlaceholder(d, { ...data, id: tempId }, S)).toEqual({
        queued: true,
        success: false,
      });
      expect(ops()).toHaveLength(0);
    });

    it('reports an already-synced placeholder for the new kinds', () => {
      const r = mutatePlaceholder('delete_category', { id: -99 }, S);
      expect(r).toMatchObject({ queued: false, success: false });
    });

    it('tax class: slug derived from name, delete by temp id cancels the create', () => {
      const { tempId } = queue('create_tax_class', { name: 'Reduced Rate' });
      expect(placeholdersFor('tax_class', ops(), S)[0]).toMatchObject({
        slug: 'reduced-rate',
        name: 'Reduced Rate',
        id: tempId,
        _pending: true,
      });
      mutatePlaceholder('delete_tax_class', { slug: 'reduced-rate', id: tempId }, S);
      expect(ops()).toHaveLength(0);
    });

    it('a real tax class delete (no temp id) is not intercepted', () => {
      queue('create_tax_class', { name: 'Reduced Rate' });
      expect(mutatePlaceholder('delete_tax_class', { slug: 'reduced-rate' }, S)).toBeNull();
      expect(ops()).toHaveLength(1);
    });
  });

  describe('interceptBatch', () => {
    it('returns null when there are no placeholder ids or the type is not a batch', () => {
      expect(interceptBatch('batch_products', { delete: [1, 2] }, S)).toBeNull();
      expect(interceptBatch('batch_products', { update: [{ id: 1 }] }, S)).toBeNull();
      expect(interceptBatch('update_product', { id: -3 }, S)).toBeNull();
      expect(interceptBatch('batch_orders', { delete: [-3] }, S)).toBeNull();
    });

    it('delete: cancels queued creates and keeps only real ids', () => {
      const a = queue('create_product', { name: 'A' });
      const b = queue('create_product', { name: 'B' });
      const r = interceptBatch('batch_products', { delete: [7, a.tempId, 8] }, S);
      expect(r).toEqual({ data: { delete: [7, 8] } });
      expect(ops().map((o) => o.id)).toEqual([b.id]);
    });

    it('delete of only placeholders leaves nothing to send', () => {
      const a = queue('create_coupon', { code: 'A' });
      expect(interceptBatch('batch_coupons', { delete: [a.tempId] }, S)).toEqual({ data: null });
      expect(ops()).toHaveLength(0);
    });

    it('update: merges into the queued create and forwards only real updates', () => {
      const a = queue('create_product', { name: 'A', regular_price: '1' });
      const r = interceptBatch(
        'batch_products',
        {
          update: [
            { id: a.tempId, regular_price: '5' },
            { id: 7, regular_price: '6' },
          ],
        },
        S
      );
      expect(r).toEqual({ data: { update: [{ id: 7, regular_price: '6' }] } });
      expect(ops()[0]!.data).toMatchObject({ name: 'A', regular_price: '5' });
      expect(ops()[0]!.data.id).toBeUndefined();
    });

    it('mixed update + delete, other keys (create, productId) preserved', () => {
      const a = queue('create_variation', { productId: 5, sku: 'x' });
      const b = queue('create_variation', { productId: 5, sku: 'y' });
      const r = interceptBatch(
        'batch_variations',
        {
          productId: 5,
          create: [{ sku: 'n' }],
          update: [{ id: a.tempId, sku: 'x2' }],
          delete: [b.tempId],
        },
        S
      );
      expect(r).toEqual({ data: { productId: 5, create: [{ sku: 'n' }] } });
      expect(ops()).toHaveLength(1);
      expect(ops()[0]!.data.sku).toBe('x2');
    });

    it('is all-or-nothing when a placeholder has already synced', () => {
      const a = queue('create_product', { name: 'A' });
      const r = interceptBatch('batch_products', { delete: [a.tempId, -12345] }, S);
      expect(r).toMatchObject({ error: expect.stringContaining('already synced') });
      expect(ops()).toHaveLength(1); // nothing cancelled
    });
  });

  it('replay refuses any batch or child op that carries a placeholder id', async () => {
    const service = {} as unknown as WooCommerceService;
    const mk = (type: PendingOperationType, data: Record<string, unknown>) => ({
      id: 'x',
      type,
      data,
      storeId: S,
      timestamp: 1,
      retryCount: 0,
    });
    for (const op of [
      mk('batch_products', { delete: [-4] }),
      mk('batch_coupons', { update: [{ id: -4 }] }),
      mk('create_variation', { productId: -4 }),
      mk('create_attribute_term', { attributeId: -4, name: 'x' }),
    ]) {
      expect((await replayOperation(service, op)).success).toBe(false);
    }
  });
});
