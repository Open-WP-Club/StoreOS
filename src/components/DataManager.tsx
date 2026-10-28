import { useEffect, useRef, useCallback } from 'react';
import { useStoreConfig, useCache, useSettings } from '../stores';
import useNotifications from '../stores/notificationStore';
import { useToast } from '../contexts/ToastContext';
import WooCommerceService from '../services/woocommerce';
import { TIME } from '../constants/config';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { playNotificationSound } from '../utils/notificationSound';
import { isInvalidCredentials, loadFailureMessage, openSetupAction } from '../utils/loadErrors';
import type { WooCommerceOrder, WooCommerceProduct, BatchLoadProgress } from '../types';
import type { OrdersSync } from '../stores/cache/types';
import type { NotificationType } from '../stores/notificationStore';

import type { OrderCelebrationData } from '../stores/notificationStore';

function sendNotification(
  type: NotificationType,
  title: string,
  body: string,
  route?: string,
  storeId?: string,
  celebrationData?: OrderCelebrationData
): void {
  // Native Electron notification
  window.electronAPI?.showNotification({ title, body, route });

  // Store in notification center
  const { addNotification, soundEnabled, confettiEnabled, triggerCelebration } =
    useNotifications.getState();
  addNotification({ type, title, body, route, storeId });

  // Play sound if enabled
  if (soundEnabled) {
    playNotificationSound();
  }

  // Trigger celebration overlay for new orders
  if (type === 'new_order' && confettiEnabled && celebrationData) {
    triggerCelebration(celebrationData);
  }
}

interface LoadingRefState {
  orders: boolean;
  products: boolean;
}

interface LastFetchRefState {
  orders: number | null;
  products: number | null;
}

/** Notify about orders not seen in the previous load (new orders, failed payments). */
function detectNewOrders(
  orders: WooCommerceOrder[],
  knownRef: { current: Set<number> | null },
  storeId: string
): void {
  // Detect new orders for notifications
  const { notifyNewOrders } = useSettings.getState();
  if (notifyNewOrders) {
    const currentIds = new Set(orders.map((o) => o.id));
    if (knownRef.current !== null) {
      const newOrders = orders.filter((o) => !knownRef.current!.has(o.id));
      if (newOrders.length > 0) {
        const first = newOrders[0]!;
        const notifBody =
          newOrders.length === 1
            ? `Order #${first.id} — ${first.billing?.first_name || ''} ${first.billing?.last_name || ''}`
            : `${newOrders.length} new orders received`;
        const customerName =
          newOrders.length === 1
            ? `${first.billing?.first_name || ''} ${first.billing?.last_name || ''}`.trim() ||
              undefined
            : undefined;
        sendNotification('new_order', 'New Order', notifBody, '/orders', storeId, {
          orderCount: newOrders.length,
          orderId: newOrders.length === 1 ? first.id : undefined,
          orderTotal: newOrders.length === 1 ? first.total : undefined,
          customerName,
        });

        // Also detect failed payments
        const failedOrders = newOrders.filter((o) => o.status === 'failed');
        if (failedOrders.length > 0) {
          const failedBody =
            failedOrders.length === 1
              ? `Order #${failedOrders[0]!.id} payment failed`
              : `${failedOrders.length} orders with failed payments`;
          sendNotification('failed_payment', 'Failed Payment', failedBody, '/orders', storeId);
        }
      }
    }
    knownRef.current = currentIds;
  }
}

/** Newest modified date among the orders (ISO), used as the next delta-sync cursor. */
function latestModified(orders: WooCommerceOrder[], fallback: string | null = null): string | null {
  return orders.reduce<string | null>((latest, o) => {
    const d = o.date_modified_gmt;
    return d && (!latest || d > latest) ? d : latest;
  }, fallback);
}

// DataManager renders outside <Router>, so navigate via the hash (App uses HashRouter).
const goTo = (to: string): void => {
  window.location.hash = to;
};

function showLoadFailure(
  toast: ReturnType<typeof useToast>,
  what: string,
  result: { code?: string }
): void {
  const message = loadFailureMessage(what, result);
  if (isInvalidCredentials(result)) toast.error(message, undefined, openSetupAction(goTo));
  else toast.error(message);
}

