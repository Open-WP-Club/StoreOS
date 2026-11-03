import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WooCommerceProduct } from '../types';
import useAppSettings from './appSettingsStore';
import { computeTotals, fromCents, type Discount, type PricedTotals } from '../utils/posPricing';
import { summarizePayments, type Payment, type PaymentSummary } from '../utils/payments';

export interface CartItem {
  product: WooCommerceProduct;
  quantity: number;
  price: number; // Actual price (sale or regular)
  discount?: Discount; // Per-line discount
}

interface POSState {
  // Cart
  cart: CartItem[];

  // Customer info (optional)
  customerId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  // Discount
  discountType: 'percent' | 'fixed';
  discountValue: number;

  // Payment
  paymentMethod: 'cash' | 'card' | 'other';
  amountTendered: number;
  /** Split payment rows; null = single-method payment (paymentMethod/amountTendered). */
  splitPayments: Payment[] | null;

  // UI State
  isCheckoutOpen: boolean;

  // Actions
  addToCart: (product: WooCommerceProduct, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;

  setCustomer: (id: number | null, name: string, email: string, phone: string) => void;
  clearCustomer: () => void;

  setDiscount: (type: 'percent' | 'fixed', value: number) => void;
  clearDiscount: () => void;

  setPaymentMethod: (method: 'cash' | 'card' | 'other') => void;
  setAmountTendered: (amount: number) => void;

  setLineDiscount: (productId: number, discount: Discount | null) => void;
  setSplitPayments: (payments: Payment[] | null) => void;

  setCheckoutOpen: (open: boolean) => void;

  // Computed values (as functions since Zustand doesn't support getters well)
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTax: (rate?: number) => number;
  getTotal: () => number;
  getChange: () => number;
  getTotals: () => PricedTotals;
  getLineDiscountAmount: () => number;
  getPaymentSummary: () => PaymentSummary;
  getItemCount: () => number;
}

const getProductPrice = (product: WooCommerceProduct): number => {
  const salePrice = parseFloat(product.sale_price || '0');
  const regularPrice = parseFloat(product.regular_price || product.price || '0');
  return salePrice > 0 ? salePrice : regularPrice;
};

export const usePOSStore = create<POSState>()(
  immer((set, get) => ({
    // Initial state
    cart: [],
    customerId: null,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    discountType: 'percent',
    discountValue: 0,
    paymentMethod: 'cash',
    amountTendered: 0,
    splitPayments: null,
    isCheckoutOpen: false,

    // Cart actions
    addToCart: (product, quantity = 1) => {
      set((state) => {
        const existingItem = state.cart.find((item) => item.product.id === product.id);

        if (existingItem) {
          existingItem.quantity += quantity;
        } else {
          state.cart.push({
            product,
            quantity,
            price: getProductPrice(product),
          });
        }
      });
    },

    removeFromCart: (productId) => {
      set((state) => {
        const index = state.cart.findIndex((item) => item.product.id === productId);
        if (index !== -1) state.cart.splice(index, 1);
      });
    },

    updateQuantity: (productId, quantity) => {
      if (quantity <= 0) {
        get().removeFromCart(productId);
        return;
      }

      set((state) => {
        const item = state.cart.find((item) => item.product.id === productId);
        if (item) item.quantity = quantity;
      });
    },

    clearCart: () => {
      set({
        cart: [],
        customerId: null,
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        discountType: 'percent',
        discountValue: 0,
        amountTendered: 0,
        splitPayments: null,
        isCheckoutOpen: false,
      });
    },

    // Customer actions
    setCustomer: (id, name, email, phone) => {
      set({
        customerId: id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
      });
    },

    clearCustomer: () => {
      set({
        customerId: null,
        customerName: '',
        customerEmail: '',
        customerPhone: '',
      });
    },

    // Discount actions
    setDiscount: (type, value) => {
      set({ discountType: type, discountValue: value });
    },

    clearDiscount: () => {
      set({ discountType: 'percent', discountValue: 0 });
    },

    // Payment actions
    setPaymentMethod: (method) => {
      set({ paymentMethod: method });
    },

    setAmountTendered: (amount) => {
      set({ amountTendered: amount });
    },

    setLineDiscount: (productId, discount) => {
      set((state) => {
        const item = state.cart.find((i) => i.product.id === productId);
        if (!item) return;
        if (discount && discount.value > 0) item.discount = discount;
        else delete item.discount;
      });
    },

    setSplitPayments: (payments) => {
      set({ splitPayments: payments });
    },

    setCheckoutOpen: (open) => {
      set({ isCheckoutOpen: open });
    },

    // Computed values (integer-cent math lives in utils/posPricing)
    getTotals: () => {
      const { cart, discountType, discountValue } = get();
      return computeTotals(
        cart,
        { type: discountType, value: discountValue },
        useAppSettings.getState().maxDiscountPercent
      );
    },

    getSubtotal: () => fromCents(get().getTotals().subtotalCents),

    getLineDiscountAmount: () => fromCents(get().getTotals().lineDiscountCents),

    // Sale-level discount (applied after line discounts)
    getDiscountAmount: () => fromCents(get().getTotals().saleDiscountCents),

    getTax: (rate = 20) => (get().getTotal() * rate) / 100,

    // Note: Tax is usually included in Bulgarian prices
    getTotal: () => fromCents(get().getTotals().totalCents),

    getPaymentSummary: () => {
      const { splitPayments, paymentMethod, amountTendered } = get();
      const total = get().getTotal();
      const payments: Payment[] = splitPayments ?? [
        { method: paymentMethod, amount: paymentMethod === 'cash' ? amountTendered : total },
      ];
      return summarizePayments(payments, total);
    },

    getChange: () => get().getPaymentSummary().change,

    getItemCount: () => {
      const { cart } = get();
      return cart.reduce((sum, item) => sum + item.quantity, 0);
    },
  }))
);
