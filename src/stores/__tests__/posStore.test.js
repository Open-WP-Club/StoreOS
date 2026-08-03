import { renderHook, act } from '@testing-library/react';
import { usePOSStore } from '../posStore';

describe('posStore', () => {
  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: '25.00',
    regular_price: '30.00',
    sale_price: '25.00',
    stock_quantity: 10,
  };

  const mockProduct2 = {
    id: 2,
    name: 'Test Product 2',
    price: '15.00',
    regular_price: '15.00',
    sale_price: '',
    stock_quantity: 5,
  };

  beforeEach(() => {
    // Reset store state before each test
    usePOSStore.setState({
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
    });
  });

  describe('Cart Management', () => {
    describe('addToCart', () => {
      it('should add a product to the cart', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].product.id).toBe(1);
        expect(result.current.cart[0].quantity).toBe(1);
      });

      it('should add a product with custom quantity', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 5);
        });

        expect(result.current.cart[0].quantity).toBe(5);
      });

      it('should increase quantity when adding same product again', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 2);
          result.current.addToCart(mockProduct, 3);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].quantity).toBe(5);
      });

      it('should use sale price when available', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
        });

        expect(result.current.cart[0].price).toBe(25);
      });

      it('should use regular price when no sale price', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct2);
        });

        expect(result.current.cart[0].price).toBe(15);
      });

      it('should handle multiple different products', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
          result.current.addToCart(mockProduct2);
        });

        expect(result.current.cart).toHaveLength(2);
      });
    });

    describe('removeFromCart', () => {
      it('should remove a product from the cart', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
          result.current.addToCart(mockProduct2);
        });

        act(() => {
          result.current.removeFromCart(1);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].product.id).toBe(2);
      });

      it('should handle removing non-existent product', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
        });

        act(() => {
          result.current.removeFromCart(999);
        });

        expect(result.current.cart).toHaveLength(1);
      });
    });

    describe('updateQuantity', () => {
      it('should update the quantity of a cart item', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
        });

        act(() => {
          result.current.updateQuantity(1, 10);
        });

        expect(result.current.cart[0].quantity).toBe(10);
      });

      it('should remove item when quantity is set to 0', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
        });

        act(() => {
          result.current.updateQuantity(1, 0);
        });

        expect(result.current.cart).toHaveLength(0);
      });

      it('should remove item when quantity is negative', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
        });

        act(() => {
          result.current.updateQuantity(1, -5);
        });

        expect(result.current.cart).toHaveLength(0);
      });
    });

    describe('clearCart', () => {
      it('should clear all items from the cart', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
          result.current.addToCart(mockProduct2);
        });

        act(() => {
          result.current.clearCart();
        });

        expect(result.current.cart).toHaveLength(0);
      });

      it('should also reset customer info', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setCustomer(1, 'John Doe', 'john@example.com', '1234567890');
        });

        act(() => {
          result.current.clearCart();
        });

        expect(result.current.customerId).toBeNull();
        expect(result.current.customerName).toBe('');
        expect(result.current.customerEmail).toBe('');
        expect(result.current.customerPhone).toBe('');
      });

      it('should reset discount and amount tendered', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setDiscount('fixed', 10);
          result.current.setAmountTendered(100);
        });

        act(() => {
          result.current.clearCart();
        });

        expect(result.current.discountType).toBe('percent');
        expect(result.current.discountValue).toBe(0);
        expect(result.current.amountTendered).toBe(0);
      });

      it('should close checkout modal', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setCheckoutOpen(true);
        });

        act(() => {
          result.current.clearCart();
        });

        expect(result.current.isCheckoutOpen).toBe(false);
      });
    });
  });

  describe('Customer Management', () => {
    describe('setCustomer', () => {
      it('should set customer information', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setCustomer(1, 'John Doe', 'john@example.com', '1234567890');
        });

        expect(result.current.customerId).toBe(1);
        expect(result.current.customerName).toBe('John Doe');
        expect(result.current.customerEmail).toBe('john@example.com');
        expect(result.current.customerPhone).toBe('1234567890');
      });

      it('should allow null customerId for guest', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setCustomer(null, 'Guest', '', '');
        });

        expect(result.current.customerId).toBeNull();
        expect(result.current.customerName).toBe('Guest');
      });
    });

    describe('clearCustomer', () => {
      it('should clear customer information', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setCustomer(1, 'John Doe', 'john@example.com', '1234567890');
        });

        act(() => {
          result.current.clearCustomer();
        });

        expect(result.current.customerId).toBeNull();
        expect(result.current.customerName).toBe('');
        expect(result.current.customerEmail).toBe('');
        expect(result.current.customerPhone).toBe('');
      });
    });
  });

  describe('Discount Management', () => {
    describe('setDiscount', () => {
      it('should set percent discount', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setDiscount('percent', 10);
        });

        expect(result.current.discountType).toBe('percent');
        expect(result.current.discountValue).toBe(10);
      });

      it('should set fixed discount', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setDiscount('fixed', 5);
        });

        expect(result.current.discountType).toBe('fixed');
        expect(result.current.discountValue).toBe(5);
      });
    });

    describe('clearDiscount', () => {
      it('should reset discount to defaults', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setDiscount('fixed', 10);
        });

        act(() => {
          result.current.clearDiscount();
        });

        expect(result.current.discountType).toBe('percent');
        expect(result.current.discountValue).toBe(0);
      });
    });
  });

  describe('Payment Management', () => {
    describe('setPaymentMethod', () => {
      it('should set payment method to cash', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setPaymentMethod('cash');
        });

        expect(result.current.paymentMethod).toBe('cash');
      });

      it('should set payment method to card', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setPaymentMethod('card');
        });

        expect(result.current.paymentMethod).toBe('card');
      });

      it('should set payment method to other', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setPaymentMethod('other');
        });

        expect(result.current.paymentMethod).toBe('other');
      });
    });

    describe('setAmountTendered', () => {
      it('should set the amount tendered', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setAmountTendered(50);
        });

        expect(result.current.amountTendered).toBe(50);
      });
    });
  });

  describe('UI State', () => {
    describe('setCheckoutOpen', () => {
      it('should open checkout modal', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setCheckoutOpen(true);
        });

        expect(result.current.isCheckoutOpen).toBe(true);
      });

      it('should close checkout modal', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.setCheckoutOpen(true);
        });

        act(() => {
          result.current.setCheckoutOpen(false);
        });

        expect(result.current.isCheckoutOpen).toBe(false);
      });
    });
  });

  describe('Computed Values', () => {
    describe('getSubtotal', () => {
      it('should return 0 for empty cart', () => {
        const { result } = renderHook(() => usePOSStore());

        expect(result.current.getSubtotal()).toBe(0);
      });

      it('should calculate subtotal correctly', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 2); // 25 * 2 = 50
          result.current.addToCart(mockProduct2, 3); // 15 * 3 = 45
        });

        expect(result.current.getSubtotal()).toBe(95);
      });
    });

    describe('getDiscountAmount', () => {
      it('should return 0 when no discount', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct);
        });

        expect(result.current.getDiscountAmount()).toBe(0);
      });

      it('should calculate percent discount correctly', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 25 * 4 = 100
          result.current.setDiscount('percent', 10);
        });

        expect(result.current.getDiscountAmount()).toBe(10); // 10% of 100
      });

      it('should calculate fixed discount correctly', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 25 * 4 = 100
          result.current.setDiscount('fixed', 15);
        });

        expect(result.current.getDiscountAmount()).toBe(15);
      });

      it('should cap fixed discount at subtotal', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct); // 25
          result.current.setDiscount('fixed', 100);
        });

        expect(result.current.getDiscountAmount()).toBe(25); // Capped at subtotal
      });
    });

    describe('getTax', () => {
      it('should calculate tax with default rate (20%)', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 25 * 4 = 100
        });

        expect(result.current.getTax()).toBe(20); // 20% of 100
      });

      it('should calculate tax with custom rate', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 25 * 4 = 100
        });

        expect(result.current.getTax(10)).toBe(10); // 10% of 100
      });

      it('should calculate tax after discount', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 25 * 4 = 100
          result.current.setDiscount('fixed', 20); // Subtotal becomes 80
        });

        expect(result.current.getTax()).toBe(16); // 20% of 80
      });
    });

    describe('getTotal', () => {
      it('should return subtotal minus discount', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 25 * 4 = 100
          result.current.setDiscount('fixed', 10);
        });

        expect(result.current.getTotal()).toBe(90);
      });

      it('should return 0 for empty cart', () => {
        const { result } = renderHook(() => usePOSStore());

        expect(result.current.getTotal()).toBe(0);
      });
    });

    describe('getChange', () => {
      it('should return 0 for non-cash payments', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 100
          result.current.setPaymentMethod('card');
          result.current.setAmountTendered(150);
        });

        expect(result.current.getChange()).toBe(0);
      });

      it('should calculate change for cash payments', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 100
          result.current.setPaymentMethod('cash');
          result.current.setAmountTendered(150);
        });

        expect(result.current.getChange()).toBe(50);
      });

      it('should return 0 when amount tendered is less than total', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 4); // 100
          result.current.setPaymentMethod('cash');
          result.current.setAmountTendered(50);
        });

        expect(result.current.getChange()).toBe(0);
      });
    });

    describe('getItemCount', () => {
      it('should return 0 for empty cart', () => {
        const { result } = renderHook(() => usePOSStore());

        expect(result.current.getItemCount()).toBe(0);
      });

      it('should return total item count', () => {
        const { result } = renderHook(() => usePOSStore());

        act(() => {
          result.current.addToCart(mockProduct, 3);
          result.current.addToCart(mockProduct2, 2);
        });

        expect(result.current.getItemCount()).toBe(5);
      });
    });
  });
});
