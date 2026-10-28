import { useState, useCallback } from 'react';
import { useStoreConfig } from '../stores';
import { useToast } from '../contexts/ToastContext';
import { usePOSStore } from '../stores/posStore';
import WooCommerceService from '../services/woocommerce';

export interface TransactionItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
}

export interface RecentTransaction {
  id: number;
  total: number;
  itemCount: number;
  items: TransactionItem[];
  paymentMethod: string;
  customerName?: string;
  timestamp: string;
  refunded?: boolean;
}

export interface DailyReportStats {
  totalSales: number;
  orderCount: number;
  averageOrder: number;
  byPaymentMethod: Record<string, { total: number; count: number }>;
  topProducts: Array<{ productId: number; name: string; quantity: number; revenue: number }>;
}

const RECENT_TRANSACTIONS_KEY = 'pos_recent_transactions';

interface UsePOSDailyReportResult {
  showRecentTransactions: boolean;
  setShowRecentTransactions: (show: boolean) => void;
  recentTransactions: RecentTransaction[];
  showDailyReport: boolean;
  setShowDailyReport: (show: boolean) => void;
  refundingTransaction: RecentTransaction | null;
  setRefundingTransaction: (tx: RecentTransaction | null) => void;
  processingRefund: boolean;
  saveRecentTransaction: (orderId: number) => void;
  getTodayTransactions: () => RecentTransaction[];
  getDailyReportStats: () => DailyReportStats;
  exportDailyReportCSV: () => void;
  handleRefund: (transaction: RecentTransaction) => Promise<void>;
}

/**
 * Hook for POS transaction history, daily report stats, CSV export, and refunds.
 */
