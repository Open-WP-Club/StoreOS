import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReorderReportModal from '../ReorderReportModal';
import type { Order, Product } from '../../types';

const products = [
  {
    id: 1,
    name: 'Widget',
    sku: 'W1',
    manage_stock: true,
    stock_quantity: 2,
    meta_data: [{ id: 1, key: '_supplier', value: 'Acme' }],
  },
] as unknown as Product[];
const orders = [
  {
    status: 'completed',
    date_created: new Date().toISOString(),
    line_items: [{ product_id: 1, variation_id: 0, quantity: 30 }],
  },
] as unknown as Order[];

const renderModal = (isOpen = true, onClose = vi.fn()): void => {
  render(
    <ReorderReportModal
      isOpen={isOpen}
      onClose={onClose}
      products={products}
      orders={orders}
      lowStockThreshold={5}
      storeName="Shop"
    />
  );
};

describe('ReorderReportModal', () => {
  it('renders nothing when closed', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows supplier and suggested qty, updates with target days, allows edits', () => {
    renderModal();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    const qty = screen.getByLabelText('Reorder quantity for Widget') as HTMLInputElement;
    expect(qty.value).toBe('28'); // 1/day * 30 - 2
    fireEvent.change(screen.getByLabelText('Target cover (days)'), { target: { value: '60' } });
    expect((screen.getByLabelText('Reorder quantity for Widget') as HTMLInputElement).value).toBe(
      '58'
    );
    fireEvent.change(screen.getByLabelText('Reorder quantity for Widget'), {
      target: { value: '10' },
    });
    expect((screen.getByLabelText('Reorder quantity for Widget') as HTMLInputElement).value).toBe(
      '10'
    );
  });

  it('calls onClose', () => {
    const onClose = vi.fn();
    renderModal(true, onClose);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
