import { vi } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import DataManager from '../DataManager';
import { useStoreConfig, useCache, useSettings } from '../../stores';
import { useProgressiveLoading } from '../../hooks/useProgressiveLoading';
import WooCommerceService from '../../services/woocommerce';
import { useToast } from '../../contexts/ToastContext';

vi.mock('../../contexts/ToastContext', () => ({ useToast: vi.fn() }));
vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: Object.assign(vi.fn(), { getState: vi.fn(), setState: vi.fn() }),
  useSettings: { getState: vi.fn() },
}));
vi.mock('../../hooks/useProgressiveLoading', () => ({ useProgressiveLoading: vi.fn() }));
vi.mock('../../services/woocommerce', () => ({ default: vi.fn() }));

const HOUR = 60 * 60 * 1000;
const store = {
  id: 'store-1',
  url: 'https://t.test',
  consumerKey: 'ck_test',
  consumerSecret: 'cs_test',
};
const order = (id, modified, extra = {}) => ({
  id,
  status: 'processing',
  total: '10.00',
  date_modified_gmt: modified,
  ...extra,
});

const mockGetAllOrders = vi.fn();
const mockGetOrdersSince = vi.fn();
const mockSetCachedData = vi.fn();
const mockLoadOrdersSync = vi.fn();
const mockSaveOrdersSync = vi.fn();
const mockSetRefreshFunctions = vi.fn();
let cacheState;

async function mountAndGetRefresh() {
  render(<DataManager />);
  await waitFor(() => expect(mockSetRefreshFunctions).toHaveBeenCalled());
  return mockSetRefreshFunctions.mock.calls[0][0].refreshOrders;
}

