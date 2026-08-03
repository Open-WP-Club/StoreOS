import { useState } from 'react';
import { getCurrencyCode } from '../utils/currency';
import useSettings from '../stores/settingsStore';
import type { WooCommerceOrder, WooCommerceProduct } from '../types';

export interface StatsState {
  totalOrders: number;
  totalProducts: number;
  lowStock: number;
  pendingOrders: number;
}

export interface DailyStatsState {
  today: { orders: number; revenue: number };
  yesterday: { orders: number; revenue: number };
}

export interface WeeklyStatsState {
  thisWeek: { orders: number; revenue: number };
  lastWeek: { orders: number; revenue: number };
}

export interface TopProduct {
  id: number;
  name: string;
  quantitySold: number;
  revenue: number;
}

interface UseDashboardStatsReturn {
  stats: StatsState;
  dailyStats: DailyStatsState;
  weeklyStats: WeeklyStatsState;
  pendingOrdersValue: number;
  topProducts: TopProduct[];
  inventoryValue: number;
  currencyCode: string;
  calculateStats: (ordersData: WooCommerceOrder[], productsData: WooCommerceProduct[]) => void;
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const lowStockThreshold = useSettings((state) => state.lowStockThreshold);
  const orderSplitDays = useSettings((state) => state.orderSplitDays);

  const [stats, setStats] = useState<StatsState>({
    totalOrders: 0,
    totalProducts: 0,
    lowStock: 0,
    pendingOrders: 0,
  });
  const [dailyStats, setDailyStats] = useState<DailyStatsState>({
    today: { orders: 0, revenue: 0 },
    yesterday: { orders: 0, revenue: 0 },
  });
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatsState>({
    thisWeek: { orders: 0, revenue: 0 },
    lastWeek: { orders: 0, revenue: 0 },
  });
  const [pendingOrdersValue, setPendingOrdersValue] = useState<number>(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [inventoryValue, setInventoryValue] = useState<number>(0);
  const [currencyCode, setCurrencyCode] = useState<string>('USD');

  const calculateStats = (
    ordersData: WooCommerceOrder[],
    productsData: WooCommerceProduct[]
  ): void => {
    if (!ordersData || !productsData) return;

    // Extract currency code from orders data
    const detectedCurrency = getCurrencyCode(ordersData);
    setCurrencyCode(detectedCurrency);

    const pendingOrders = ordersData.filter(
      (order) => order.status === 'pending' || order.status === 'processing'
    );
    const pendingOrdersCount = pendingOrders.length;

    // Calculate pending orders value
    const pendingValue = pendingOrders.reduce(
      (sum, order) => sum + parseFloat(order.total || '0'),
      0
    );
    setPendingOrdersValue(pendingValue);

    // Calculate daily stats
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayOrders = ordersData.filter((order) => {
      const orderDate = new Date(order.date_created);
      return orderDate >= today;
    });

    const yesterdayOrders = ordersData.filter((order) => {
      const orderDate = new Date(order.date_created);
      return orderDate >= yesterday && orderDate < today;
    });

    const todayRevenue = todayOrders.reduce(
      (sum, order) => sum + parseFloat(order.total || '0'),
      0
    );
    const yesterdayRevenue = yesterdayOrders.reduce(
      (sum, order) => sum + parseFloat(order.total || '0'),
      0
    );

    setDailyStats({
      today: { orders: todayOrders.length, revenue: todayRevenue },
      yesterday: { orders: yesterdayOrders.length, revenue: yesterdayRevenue },
    });

    // Calculate weekly stats using configurable window
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - orderSplitDays);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - orderSplitDays);

    const thisWeekOrders = ordersData.filter((order) => {
      const orderDate = new Date(order.date_created);
      return orderDate >= thisWeekStart;
    });

    const lastWeekOrders = ordersData.filter((order) => {
      const orderDate = new Date(order.date_created);
      return orderDate >= lastWeekStart && orderDate < thisWeekStart;
    });

    const thisWeekRevenue = thisWeekOrders.reduce(
      (sum, order) => sum + parseFloat(order.total || '0'),
      0
    );
    const lastWeekRevenue = lastWeekOrders.reduce(
      (sum, order) => sum + parseFloat(order.total || '0'),
      0
    );

    setWeeklyStats({
      thisWeek: { orders: thisWeekOrders.length, revenue: thisWeekRevenue },
      lastWeek: { orders: lastWeekOrders.length, revenue: lastWeekRevenue },
    });

    // Calculate top selling products from completed orders
    const completedOrders = ordersData.filter((o) => o.status === 'completed');
    const productSales: Record<number, { name: string; quantity: number; revenue: number }> = {};

    completedOrders.forEach((order) => {
      order.line_items?.forEach((item) => {
        const productId = item.product_id;
        if (!productSales[productId]) {
          productSales[productId] = { name: item.name, quantity: 0, revenue: 0 };
        }
        const product = productSales[productId];
        if (product) {
          product.quantity += item.quantity;
          product.revenue += parseFloat(item.total || '0');
        }
      });
    });

    const topProductsList = Object.entries(productSales)
      .map(([id, data]) => ({
        id: parseInt(id),
        name: data.name,
        quantitySold: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    setTopProducts(topProductsList);

    // Calculate inventory value
    const totalInventoryValue = productsData.reduce((sum, p) => {
      const price = parseFloat(p.price) || 0;
      const qty = p.stock_quantity !== null ? p.stock_quantity : 0;
      return sum + price * qty;
    }, 0);
    setInventoryValue(totalInventoryValue);

    const lowStockProducts = productsData.filter(
      (p) => p.stock_quantity !== null && p.stock_quantity <= lowStockThreshold
    );

    setStats({
      totalOrders: ordersData.length,
      totalProducts: productsData.length,
      lowStock: lowStockProducts.length,
      pendingOrders: pendingOrdersCount,
    });
  };

  return {
    stats,
    dailyStats,
    weeklyStats,
    pendingOrdersValue,
    topProducts,
    inventoryValue,
    currencyCode,
    calculateStats,
  };
}
