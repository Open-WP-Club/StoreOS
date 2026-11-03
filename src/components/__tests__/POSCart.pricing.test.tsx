import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { POSCart } from '../POSCart';
import { usePOSStore } from '../../stores/posStore';
import { createMockProduct } from '../../__test_utils__';

// Drives POSCart against the real POS store so pricing, caps and payment validity are end to end.
function Harness({ showCheckout = true }: { showCheckout?: boolean }) {
  const s = usePOSStore();
  return (
    <POSCart
      cart={s.cart}
      removeFromCart={s.removeFromCart}
      updateQuantity={s.updateQuantity}
      clearCart={s.clearCart}
      paymentMethod={s.paymentMethod}
      setPaymentMethod={s.setPaymentMethod}
      amountTendered={s.amountTendered}
      setAmountTendered={s.setAmountTendered}
      discountType={s.discountType}
      discountValue={s.discountValue}
      setDiscount={s.setDiscount}
      getSubtotal={s.getSubtotal}
      getDiscountAmount={s.getDiscountAmount}
      getTotal={s.getTotal}
      getChange={s.getChange}
      setLineDiscount={s.setLineDiscount}
      getLineDiscountAmount={s.getLineDiscountAmount}
      splitPayments={s.splitPayments}
      setSplitPayments={s.setSplitPayments}
      getPaymentSummary={s.getPaymentSummary}
      getItemCount={s.getItemCount}
      showCheckout={showCheckout}
      setShowCheckout={vi.fn()}
      processingOrder={false}
      onCheckout={vi.fn()}
      selectedCustomer={null}
      onClearCustomer={vi.fn()}
      onShowCustomerSearch={vi.fn()}
      orderNote=""
      onOrderNoteChange={vi.fn()}
      currencySymbol="лв"
      onOpenQuantityNumpad={vi.fn()}
      onOpenAmountNumpad={vi.fn()}
    />
  );
}

const done = (): HTMLElement => screen.getByText('Завърши').closest('button')!;
const text = (): string => document.body.textContent ?? '';