export function usePOSDailyReport(): UsePOSDailyReportResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();
  const toast = useToast();
  const currencySymbol = currentStore?.currencySymbol || '';

  const {
    cart,
    paymentMethod,
    getTotal,
    getItemCount,
  } = usePOSStore();

  const [showRecentTransactions, setShowRecentTransactions] = useState(false);
  // Lazy-initialized from localStorage on mount (avoids a redundant effect).
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_TRANSACTIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      // Intentional: corrupt or unavailable localStorage just means an empty history.
      return [];
    }
  });
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [refundingTransaction, setRefundingTransaction] = useState<RecentTransaction | null>(null);
  const [processingRefund, setProcessingRefund] = useState(false);

  // Save transaction to recent list
  const saveRecentTransaction = useCallback((orderId: number): void => {
    const items: TransactionItem[] = cart.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const transaction: RecentTransaction = {
      id: orderId,
      total: getTotal(),
      itemCount: getItemCount(),
      items,
      paymentMethod: paymentMethod === 'cash' ? 'Каса' : paymentMethod === 'card' ? 'Карта' : 'Друго',
      timestamp: new Date().toISOString(),
      refunded: false,
    };

    setRecentTransactions((prev) => {
      const updated = [transaction, ...prev].slice(0, 50);
      try {
        localStorage.setItem(RECENT_TRANSACTIONS_KEY, JSON.stringify(updated));
      } catch {
        // eslint-disable-next-line no-console
        console.warn('POS: could not persist recent transactions to localStorage');
      }
      return updated;
    });
  }, [cart, paymentMethod, getTotal, getItemCount]);

  const getTodayTransactions = useCallback((): RecentTransaction[] => {
    const today = new Date().toDateString();
    return recentTransactions.filter((tx) => {
      const txDate = new Date(tx.timestamp).toDateString();
      return txDate === today && !tx.refunded;
    });
  }, [recentTransactions]);

  const getDailyReportStats = useCallback((): DailyReportStats => {
    const todayTx = getTodayTransactions();

    const totalSales = todayTx.reduce((sum, tx) => sum + tx.total, 0);
    const orderCount = todayTx.length;
    const averageOrder = orderCount > 0 ? totalSales / orderCount : 0;

    const byPaymentMethod: Record<string, { total: number; count: number }> = {};
    todayTx.forEach((tx) => {
      const method = tx.paymentMethod;
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = { total: 0, count: 0 };
      }
      const entry = byPaymentMethod[method];
      entry.total += tx.total;
      entry.count += 1;
    });

    const productSales: Record<number, { name: string; quantity: number; revenue: number }> = {};
    todayTx.forEach((tx) => {
      tx.items?.forEach((item) => {
        const pid = item.productId;
        if (!productSales[pid]) {
          productSales[pid] = { name: item.name, quantity: 0, revenue: 0 };
        }
        const sale = productSales[pid];
        sale.quantity += item.quantity;
        sale.revenue += item.price * item.quantity;
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ productId: parseInt(id), ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return { totalSales, orderCount, averageOrder, byPaymentMethod, topProducts };
  }, [getTodayTransactions]);

  const exportDailyReportCSV = useCallback(() => {
    const stats = getDailyReportStats();
    const todayTx = getTodayTransactions();
    const today = new Date().toLocaleDateString('bg-BG');

    let csv = `Дневен отчет - ${today}\n\n`;
    csv += `Общо продажби,${stats.totalSales.toFixed(2)} ${currencySymbol}\n`;
    csv += `Брой поръчки,${stats.orderCount}\n`;
    csv += `Средна стойност,${stats.averageOrder.toFixed(2)} ${currencySymbol}\n\n`;

    csv += `По метод на плащане\n`;
    csv += `Метод,Сума,Брой поръчки\n`;
    Object.entries(stats.byPaymentMethod).forEach(([method, data]) => {
      csv += `${method},${data.total.toFixed(2)} ${currencySymbol},${data.count}\n`;
    });

    csv += `\nНай-продавани продукти\n`;
    csv += `Продукт,Количество,Приходи\n`;
    stats.topProducts.forEach((product) => {
      csv += `"${product.name}",${product.quantity},${product.revenue.toFixed(2)} ${currencySymbol}\n`;
    });

    csv += `\nДетайли на транзакциите\n`;
    csv += `Поръчка #,Час,Артикули,Метод,Сума\n`;
    todayTx.forEach((tx) => {
      const time = new Date(tx.timestamp).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
      csv += `${tx.id},${time},${tx.itemCount},${tx.paymentMethod},${tx.total.toFixed(2)} ${currencySymbol}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [getDailyReportStats, getTodayTransactions, currencySymbol]);

  const handleRefund = async (transaction: RecentTransaction): Promise<void> => {
    if (!currentStore) return;

    try {
      setProcessingRefund(true);
      const service = new WooCommerceService(currentStore);
      const result = await service.refundOrder(transaction.id, transaction.total, 'POS Refund');

      if (result.success) {
        const updated = recentTransactions.map((tx) =>
          tx.id === transaction.id && tx.timestamp === transaction.timestamp
            ? { ...tx, refunded: true }
            : tx
        );
        setRecentTransactions(updated);

        try {
          localStorage.setItem(RECENT_TRANSACTIONS_KEY, JSON.stringify(updated));
        } catch {
          // eslint-disable-next-line no-console
          console.warn('POS: could not persist recent transactions to localStorage');
        }

        toast.success(`Поръчка #${transaction.id} е възстановена успешно!`);
      } else {
        toast.error('Грешка при възстановяване: ' + result.error);
      }
    } catch {
      toast.error('Грешка при възстановяване на поръчка');
    } finally {
      setProcessingRefund(false);
      setRefundingTransaction(null);
    }
  };

  return {
    showRecentTransactions,
    setShowRecentTransactions,
    recentTransactions,
    showDailyReport,
    setShowDailyReport,
    refundingTransaction,
    setRefundingTransaction,
    processingRefund,
    saveRecentTransaction,
    getTodayTransactions,
    getDailyReportStats,
    exportDailyReportCSV,
    handleRefund,
  };
}

export default usePOSDailyReport;
