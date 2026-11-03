import { useState, useEffect, useRef } from 'react';
import { useStoreConfig } from '../stores';
import useAppSettings from '../stores/appSettingsStore';
import { buildReceipt } from '../utils/receipt';
import { printReceipt } from '../utils/printReceipt';
import { storeCurrencySymbol } from '../utils/currency';
import { useToast } from '../contexts/ToastContext';
import { usePOSStore } from '../stores/posStore';
import useOffline from '../stores/offlineStore';
import WooCommerceService from '../services/woocommerce';
import {
  CLIENT_ID_META,
  decrementCachedStock,
  isOfflineFailure,
  type PosSaleOpData,
} from '../utils/posOfflineSale';
import type { WooCommerceCustomer } from '../types';

interface UsePOSCheckoutResult {
  showCheckout: boolean;
  setShowCheckout: (show: boolean) => void;
  processingOrder: boolean;
  showCustomerSearch: boolean;
  setShowCustomerSearch: (show: boolean) => void;
  customerSearchTerm: string;
  setCustomerSearchTerm: (term: string) => void;
  customers: WooCommerceCustomer[];
  loadingCustomers: boolean;
  selectedCustomer: WooCommerceCustomer | null;
  handleSelectCustomer: (customer: WooCommerceCustomer) => void;
  clearCustomer: () => void;
  orderNote: string;
  setOrderNote: (note: string) => void;
  handleCheckout: () => Promise<void>;
}

/**
 * Hook for POS checkout logic, customer search, and order creation.
 */
export function usePOSCheckout(
  saveRecentTransaction: (orderId: number, pendingClientId?: string) => void
): UsePOSCheckoutResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();
  const toast = useToast();

  const {
    cart,
    clearCart,
    paymentMethod,
    discountType,
    discountValue,
    getDiscountAmount,
    getTotal,
    getChange,
    amountTendered,
  } = usePOSStore();

  const checkoutInFlight = useRef(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customers, setCustomers] = useState<WooCommerceCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<WooCommerceCustomer | null>(null);
  const [orderNote, setOrderNote] = useState('');

  // Debounced customer search; `cancelled` drops out-of-order/stale responses
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!currentStore || customerSearchTerm.length < 2) {
        setCustomers([]);
        setLoadingCustomers(false);
        return;
      }
      setLoadingCustomers(true);
      try {
        const service = new WooCommerceService(currentStore);
        const result = await service.getCustomers({ search: customerSearchTerm, per_page: 20 });
        if (!cancelled && result.success && result.data) {
          setCustomers(result.data);
        } else if (!cancelled && !result.success) {
          toast.error('Грешка при търсене на клиенти: ' + result.error);
        }
      } catch {
        if (!cancelled) toast.error('Грешка при търсене на клиенти');
      } finally {
        if (!cancelled) setLoadingCustomers(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerSearchTerm, currentStore, toast]);

  const handleSelectCustomer = (customer: WooCommerceCustomer): void => {
    setSelectedCustomer(customer);
    setShowCustomerSearch(false);
    setCustomerSearchTerm('');
  };

  const clearCustomer = (): void => {
    setSelectedCustomer(null);
  };

  const handleCheckout = async (): Promise<void> => {
    if (!currentStore || cart.length === 0 || checkoutInFlight.current) return;
    checkoutInFlight.current = true;

    try {
      setProcessingOrder(true);
      const service = new WooCommerceService(currentStore);

      const lineItems = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      // Idempotency key: one per sale, travels with the order whether it is sent now or replayed
      const clientId = crypto.randomUUID();
      const orderData = {
        meta_data: [{ key: CLIENT_ID_META, value: clientId }],
        status: 'completed' as const,
        payment_method: paymentMethod,
        payment_method_title:
          paymentMethod === 'cash' ? 'Каса' : paymentMethod === 'card' ? 'Карта' : 'Друго',
        set_paid: true,
        line_items: lineItems,
        ...(selectedCustomer && {
          customer_id: selectedCustomer.id,
        }),
        ...(discountValue > 0 && {
          fee_lines: [
            {
              name: discountType === 'percent' ? `Отстъпка ${discountValue}%` : 'Отстъпка',
              total: (-getDiscountAmount()).toString(),
            },
          ],
        }),
        ...(orderNote.trim() && {
          customer_note: orderNote.trim(),
        }),
      };

      // Auto-print (fire and forget); built before the cart is cleared.
      const printSale = (orderId: number): void => {
        const app = useAppSettings.getState();
        if (!app.autoPrintReceipt) return;
        const receipt = buildReceipt({
          storeName: currentStore.name,
          items: cart.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
          discount: getDiscountAmount(),
          total: getTotal(),
          paymentMethod: orderData.payment_method_title,
          tendered: paymentMethod === 'cash' ? amountTendered : undefined,
          change: getChange(),
          orderId,
          vatRate: app.receiptVatRate,
        });
        void printReceipt(receipt, {
          printer: app.defaultPrinter,
          openDrawer: app.openCashDrawer && paymentMethod === 'cash',
          currencySymbol: storeCurrencySymbol(currentStore),
          store: currentStore,
        }).then((ok) => {
          if (!ok) toast.warning('Касовата бележка не можа да се отпечата.');
        });
      };

      const soldItems = cart.map((i) => ({ productId: i.product.id, quantity: i.quantity }));
      const result = useOffline.getState().isOnline
        ? await service.createOrder(orderData)
        : ({ success: false, error: 'offline', code: 'offline' } as const);

      if (isOfflineFailure(result)) {
        // May or may not have reached the server (timeout); replay checks for the client id first.
        const op: PosSaleOpData = { clientId, order: orderData };
        useOffline.getState().addPendingOperation('create_order', op, currentStore.id);
        saveRecentTransaction(0, clientId);
        printSale(0);
        void decrementCachedStock(soldItems);
        clearCart();
        setSelectedCustomer(null);
        setOrderNote('');
        setShowCheckout(false);
        toast.warning('Офлайн: продажбата е запазена и ще се синхронизира при свързване.');
      } else if (result.success) {
        if (result.data?.id) {
          saveRecentTransaction(result.data.id);
          printSale(result.data.id);
        }
        clearCart();
        setSelectedCustomer(null);
        setOrderNote('');
        setShowCheckout(false);
        toast.success(`Поръчка #${result.data?.id} създадена успешно!`);
      } else {
        toast.error('Грешка при създаване на поръчка: ' + result.error);
      }
    } catch {
      toast.error('Грешка при създаване на поръчка');
    } finally {
      checkoutInFlight.current = false;
      setProcessingOrder(false);
    }
  };

  return {
    showCheckout,
    setShowCheckout,
    processingOrder,
    showCustomerSearch,
    setShowCustomerSearch,
    customerSearchTerm,
    setCustomerSearchTerm,
    customers,
    loadingCustomers,
    selectedCustomer,
    handleSelectCustomer,
    clearCustomer,
    orderNote,
    setOrderNote,
    handleCheckout,
  };
}

export default usePOSCheckout;
