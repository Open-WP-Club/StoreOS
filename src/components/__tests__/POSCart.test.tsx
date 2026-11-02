import type React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { POSCart } from '../POSCart';
import { createMockProduct, createMockCustomer } from '../../__test_utils__';
import type { CartItem } from '../../stores/posStore';

const item = (id: number, name: string, price: number, quantity: number): CartItem => ({
  product: createMockProduct({ id, name }),
  price,
  quantity,
});

function setup(overrides: Partial<React.ComponentProps<typeof POSCart>> = {}) {
  const cart = overrides.cart ?? [item(1, 'Widget', 10, 2), item(2, 'Gadget', 5, 1)];
  const props: React.ComponentProps<typeof POSCart> = {
    cart,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    paymentMethod: 'cash',
    setPaymentMethod: vi.fn(),
    amountTendered: 0,
    setAmountTendered: vi.fn(),
    discountType: 'percent',
    discountValue: 0,
    setDiscount: vi.fn(),
    getSubtotal: () => 25,
    getDiscountAmount: () => 0,
    getTotal: () => 25,
    getChange: () => 0,
    getItemCount: () => cart.reduce((n, i) => n + i.quantity, 0),
    showCheckout: false,
    setShowCheckout: vi.fn(),
    processingOrder: false,
    onCheckout: vi.fn(),
    selectedCustomer: null,
    onClearCustomer: vi.fn(),
    onShowCustomerSearch: vi.fn(),
    orderNote: '',
    onOrderNoteChange: vi.fn(),
    currencySymbol: 'лв',
    onOpenQuantityNumpad: vi.fn(),
    onOpenAmountNumpad: vi.fn(),
    ...overrides,
  };
  render(<POSCart {...props} />);
  return props;
}

