import { useEffect, useRef, useCallback } from 'react';
import { useStoreConfig, useCache, useSettings } from '../stores';
import useNotifications from '../stores/notificationStore';
import { useToast } from '../contexts/ToastContext';
import WooCommerceService from '../services/woocommerce';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { playNotificationSound } from '../utils/notificationSound';
import type { WooCommerceOrder, WooCommerceProduct, BatchLoadProgress } from '../types';
import type { NotificationType } from '../stores/notificationStore';

import type { OrderCelebrationData } from '../stores/notificationStore';

function sendNotification(
  type: NotificationType,
  title: string,
  body: string,
  route?: string,
  storeId?: string,
  celebrationData?: OrderCelebrationData,
): void {
  // Native Electron notification
  window.electronAPI?.showNotification({ title, body, route });

  // Store in notification center
  const { addNotification, soundEnabled, confettiEnabled, triggerCelebration } = useNotifications.getState();
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

  // Track known order IDs for new-order detection
  const knownOrderIdsRef = useRef<Set<number> | null>(null);

  const loadOrders = useCallback(
    async (force: boolean = false): Promise<void> => {
      if (!currentStore || (!force && loadingRef.current.orders)) return;

      loadingRef.current.orders = true;
      lastFetchRef.current.orders = Date.now();

      try {
        const service = new WooCommerceService(currentStore);
        const loadingSettings = currentStore.loadingSettings || { batchSize: 50, batchDelay: 500 };

        startLoading('orders', 0);

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
          toast.error(`Failed to load orders. Please try again.`);
        } else if (!('cancelled' in result && result.cancelled)) {
          await setCachedData('orders', result.data);

          // Detect new orders for notifications
          const { notifyNewOrders } = useSettings.getState();
          if (notifyNewOrders) {
            const currentIds = new Set((result.data as WooCommerceOrder[]).map((o) => o.id));
            if (knownOrderIdsRef.current !== null) {
              const newOrders = (result.data as WooCommerceOrder[]).filter(
                (o) => !knownOrderIdsRef.current!.has(o.id)
              );
              if (newOrders.length > 0) {
                const first = newOrders[0]!;
                const notifBody =
                  newOrders.length === 1
                    ? `Order #${first.id} — ${first.billing?.first_name || ''} ${first.billing?.last_name || ''}`
                    : `${newOrders.length} new orders received`;
                const customerName =
                  newOrders.length === 1
                    ? `${first.billing?.first_name || ''} ${first.billing?.last_name || ''}`.trim() || undefined
                    : undefined;
                sendNotification('new_order', 'New Order', notifBody, '/orders', currentStore.id, {
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
                  sendNotification('failed_payment', 'Failed Payment', failedBody, '/orders', currentStore.id);
                }
              }
            }
            knownOrderIdsRef.current = currentIds;
          }
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
        const loadingSettings = currentStore.loadingSettings || { batchSize: 50, batchDelay: 500 };

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
          toast.error(`Failed to load products. Please try again.`);
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
              sendNotification('low_stock', 'Low Stock Alert', stockBody, '/inventory', currentStore.id);
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
    [currentStore, setCachedData, setProductsLastSync, startLoading, updateProgress, finishLoading, isCancelled, toast]
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

  // Keep refs up to date. Refs can't be written during render, so this runs
  // as an effect after every commit instead.
  useEffect(() => {
    loadOrdersRef.current = loadOrders;
    loadProductsRef.current = loadProducts;
  });

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
    if (!currentStore) return;

    loadAllData();

    const refreshInterval = setInterval(() => {
      refreshStaleData();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-run when store ID changes, not on every currentStore property change
  }, [currentStore?.id, loadAllData, refreshStaleData]);

  return null;
}

export default DataManager;