describe('DataManager orders delta sync', () => {
  beforeEach(() => {
    cacheState = {
      cache: {
        products: { lastSync: null, data: null },
        orders: { storeId: store.id, data: [], partial: false },
      },
    };
    window.electronAPI = { showNotification: vi.fn() };
    useToast.mockReturnValue({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() });
    useStoreConfig.mockImplementation((selector) => selector({ getCurrentStore: () => store }));
    useCache.mockImplementation((selector) =>
      selector({
        getCachedData: vi.fn().mockResolvedValue([]), // truthy: skip the automatic initial load
        setCachedData: mockSetCachedData,
        setProductsLastSync: vi.fn(),
      })
    );
    useCache.getState.mockImplementation(() => ({
      ...cacheState,
      loadOrdersSync: mockLoadOrdersSync,
      saveOrdersSync: mockSaveOrdersSync,
    }));
    useCache.setState.mockImplementation(() => {});
    useSettings.getState.mockReturnValue({
      setRefreshFunctions: mockSetRefreshFunctions,
      notifyNewOrders: true,
    });
    useProgressiveLoading.mockReturnValue({
      startLoading: vi.fn(),
      updateProgress: vi.fn(),
      finishLoading: vi.fn(),
      isCancelled: () => false,
    });
    mockSetCachedData.mockImplementation(async (_type, data) => {
      cacheState.cache.orders = { storeId: store.id, data, partial: false };
    });
    mockSaveOrdersSync.mockResolvedValue(undefined);
    mockLoadOrdersSync.mockResolvedValue(null);
    mockGetAllOrders.mockResolvedValue({ success: true, data: [] });
    mockGetOrdersSince.mockResolvedValue({ success: true, data: [] });
    WooCommerceService.mockImplementation(function () {
      return { getAllOrders: mockGetAllOrders, getOrdersSince: mockGetOrdersSince };
    });
  });

  it('restores the persisted cursor: first refresh is a delta, new orders first, updated in place', async () => {
    cacheState.cache.orders.data = [
      order(1, '2026-01-01T00:00:00'),
      order(2, '2026-01-02T00:00:00'),
    ];
    mockLoadOrdersSync.mockResolvedValue({
      storeId: store.id,
      at: Date.now() - 5 * 60 * 1000,
      lastSync: '2026-01-02T00:00:00',
    });
    const updated2 = order(2, '2026-01-03T00:00:00', { status: 'completed' });
    const new3 = order(3, '2026-01-04T00:00:00');
    mockGetOrdersSince.mockResolvedValue({ success: true, data: [updated2, new3] });

    const refresh = await mountAndGetRefresh();
    await refresh();

    expect(mockLoadOrdersSync).toHaveBeenCalledWith(store.id);
    expect(mockGetOrdersSince).toHaveBeenCalledWith('2026-01-02T00:00:00', { per_page: 100 });
    expect(mockGetAllOrders).not.toHaveBeenCalled();
    const merged = mockSetCachedData.mock.calls[0][1];
    expect(merged.map((o) => o.id)).toEqual([3, 1, 2]);
    expect(merged[2].status).toBe('completed');
    expect(mockSaveOrdersSync).toHaveBeenCalledWith(
      store.id,
      expect.objectContaining({ storeId: store.id, lastSync: '2026-01-04T00:00:00' })
    );
  });

  it('does a full load and persists the cursor when nothing is persisted', async () => {
    mockGetAllOrders.mockResolvedValue({
      success: true,
      data: [order(1, '2026-01-01T00:00:00'), order(2, '2026-01-05T00:00:00')],
    });
    const refresh = await mountAndGetRefresh();
    await refresh();

    expect(mockGetOrdersSince).not.toHaveBeenCalled();
    expect(mockSaveOrdersSync).toHaveBeenCalledWith(
      store.id,
      expect.objectContaining({ lastSync: '2026-01-05T00:00:00' })
    );
  });

  it('re-syncs fully when the last full load is older than 1h', async () => {
    cacheState.cache.orders.data = [order(1, '2026-01-01T00:00:00')];
    mockLoadOrdersSync.mockResolvedValue({
      storeId: store.id,
      at: Date.now() - HOUR - 1000,
      lastSync: '2026-01-01T00:00:00',
    });
    mockGetAllOrders.mockResolvedValue({ success: true, data: [order(1, '2026-01-01T00:00:00')] });

    const refresh = await mountAndGetRefresh();
    await refresh();

    expect(mockGetOrdersSince).not.toHaveBeenCalled();
    expect(mockGetAllOrders).toHaveBeenCalled();
    expect(mockSaveOrdersSync.mock.calls[0][1].at).toBeGreaterThan(Date.now() - 60 * 1000);
  });

  it('does a full load when cached orders belong to a different store', async () => {
    cacheState.cache.orders = { storeId: 'other', data: [order(1, 'x')], partial: false };
    mockLoadOrdersSync.mockResolvedValue({ storeId: store.id, at: Date.now(), lastSync: 'x' });

    const refresh = await mountAndGetRefresh();
    await refresh();

    expect(mockGetOrdersSince).not.toHaveBeenCalled();
    expect(mockGetAllOrders).toHaveBeenCalled();
  });

  it.each([
    ['an unsuccessful result', () => mockGetOrdersSince.mockResolvedValue({ success: false })],
    ['a thrown error', () => mockGetOrdersSince.mockRejectedValue(new Error('boom'))],
  ])('falls back to a full fetch on %s', async (_label, arrange) => {
    cacheState.cache.orders.data = [order(1, '2026-01-01T00:00:00')];
    mockLoadOrdersSync.mockResolvedValue({
      storeId: store.id,
      at: Date.now(),
      lastSync: '2026-01-01T00:00:00',
    });
    arrange();

    const refresh = await mountAndGetRefresh();
    await refresh();

    expect(mockGetOrdersSince).toHaveBeenCalled();
    expect(mockGetAllOrders).toHaveBeenCalled();
  });

  it('sends a new-order notification from the delta path', async () => {
    mockGetAllOrders.mockResolvedValue({ success: true, data: [order(1, '2026-01-01T00:00:00')] });
    const refresh = await mountAndGetRefresh();
    await refresh(); // full load seeds the known ids and the in-memory cursor
    expect(window.electronAPI.showNotification).not.toHaveBeenCalled();

    mockGetOrdersSince.mockResolvedValue({
      success: true,
      data: [order(9, '2026-01-02T00:00:00', { billing: { first_name: 'Ann', last_name: 'Lee' } })],
    });
    await refresh();

    expect(mockGetAllOrders).toHaveBeenCalledTimes(1);
    expect(window.electronAPI.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Order', body: expect.stringContaining('#9') })
    );
  });
});