describe('POSCart pricing and split payments (real store)', () => {
  beforeEach(() => {
    usePOSStore.getState().clearCart();
    usePOSStore.setState({
      discountType: 'percent',
      discountValue: 0,
      paymentMethod: 'cash',
      amountTendered: 0,
      splitPayments: null,
    });
    // two lines: 10 x 2 = 20 and 30 x 1 = 30 -> subtotal 50
    const priced = (id: number, name: string, p: string) =>
      createMockProduct({ id, name, price: p, regular_price: p, sale_price: '' });
    usePOSStore.getState().addToCart(priced(1, 'Widget', '10'), 2);
    usePOSStore.getState().addToCart(priced(2, 'Gadget', '30'), 1);
  });

  it('per-line percent discount updates totals and shows the line-discount row', () => {
    render(<Harness />);
    const [first] = screen.getAllByLabelText('Отстъпка за артикул');
    fireEvent.change(first!, { target: { value: '10' } });
    // 10% of 20 = 2 -> total 48
    expect(screen.getByText('Отстъпки по артикули')).toBeInTheDocument();
    expect(usePOSStore.getState().getTotal()).toBe(48);
    expect(usePOSStore.getState().cart[0]!.discount).toEqual({ type: 'percent', value: 10 });
  });

  it('per-line type selector switches to a fixed amount, keeping the value', () => {
    render(<Harness />);
    const [input] = screen.getAllByLabelText('Отстъпка за артикул');
    fireEvent.change(input!, { target: { value: '5' } });
    const [type] = screen.getAllByLabelText('Тип отстъпка за артикул');
    fireEvent.change(type!, { target: { value: 'fixed' } });
    expect(usePOSStore.getState().cart[0]!.discount).toEqual({ type: 'fixed', value: 5 });
    expect(usePOSStore.getState().getTotal()).toBe(45);
  });

  it('clearing the line discount removes it', () => {
    render(<Harness />);
    const [input] = screen.getAllByLabelText('Отстъпка за артикул');
    fireEvent.change(input!, { target: { value: '10' } });
    fireEvent.change(input!, { target: { value: '' } });
    expect(usePOSStore.getState().cart[0]!.discount).toBeUndefined();
    expect(screen.queryByText('Отстъпки по артикули')).not.toBeInTheDocument();
  });

  it('sale-level discount applies after line discounts and shows in totals', () => {
    render(<Harness />);
    fireEvent.change(screen.getAllByLabelText('Отстъпка за артикул')[0]!, {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByPlaceholderText('Отстъпка', { exact: true }), {
      target: { value: '10' },
    });
    // net after line discount 48, 10% sale discount = 4.8 -> 43.2
    expect(usePOSStore.getState().getDiscountAmount()).toBeCloseTo(4.8, 2);
    expect(usePOSStore.getState().getTotal()).toBeCloseTo(43.2, 2);
    expect(screen.getByText('Отстъпка')).toBeInTheDocument();
  });

  it('caps a line discount at 50% of that line', () => {
    render(<Harness />);
    fireEvent.change(screen.getAllByLabelText('Отстъпка за артикул')[0]!, {
      target: { value: '90' },
    });
    // line of 20 can lose at most 10 -> total 40
    expect(usePOSStore.getState().getTotal()).toBe(40);
  });

  it('caps the sale discount at 50% (percent and fixed)', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Отстъпка', { exact: true });
    fireEvent.change(input, { target: { value: '80' } });
    expect(usePOSStore.getState().getTotal()).toBe(25);
    const select = screen.getAllByRole('combobox').at(-1)!;
    fireEvent.change(select, { target: { value: 'fixed' } });
    fireEvent.change(input, { target: { value: '999' } });
    expect(usePOSStore.getState().getTotal()).toBe(25);
    expect(usePOSStore.getState().getDiscountAmount()).toBe(25);
  });

  it('cash: Завърши stays disabled until tendered covers the discounted total', () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText('Отстъпка', { exact: true }), {
      target: { value: '20' },
    }); // total 40
    expect(done()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Платена сума'), { target: { value: '39' } });
    expect(done()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Платена сума'), { target: { value: '50' } });
    expect(done()).toBeEnabled();
    expect(text()).toContain('Ресто');
  });

  describe('split payment', () => {
    const toggle = (): void => {
      fireEvent.click(screen.getByText('Раздели плащането'));
    };

    it('toggle shows two editable rows, hides the cash input, and toggles back', () => {
      render(<Harness />);
      toggle();
      expect(screen.getAllByLabelText('Сума')).toHaveLength(2);
      expect(screen.queryByPlaceholderText('Платена сума')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Едно плащане'));
      expect(usePOSStore.getState().splitPayments).toBeNull();
      expect(screen.getByPlaceholderText('Платена сума')).toBeInTheDocument();
    });

    it('shows remaining while underpaid and gates Завърши', () => {
      render(<Harness />);
      toggle();
      const [a] = screen.getAllByLabelText('Сума');
      fireEvent.change(a!, { target: { value: '20' } });
      expect(text()).toContain('Остава:');
      expect(done()).toBeDisabled();
    });

    it('card + cash covering the total is valid; cash overpay shows change', () => {
      render(<Harness />);
      toggle();
      const [cash, card] = screen.getAllByLabelText('Сума');
      fireEvent.change(card!, { target: { value: '20' } });
      fireEvent.change(cash!, { target: { value: '40' } });
      expect(text()).toContain('Ресто:');
      expect(text()).not.toContain('Остава:');
      expect(done()).toBeEnabled();
    });

    it('overpaying with card is invalid (no change from non-cash)', () => {
      render(<Harness />);
      toggle();
      const [cash, card] = screen.getAllByLabelText('Сума');
      fireEvent.change(cash!, { target: { value: '0' } });
      fireEvent.change(card!, { target: { value: '60' } });
      expect(done()).toBeDisabled();
    });

    it('add and remove payment rows; method is editable', () => {
      render(<Harness />);
      toggle();
      fireEvent.click(screen.getByText('+ Добави плащане'));
      expect(screen.getAllByLabelText('Сума')).toHaveLength(3);
      fireEvent.change(screen.getAllByLabelText('Метод на плащане')[0]!, {
        target: { value: 'other' },
      });
      expect(usePOSStore.getState().splitPayments![0]!.method).toBe('other');
      fireEvent.click(screen.getAllByLabelText('Премахни плащане')[0]!);
      expect(screen.getAllByLabelText('Сума')).toHaveLength(2);
      act(() => usePOSStore.getState().setSplitPayments([{ method: 'cash', amount: 0 }]));
      expect(screen.queryByLabelText('Премахни плащане')).not.toBeInTheDocument();
    });
  });
});
