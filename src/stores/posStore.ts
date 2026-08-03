import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WooCommerceProduct } from '../types';

export interface CartItem {
  product: WooCommerceProduct;
  quantity: number;
  price: number; // Actual price (sale or regular)
}

export interface POSState {
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

  setCheckoutOpen: (open: boolean) => void;

  // Computed values (as functions since Zustand doesn't support getters well)
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTax: (rate?: number) => number;
  getTotal: () => number;
  getChange: () => number;
  getItemCount: () => number;
}

const getProductPrice = (product: WooCommerceProduct): number => {
  const salePrice = parseFloat(product.sale_price || '0');
  const regularPrice = parseFloat(product.regular_price || product.price || '0');
  return salePrice > 0 ? salePrice : regularPrice;
};

export const usePOSStore = create<POSState>()(immer((set, get) => ({
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

  setCheckoutOpen: (open) => {
    set({ isCheckoutOpen: open });
  },

  // Computed values
  getSubtotal: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getDiscountAmount: () => {
    const { discountType, discountValue } = get();
    const subtotal = get().getSubtotal();

    if (discountValue <= 0) return 0;

    if (discountType === 'percent') {
      return (subtotal * discountValue) / 100;
    }
    return Math.min(discountValue, subtotal);
  },

  getTax: (rate = 20) => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscountAmount();
    return ((subtotal - discount) * rate) / 100;
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscountAmount();
    // Note: Tax is usually included in Bulgarian prices
    return subtotal - discount;
  },

  getChange: () => {
    const { amountTendered, paymentMethod } = get();
    if (paymentMethod !== 'cash') return 0;
    const total = get().getTotal();
    return Math.max(0, amountTendered - total);
  },

  getItemCount: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  },
})));