describe('POSCart', () => {
  it('shows empty state, hides clear/discount, and disables the pay button', () => {
    setup({ cart: [], getSubtotal: () => 0, getTotal: () => 0 });
    expect(screen.getByText('Кошницата е празна')).toBeInTheDocument();
    expect(screen.queryByText('Изчисти')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Отстъпка')).not.toBeInTheDocument();
    expect(screen.getByText('Плащане').closest('button')).toBeDisabled();
  });

  it('renders items with item count, and enables pay button', () => {
    const p = setup();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('Gadget')).toBeInTheDocument();
    expect(screen.getByText('3 артикула')).toBeInTheDocument();
    const pay = screen.getByText('Плащане').closest('button')!;
    expect(pay).toBeEnabled();
    fireEvent.click(pay);
    expect(p.setShowCheckout).toHaveBeenCalledWith(true);
  });

  it('changes quantity, opens numpad, removes items and clears cart', () => {
    const p = setup();
    const [minus] = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-minus'));
    const [plus] = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-plus'));
    fireEvent.click(minus!);
    expect(p.updateQuantity).toHaveBeenCalledWith(1, 1);
    fireEvent.click(plus!);
    expect(p.updateQuantity).toHaveBeenCalledWith(1, 3);
    fireEvent.click(screen.getByText('2'));
    expect(p.onOpenQuantityNumpad).toHaveBeenCalledWith(1, 2);
    const [trash] = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-trash-2'));
    fireEvent.click(trash!);
    expect(p.removeFromCart).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText('Изчисти'));
    expect(p.clearCart).toHaveBeenCalled();
  });

  it('handles discount input and type changes', () => {
    const p = setup({ discountValue: 10 });
    fireEvent.change(screen.getByPlaceholderText('Отстъпка'), { target: { value: '15' } });
    expect(p.setDiscount).toHaveBeenCalledWith('percent', 15);
    fireEvent.change(screen.getByPlaceholderText('Отстъпка'), { target: { value: '' } });
    expect(p.setDiscount).toHaveBeenCalledWith('percent', 0);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fixed' } });
    expect(p.setDiscount).toHaveBeenCalledWith('fixed', 10);
  });

  it('shows the discount line only when a discount is set', () => {
    setup({ discountValue: 10, getDiscountAmount: () => 2.5, getTotal: () => 22.5 });
    expect(screen.getByText('Отстъпка')).toBeInTheDocument();
    expect(screen.getByText(/^-/)).toBeInTheDocument();
  });

  it('hides the discount line without a discount', () => {
    setup();
    expect(screen.queryByText('Отстъпка')).not.toBeInTheDocument();
  });

  it('customer section: add, show and clear', () => {
    const p = setup();
    fireEvent.click(screen.getByText('Добави клиент'));
    expect(p.onShowCustomerSearch).toHaveBeenCalled();
  });

  it('shows selected customer and clears it', () => {
    const customer = createMockCustomer({ first_name: 'Ann', last_name: 'Lee', email: 'ann@test.com' });
    const p = setup({ selectedCustomer: customer });
    expect(screen.getByText('Ann Lee')).toBeInTheDocument();
    expect(screen.getByText('ann@test.com')).toBeInTheDocument();
    const btn = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-x'))!;
    fireEvent.click(btn);
    expect(p.onClearCustomer).toHaveBeenCalled();
  });

  it('forwards order note changes', () => {
    const p = setup();
    fireEvent.change(screen.getByPlaceholderText('Бележка за поръчката...'), {
      target: { value: 'hi' },
    });
    expect(p.onOrderNoteChange).toHaveBeenCalledWith('hi');
  });

  describe('checkout mode', () => {
    it('disables Завърши for cash when tendered < total, enables when enough, shows change', () => {
      setup({ showCheckout: true, amountTendered: 10 });
      expect(screen.getByText('Завърши').closest('button')).toBeDisabled();
      expect(screen.queryByText(/Ресто/)).not.toBeInTheDocument();
    });

    it('enables Завърши and shows change when tendered covers total', () => {
      const p = setup({ showCheckout: true, amountTendered: 30, getChange: () => 5 });
      const done = screen.getByText('Завърши').closest('button')!;
      expect(done).toBeEnabled();
      expect(screen.getByText(/Ресто/)).toBeInTheDocument();
      fireEvent.click(done);
      expect(p.onCheckout).toHaveBeenCalled();
    });

    it('disables Завърши while processing', () => {
      setup({ showCheckout: true, amountTendered: 30, processingOrder: true });
      expect(screen.getByText('Завърши').closest('button')).toBeDisabled();
    });

    it('card payment does not require tendered amount and hides cash inputs', () => {
      setup({ showCheckout: true, paymentMethod: 'card' });
      expect(screen.getByText('Завърши').closest('button')).toBeEnabled();
      expect(screen.queryByPlaceholderText('Платена сума')).not.toBeInTheDocument();
    });

    it('selects payment methods, quick amounts, numpad and cancels', () => {
      const p = setup({ showCheckout: true });
      fireEvent.click(screen.getByText('Карта'));
      expect(p.setPaymentMethod).toHaveBeenCalledWith('card');
      fireEvent.click(screen.getByText('Друго'));
      expect(p.setPaymentMethod).toHaveBeenCalledWith('other');
      fireEvent.click(screen.getByText('Каса'));
      expect(p.setPaymentMethod).toHaveBeenCalledWith('cash');
      fireEvent.click(screen.getByText('50 лв'));
      expect(p.setAmountTendered).toHaveBeenCalledWith(50);
      fireEvent.change(screen.getByPlaceholderText('Платена сума'), { target: { value: '12.5' } });
      expect(p.setAmountTendered).toHaveBeenCalledWith(12.5);
      fireEvent.click(screen.getByTitle('Отвори numpad'));
      expect(p.onOpenAmountNumpad).toHaveBeenCalled();
      fireEvent.click(screen.getByText('Отказ'));
      expect(p.setShowCheckout).toHaveBeenCalledWith(false);
    });
  });
});
