import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RefundModal } from '../RefundModal';
import { createMockOrder, createMockLineItem } from '../../__test_utils__/mockFactories';

const order = createMockOrder({
  currency_symbol: '$',
  line_items: [
    createMockLineItem({ id: 7, name: 'Widget', quantity: 2, total: '50.00', total_tax: '0.00' }),
  ],
});

describe('RefundModal', () => {
  it('disables Refund until something is selected, then submits payload', () => {
    const onSubmit = vi.fn();
    render(
      <RefundModal
        order={order}
        refunds={[]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const btn = screen.getByRole('button', { name: 'Refund' });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Quantity to refund for Widget'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByLabelText('Restock refunded items'));
    fireEvent.change(screen.getByLabelText('Refund reason'), { target: { value: 'Broken' } });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);

    expect(onSubmit).toHaveBeenCalledWith({
      amount: '25.00',
      reason: 'Broken',
      api_restock: false,
      api_refund: true,
      line_items: [{ id: 7, quantity: 1, refund_total: '25.00', refund_tax: [] }],
    });
  });

  it('sends api_refund false when gateway refund is unchecked', () => {
    const onSubmit = vi.fn();
    render(
      <RefundModal
        order={order}
        refunds={[]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    fireEvent.change(screen.getByLabelText('Quantity to refund for Widget'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByLabelText('Refund via payment gateway'));
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ api_refund: false });
  });

  it('clamps quantity to remaining and blocks over-refund amount', () => {
    const onSubmit = vi.fn();
    render(
      <RefundModal
        order={order}
        refunds={[]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const qty = screen.getByLabelText('Quantity to refund for Widget') as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '9' } });
    expect(qty.value).toBe('2');

    fireEvent.change(screen.getByLabelText('Amount to refund for Widget'), {
      target: { value: '60' },
    });
    expect(screen.getByRole('button', { name: 'Refund' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