/**
 * DataManager - Centralized data fetching component
 *
 * This component lives at the App level and never unmounts.
 * It manages all data fetching globally, so navigation between pages
 * doesn't interrupt or restart data loading.
 */
function DataManager(): null {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const getCachedData = useCache((state) => state.getCachedData);
  const setCachedData = useCache((state) => state.setCachedData);
  const setProductsLastSync = useCache((state) => state.setProductsLastSync);
  const currentStore = getCurrentStore();
  const toast = useToast();

  const { startLoading, updateProgress, finishLoading, isCancelled } = useProgressiveLoading();

  const loadingRef = useRef<LoadingRefState>({
    orders: false,
    products: false,
  });

  const lastFetchRef = useRef<LastFetchRefState>({
    orders: null,
    products: null,
  });

  // Orders delta sync state (in-memory): when the last full load ran and the newest modified date
  const ordersSyncRef = useRef<OrdersSync>({
    storeId: '',
    at: 0,
    lastSync: null,
  });

  // Track known order IDs for new-order detection
  const knownOrderIdsRef = useRef<Set<number> | null>(null);

  const loadOrders = useCallback(
    async (force: boolean = false): Promise<void> => {
      if (!currentStore || (!force && loadingRef.current.orders)) return;

      loadingRef.current.orders = true;
      lastFetchRef.current.orders = Date.now();

      try {
        const service = new WooCommerceService(currentStore);
        const loadingSettings = currentStore.loadingSettings || {
          batchSize: 50,
          batchDelay: 500,
        };

        startLoading('orders', 0);

        // Delta sync: after a full load, only fetch orders modified since (full re-sync hourly,
        // because delta cannot see deletions)
        const cached = useCache.getState().cache.orders;
        const cachedData = cached?.data;
        // Restore the persisted cursor after a restart or store switch
        if (ordersSyncRef.current.storeId !== currentStore.id) {
          const { loadOrdersSync } = useCache.getState();
          ordersSyncRef.current = (await loadOrdersSync(currentStore.id)) ?? {
            storeId: currentStore.id,
            at: 0,
            lastSync: null,
          };
        }
        const { at, lastSync } = ordersSyncRef.current;
        if (
          lastSync &&
          Date.now() - at < TIME.HOUR &&
          cached?.storeId === currentStore.id &&
          !cached.partial &&
          cachedData && cachedData.length > 0
        ) {
          try {
            const delta = await service.getOrdersSince(lastSync, { per_page: 100 });
            if (delta.success) {
              if (delta.data.length > 0) {
                const known = new Set(cachedData.map((o) => o.id));
                const updated = new Map(delta.data.map((o) => [o.id, o]));
                const merged = [
                  ...delta.data.filter((o) => !known.has(o.id)),
                  ...cachedData.map((o) => updated.get(o.id) ?? o),
                ];
                await setCachedData('orders', merged);
                detectNewOrders(merged, knownOrderIdsRef, currentStore.id);
                ordersSyncRef.current = {
                  storeId: currentStore.id,
                  at,
                  lastSync: latestModified(delta.data, lastSync),
                };
                await useCache.getState().saveOrdersSync(currentStore.id, ordersSyncRef.current);
              }
              return;
            }
          } catch {
            // Delta sync failed, fall through to the full fetch
          }
        }

        const result = await service.getAllOrders(
          { per_page: loadingSettings.batchSize },
          (progressInfo: BatchLoadProgress<WooCommerceOrder>) => {
            if (isCancelled()) return;

            // Split by status: active orders need frequent updates, final orders don't
            const FINAL_STATUSES = ['completed', 'cancelled', 'refunded', 'failed', 'trash'];
            const activeOrders: WooCommerceOrder[] = [];
            const finalOrders: WooCommerceOrder[] = [];

            for (const order of progressInfo.allData as WooCommerceOrder[]) {
              if (FINAL_STATUSES.includes(order.status)) {
                finalOrders.push(order);
              } else {
                activeOrders.push(order);
              }
            }

            useCache.setState((state) => ({
              cache: {
                ...state.cache,
                orders: {
                  storeId: currentStore.id,
                  data: progressInfo.allData as WooCommerceOrder[],
                  timestamp: Date.now(),
                  partial: progressInfo.currentPage < progressInfo.totalPages,
                },
                ordersRecent: {
                  storeId: currentStore.id,
                  data: activeOrders,
                  timestamp: Date.now(),
                },
                ordersOld: {
                  storeId: currentStore.id,
                  data: finalOrders,
                  timestamp: Date.now(),
                },
              },
            }));

            updateProgress(
              progressInfo.allData.length,
              progressInfo.totalItems || progressInfo.allData.length
            );
          },
          {
            batchDelay: loadingSettings.batchDelay,
            cancelCheck: isCancelled,
          }
        );

        if (!result.success) {
          showLoadFailure(toast, 'orders', result);
        } else if (!('cancelled' in result && result.cancelled)) {
          await setCachedData('orders', result.data);

          detectNewOrders(result.data as WooCommerceOrder[], knownOrderIdsRef, currentStore.id);
          ordersSyncRef.current = {
            storeId: currentStore.id,
            at: Date.now(),
            lastSync: latestModified(result.data as WooCommerceOrder[]),
          };
          await useCache.getState().saveOrdersSync(currentStore.id, ordersSyncRef.current);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to load orders. Please try again. (${message})`);
      } finally {
        loadingRef.current.orders = false;
        finishLoading();
      }
    },
    [currentStore, setCachedData, startLoading, updateProgress, finishLoading, isCancelled, toast]
  );

  const loadProducts = useCallback(
    async (force: boolean = false): Promise<void> => {
      if (!currentStore || (!force && loadingRef.current.products)) return;

      loadingRef.current.products = true;
      lastFetchRef.current.products = Date.now();

      try {
        const service = new WooCommerceService(currentStore);
        const loadingSettings = currentStore.loadingSettings || {
          batchSize: 50,
          batchDelay: 500,
        };

        const cachedState = useCache.getState().cache.products;
        if (cachedState?.lastSync) {
          try {
            const deltaResult = await service.getProductsSince(cachedState.lastSync, {
              per_page: 100,
            });

            if (deltaResult.success && deltaResult.data.length > 0) {
              const cachedData = cachedState.data || [];
              const merged = [...cachedData];
              deltaResult.data.forEach((updatedProduct) => {
                const index = merged.findIndex((p) => p.id === updatedProduct.id);
                if (index !== -1) {
                  merged[index] = updatedProduct;
                } else {
                  merged.push(updatedProduct);
                }
              });

              const latestModified = deltaResult.data.reduce((latest, product) => {
                const productDate = product.date_modified_gmt || product.date_modified;
                return productDate > latest ? productDate : latest;
              }, cachedState.lastSync);

              // setCachedData now handles split caching automatically
              await setCachedData('products', merged);
              // Persist lastSync to IndexedDB for cross-session recovery
              await setProductsLastSync(latestModified);

              loadingRef.current.products = false;
              return;
            }
          } catch {
            // Delta sync failed, continue with full fetch
          }
        }

        startLoading('products', 0);

        const result = await service.getAllProducts(
          { per_page: loadingSettings.batchSize },
          (progressInfo: BatchLoadProgress<WooCommerceProduct>) => {
            if (isCancelled()) return;

            useCache.setState((state) => ({
              cache: {
                ...state.cache,
                products: {
                  storeId: currentStore.id,
                  data: progressInfo.allData as WooCommerceProduct[],
                  timestamp: Date.now(),
                  lastSync: state.cache.products?.lastSync ?? null,
                },
              },
            }));

            updateProgress(
              progressInfo.allData.length,
              progressInfo.totalItems || progressInfo.allData.length
            );
          },
          {
            batchDelay: loadingSettings.batchDelay,
            cancelCheck: isCancelled,
          }
        );

        if (!result.success) {
          showLoadFailure(toast, 'products', result);
        } else if (!('cancelled' in result && result.cancelled)) {
          const latestModified = result.data.reduce<string | null>((latest, product) => {
            const productDate = product.date_modified_gmt || product.date_modified;
            return !latest || productDate > latest ? productDate : latest;
          }, null);

          // setCachedData now handles split caching automatically
          await setCachedData('products', result.data);
          // Persist lastSync to IndexedDB for cross-session recovery
          if (latestModified) {
            await setProductsLastSync(latestModified);
          }

          // Check for low stock items
          const { notifyLowStock, lowStockThreshold } = useSettings.getState();
          if (notifyLowStock) {
            const lowStockItems = (result.data as WooCommerceProduct[]).filter(
              (p) =>
                p.manage_stock &&
                p.stock_quantity !== null &&
                p.stock_quantity <= lowStockThreshold &&
                p.stock_quantity > 0
            );
            if (lowStockItems.length > 0) {
              const firstItem = lowStockItems[0]!;
              const stockBody =
                lowStockItems.length === 1
                  ? `${firstItem.name} has only ${firstItem.stock_quantity} left`
                  : `${lowStockItems.length} products are running low on stock`;
              sendNotification(
                'low_stock',
                'Low Stock Alert',
                stockBody,
                '/inventory',
                currentStore.id
              );
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to load products. Please try again. (${message})`);
      } finally {
        loadingRef.current.products = false;
        finishLoading();
      }
    },
    [
      currentStore,
      setCachedData,
      setProductsLastSync,
      startLoading,
      updateProgress,
      finishLoading,
      isCancelled,
      toast,
    ]
  );

  const loadAllData = useCallback(async (): Promise<void> => {
    if (!currentStore) return;

    const cachedOrders = await getCachedData('orders');
    const cachedProducts = await getCachedData('products');

    if (!cachedOrders && !loadingRef.current.orders) {
      loadOrders();
    }

    if (!cachedProducts && !loadingRef.current.products) {
      loadProducts();
    }
  }, [currentStore, getCachedData, loadOrders, loadProducts]);

  const refreshStaleData = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000;

    if (
      lastFetchRef.current.orders &&
      now - lastFetchRef.current.orders > staleThreshold &&
      !loadingRef.current.orders
    ) {
      loadOrders();
    }

    if (
      lastFetchRef.current.products &&
      now - lastFetchRef.current.products > staleThreshold &&
      !loadingRef.current.products
    ) {
      loadProducts();
    }
  }, [loadOrders, loadProducts]);

  // Use refs to store the latest load functions to avoid infinite loops
  const loadOrdersRef = useRef(loadOrders);
  const loadProductsRef = useRef(loadProducts);
  const loadAllDataRef = useRef(loadAllData);
  const refreshStaleDataRef = useRef(refreshStaleData);

  // Keep refs up to date. Refs can't be written during render, so this runs
  // as an effect after every commit instead.
  useEffect(() => {
    loadOrdersRef.current = loadOrders;
    loadProductsRef.current = loadProducts;
    loadAllDataRef.current = loadAllData;
    refreshStaleDataRef.current = refreshStaleData;
  }, [loadOrders, loadProducts, loadAllData, refreshStaleData]);

  // Set refresh functions once on mount
  useEffect(() => {
    const { setRefreshFunctions } = useSettings.getState();
    setRefreshFunctions({
      refreshOrders: () => loadOrdersRef.current(true),
      refreshProducts: () => loadProductsRef.current(true),
      refreshAll: () => {
        loadOrdersRef.current(true);
        loadProductsRef.current(true);
      },
    });
  }, []); // Empty dependency - only run once on mount

  useEffect(() => {
    if (!currentStore?.id) return;

    loadAllDataRef.current();

    // Skip while the window is hidden or offline (a tick every 5 min is the backoff when
    // offline); catch up as soon as the window is visible / back online.
    const canRefresh = (): boolean =>
      document.visibilityState !== 'hidden' && navigator.onLine !== false;
    const tick = (): void => {
      if (canRefresh()) refreshStaleDataRef.current();
    };
    const refreshInterval = setInterval(tick, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);

    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
    };
  }, [currentStore?.id]);

  return null;
}

export default DataManager;
