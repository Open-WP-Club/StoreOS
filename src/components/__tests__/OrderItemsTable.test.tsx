import { vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderItemsTable } from '../OrderItemsTable';
import { createMockOrder, createMockLineItem } from '../../__test_utils__/mockFactories';
import { formatPrice } from '../../utils/currency';
import type { ProductImage } from '../../types';

vi.mock('../../utils/currency');

beforeEach(() => {
  (formatPrice as Mock).mockImplementation((val, sym) => `${sym || '$'}${Number(val).toFixed(2)}`);
});

function createOrder(overrides = {}) {
  return createMockOrder({
    currency_symbol: '$',
    line_items: [
      createMockLineItem({
        id: 1,
        name: 'Widget',
        sku: 'WDG-01',
        price: 25,
        quantity: 2,
        subtotal: '50.00',
        total: '50.00',
        image: { src: 'https://img.com/widget.jpg' } as ProductImage,
      }),
    ],
    total: '50.00',
    ...overrides,
  });
}

describe('OrderItemsTable', () => {
  it('renders header', () => {
    render(<OrderItemsTable order={createOrder()} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Order Items')).toBeInTheDocument();
  });

  it('renders line item details', () => {
    render(<OrderItemsTable order={createOrder()} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('SKU: WDG-01')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders product image when available', () => {
    render(<OrderItemsTable order={createOrder()} onOpenLightbox={vi.fn()} />);
    const img = screen.getByAltText('Widget');
    expect(img).toHaveAttribute('src', 'https://img.com/widget.jpg');
  });

  it('renders placeholder when no image', () => {
    const order = createOrder({
      line_items: [createMockLineItem({ image: undefined })],
    });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls onOpenLightbox with item index when image clicked', () => {
    const onOpenLightbox = vi.fn();
    render(<OrderItemsTable order={createOrder()} onOpenLightbox={onOpenLightbox} />);
    const button = screen.getByTitle('Виж Widget');
    fireEvent.click(button);
    expect(onOpenLightbox).toHaveBeenCalledWith(0);
  });

  it('renders meta data when present', () => {
    const order = createOrder({
      line_items: [
        createMockLineItem({
          meta_data: [{ id: 1, key: 'Color', value: 'Red' }],
        }),
      ],
    });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Color: Red')).toBeInTheDocument();
  });

  it('renders order total', () => {
    render(<OrderItemsTable order={createOrder()} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Order Total:')).toBeInTheDocument();
  });

  it('renders coupon lines when present', () => {
    const order = createOrder({
      coupon_lines: [{ id: 1, code: 'SAVE10', discount: '10.00', discount_tax: '0' }],
    });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText(/SAVE10/)).toBeInTheDocument();
  });

  it('hides coupon section when no coupons', () => {
    const order = createOrder({ coupon_lines: [] });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.queryByText(/Coupon/)).not.toBeInTheDocument();
  });

  it('renders shipping total when > 0', () => {
    const order = createOrder({
      shipping_total: '5.00',
      shipping_lines: [{ id: 1, method_title: 'Flat Rate', method_id: 'flat', instance_id: '', total: '5.00', total_tax: '0', taxes: [], meta_data: [] }],
    });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText(/Flat Rate/)).toBeInTheDocument();
  });

  it('hides shipping when total is 0', () => {
    const order = createOrder({ shipping_total: '0.00' });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.queryByText(/Shipping/)).not.toBeInTheDocument();
  });

  it('renders tax when > 0', () => {
    const order = createOrder({ total_tax: '8.50' });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Tax:')).toBeInTheDocument();
  });

  it('hides tax when 0', () => {
    const order = createOrder({ total_tax: '0.00' });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.queryByText('Tax:')).not.toBeInTheDocument();
  });

  it('renders discount when > 0', () => {
    const order = createOrder({ discount_total: '15.00' });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Discount:')).toBeInTheDocument();
  });

  it('renders refund section when refunds exist', () => {
    const order = createOrder({
      refunds: [{ id: 1, total: '-10.00', reason: 'Damaged', date_created: '2026-01-15' }],
    });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Refunded:')).toBeInTheDocument();
  });

  it('handles empty line items', () => {
    const order = createOrder({ line_items: [] });
    render(<OrderItemsTable order={order} onOpenLightbox={vi.fn()} />);
    expect(screen.getByText('Order Total:')).toBeInTheDocument();
  });
});
