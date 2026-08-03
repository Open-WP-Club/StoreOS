import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreConfig, useCache, useActivityLog } from '../stores';
import WooCommerceService from '../services/woocommerce';
import type { Order, OrderStatus, WooCommerceOrder } from '../types';
import { useToast } from './useToast';

const NOT_SYNCED = Symbol('not-synced');

interface UseOrderDetailResult {
  order: Order | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  updatingStatus: boolean;
  setOrder: (order: Order | null) => void;
  handleStatusUpdate: (newStatus: OrderStatus) => Promise<void>;
  fetchOrderFromApi: (showLoadingState: boolean) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  toasts: ReturnType<typeof useToast>['toasts'];
  removeToast: ReturnType<typeof useToast>['removeToast'];
}

/**
 * Hook for loading order data (cache-first) and handling status updates.
 */
export function useOrderDetail(id: string | undefined): UseOrderDetailResult {
  const navigate = useNavigate();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const ordersFromCache = useCache((state) => state.cache.orders?.data as WooCommerceOrder[] | undefined);
  const logActivity = useActivityLog((state) => state.logActivity);
  const activeStore = getCurrentStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  const { toasts, showToast, removeToast } = useToast();

  const getOrderFromCache = useCallback((): Order | null => {
    if (!ordersFromCache || !id) return null;
    const orderId = parseInt(id);
    return (ordersFromCache.find((o) => o.id === orderId) as Order) || null;
  }, [ordersFromCache, id]);

  const fetchOrderFromApi = useCallback(async (showLoadingState: boolean = true): Promise<void> => {
    if (!activeStore || !id) return;

    try {
      if (showLoadingState) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const wc = new WooCommerceService(activeStore);
      const orderData = await wc.getOrder(parseInt(id));

      if (orderData.success) {
        setOrder(orderData.data);
      } else {
        if (showLoadingState) {
          setError(orderData.error || 'Failed to load order');
        }
      }
    } catch {
      if (showLoadingState) {
        setError('Failed to load order');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStore, id]);

  // Render-time adjustment: when `id` changes (including on mount, via the
  // NOT_SYNCED sentinel below), immediately reflect any cached order and
  // loading state so the UI doesn't flash a loading spinner if we already
  // have the data. See https://react.dev/learn/you-might-not-need-an-effect
  const [prevId, setPrevId] = useState<string | undefined | typeof NOT_SYNCED>(NOT_SYNCED);
  if (prevId !== id) {
    setPrevId(id);
    const cachedOrder = getOrderFromCache();
    if (cachedOrder) {
      setOrder(cachedOrder);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!activeStore) {
      navigate('/setup');
      return;
    }

    const cachedOrder = getOrderFromCache();
    const showLoadingState = !cachedOrder;

    void Promise.resolve().then(() => fetchOrderFromApi(showLoadingState));
  }, [id, activeStore, navigate, getOrderFromCache, fetchOrderFromApi]);

  const handleStatusUpdate = async (newStatus: OrderStatus): Promise<void> => {
    if (!order || updatingStatus) return;

    try {
      setUpdatingStatus(true);
      const wc = new WooCommerceService(activeStore!);
      const oldStatus = order.status;
      const updatedOrder = await wc.updateOrder(order.id, { status: newStatus });
      if (updatedOrder.success) {
        setOrder(updatedOrder.data);
        logActivity({
          action: 'order_status_changed',
          entityType: 'order',
          entityId: order.id,
          entityName: `Order #${order.number}`,
          storeId: activeStore?.id ?? null,
          storeName: activeStore?.name,
          changes: { status: { from: oldStatus, to: newStatus } },
        });
        showToast('Order status updated successfully', 'success');
      } else {
        showToast('Failed to update order status: ' + (updatedOrder.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Failed to update order status: ' + (err as Error).message, 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return {
    order,
    loading,
    refreshing,
    error,
    updatingStatus,
    setOrder,
    handleStatusUpdate,
    fetchOrderFromApi,
    showToast,
    toasts,
    removeToast,
  };
}

export default useOrderDetail;
