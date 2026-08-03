import { useState, useCallback } from 'react';
import WooCommerceService from '../services/woocommerce';
import { getCurrencyCode } from '../utils/currency';
import { useProgressiveLoading } from './useProgressiveLoading';
import useSettings from '../stores/settingsStore';
import type { Order, Product } from '../types';

// ============================================
// Types
// ============================================

export interface RevenueStats {
  total: number;
  average: number;
  completed: number;
  pending: number;
}

export interface OrderStats {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  cancelled: number;
  refunded: number;
  failed: number;
}

export interface ProductStats {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  inventoryValue: number;
}

export interface TopProduct {
  id: string;
  name: string;
  revenue: number;
  quantity: number;
}

export interface DailyData {
  date: string;
  revenue: number;
  orders?: number;
}

export interface AnalyticsStats {
  revenue: RevenueStats;
  orders: OrderStats;
  products: ProductStats;
  topProducts: TopProduct[];
  revenueByDay: DailyData[];
  ordersByDay: DailyData[];
}

export interface DataQuality {
  hasEnoughOrders: boolean;
  hasEnoughProducts: boolean;
  hasEnoughHistory: boolean;
  lastUpdated: Date | null;
  isCalculating: boolean;
}

// ============================================
// Initial State
// ============================================

const EMPTY_STATS: AnalyticsStats = {
  revenue: { total: 0, average: 0, completed: 0, pending: 0 },
  orders: { total: 0, completed: 0, processing: 0, pending: 0, cancelled: 0, refunded: 0, failed: 0 },
  products: { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, inventoryValue: 0 },
  topProducts: [],
  revenueByDay: [],
  ordersByDay: [],
};

const INITIAL_QUALITY: DataQuality = {
  hasEnoughOrders: true,
  hasEnoughProducts: true,
  hasEnoughHistory: true,
  lastUpdated: null,
  isCalculating: false,
};

// ============================================
// Hook
// ============================================

interface UseAnalyticsDataOptions {
  currentStore: ReturnType<() => import('../types').WooCommerceStore | undefined>;
  selectedTimeRange: number;
  getCachedData: (type: 'orders' | 'products') => Promise<Order[] | Product[] | null>;
  setCachedData: (type: 'orders' | 'products', data: Order[] | Product[]) => Promise<void>;
}

export function useAnalyticsData({
  currentStore,
  selectedTimeRange,
  getCachedData,
  setCachedData,
}: UseAnalyticsDataOptions) {
  const [loading, setLoading] = useState(true);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [stats, setStats] = useState<AnalyticsStats>(EMPTY_STATS);
  const [dataQuality, setDataQuality] = useState<DataQuality>(INITIAL_QUALITY);

  const lowStockThreshold = useSettings((state) => state.lowStockThreshold);

  const { loadingState, startLoading, updateProgress, finishLoading, cancelLoading, isCancelled } =
    useProgressiveLoading();

  const calculateAnalytics = useCallback(
    (orders: Order[], products: Product[], timeRangeDays: number): void => {
      if (!orders || !products) return;

      setCurrencyCode(getCurrencyCode(orders));

      const threshold = new Date();
      threshold.setDate(threshold.getDate() - timeRangeDays);
      const filtered = orders.filter((o) => new Date(o.date_created) >= threshold);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const completed = filtered.filter((o) => o.status === 'completed');
      const totalRevenue = completed.reduce((s, o) => s + parseFloat(o.total || '0'), 0);
      const pendingRevenue = filtered
        .filter((o) => o.status === 'pending' || o.status === 'processing')
        .reduce((s, o) => s + parseFloat(o.total || '0'), 0);

      const productRevenue: Record<string, { name: string; revenue: number; quantity: number }> = {};
      filtered.forEach((order) => {
        order.line_items?.forEach((item) => {
          const id = String(item.product_id);
          if (!productRevenue[id]) productRevenue[id] = { name: item.name, revenue: 0, quantity: 0 };
          productRevenue[id].revenue += parseFloat(item.total || '0');
          productRevenue[id].quantity += parseInt(String(item.quantity || 0));
        });
      });

      const dailyData: Record<string, { revenue: number; orders: number }> = {};
      filtered.forEach((order) => {
        const dateKey = new Date(order.date_created).toISOString().split('T')[0] ?? '';
        if (!dateKey) return;
        if (!dailyData[dateKey]) dailyData[dateKey] = { revenue: 0, orders: 0 };
        const entry = dailyData[dateKey]!;
        if (order.status === 'completed') entry.revenue += parseFloat(order.total || '0');
        entry.orders += 1;
      });

      const sortedDates = Object.keys(dailyData).sort();

      setStats({
        revenue: {
          total: totalRevenue,
          average: completed.length > 0 ? totalRevenue / completed.length : 0,
          completed: totalRevenue,
          pending: pendingRevenue,
        },
        orders: {
          total: filtered.length,
          completed: filtered.filter((o) => o.status === 'completed').length,
          processing: filtered.filter((o) => o.status === 'processing').length,
          pending: filtered.filter((o) => o.status === 'pending').length,
          cancelled: filtered.filter((o) => o.status === 'cancelled').length,
          refunded: filtered.filter((o) => o.status === 'refunded').length,
          failed: filtered.filter((o) => o.status === 'failed').length,
        },
        products: {
          total: products.length,
          inStock: products.filter((p) => p.stock_status === 'instock').length,
          lowStock: products.filter(
            (p) => p.stock_quantity !== null && p.stock_quantity <= lowStockThreshold && p.stock_quantity > 0
          ).length,
          outOfStock: products.filter((p) => p.stock_status === 'outofstock').length,
          inventoryValue: products.reduce((s, p) => {
            return s + parseFloat(p.price || '0') * parseInt(String(p.stock_quantity || 0));
          }, 0),
        },
        topProducts: Object.entries(productRevenue)
          .map(([id, d]) => ({ id, ...d }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        revenueByDay: sortedDates.map((date) => ({ date, revenue: dailyData[date]?.revenue ?? 0 })),
        ordersByDay: sortedDates.map((date) => ({ date, revenue: 0, orders: dailyData[date]?.orders ?? 0 })),
      });

      setDataQuality({
        hasEnoughOrders: filtered.length >= 5,
        hasEnoughProducts: products.length >= 3,
        hasEnoughHistory: filtered.filter((o) => new Date(o.date_created) >= sevenDaysAgo).length >= 3,
        lastUpdated: new Date(),
        isCalculating: false,
      });
    },
    [lowStockThreshold]
  );

  const loadAnalytics = useCallback(async (): Promise<void> => {
    if (!currentStore) return;

    setLoading(true);
    setDataQuality((prev) => ({ ...prev, isCalculating: true }));

    try {
      const service = new WooCommerceService(currentStore);
      const { batchSize = 50, batchDelay = 500 } = currentStore.loadingSettings || {};

      let orders = (await getCachedData('orders')) as Order[] | null;
      let products = (await getCachedData('products')) as Product[] | null;

      if (orders && products) {
        calculateAnalytics(orders, products, selectedTimeRange);
        setLoading(false);
        setDataQuality((prev) => ({ ...prev, isCalculating: false }));
        return;
      }

      if (!orders) {
        startLoading('orders', 0);
        const result = await service.getAllOrders(
          { per_page: batchSize },
          (p) => {
            if (isCancelled()) return;
            updateProgress(p.allData.length, p.totalItems || p.allData.length);
            if (products) calculateAnalytics(p.allData as Order[], products, selectedTimeRange);
          },
          { batchDelay, cancelCheck: isCancelled }
        );
        if (result.success) {
          orders = result.data as Order[];
          await setCachedData('orders', orders);
        }
        finishLoading();
      }

      if (!products) {
        startLoading('products', 0);
        const result = await service.getAllProducts(
          { per_page: batchSize },
          (p) => {
            if (isCancelled()) return;
            updateProgress(p.allData.length, p.totalItems || p.allData.length);
            if (orders) calculateAnalytics(orders, p.allData as Product[], selectedTimeRange);
          },
          { batchDelay, cancelCheck: isCancelled }
        );
        if (result.success) {
          products = result.data as Product[];
          await setCachedData('products', products);
        }
        finishLoading();
      }

      if (orders && products) calculateAnalytics(orders, products, selectedTimeRange);
    } catch {
      setDataQuality((prev) => ({ ...prev, isCalculating: false }));
    } finally {
      setLoading(false);
      finishLoading();
    }
  }, [
    currentStore,
    selectedTimeRange,
    getCachedData,
    setCachedData,
    calculateAnalytics,
    startLoading,
    updateProgress,
    finishLoading,
    isCancelled,
  ]);

  return { loading, currencyCode, stats, dataQuality, loadingState, loadAnalytics, cancelLoading };
}
