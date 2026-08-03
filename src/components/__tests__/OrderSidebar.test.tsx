import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderSidebar } from '../OrderSidebar';
import { createMockOrder } from '../../__test_utils__/mockFactories';

function createOrder(overrides = {}) {
  return createMockOrder({
    id: 42,
    number: '42',
    status: 'processing',
    billing: {
      first_name: 'Alice',
      last_name: 'Wonder',
      company: 'Acme Corp',
      address_1: '123 Main St',
      address_2: 'Suite 4',
      city: 'Sofia',
      state: 'SF',
      postcode: '1000',
      country: 'BG',
      email: 'alice@test.com',
      phone: '+359888123456',
    },
    shipping: {
      first_name: 'Bob',
      last_name: 'Ship',
      company: '',
      address_1: '456 Port Ave',
      address_2: '',
      city: 'Varna',
      state: 'VN',
      postcode: '9000',
      country: 'BG',
      phone: '',
    },
    payment_method_title: 'Credit Card',
    transaction_id: 'TX-789',
    date_paid: '2026-01-15T10:00:00',
    date_completed: '2026-01-16T12:00:00',
    date_created: '2026-01-14T08:00:00',
    date_modified: '2026-01-16T12:00:00',
    customer_id: 5,
    customer_ip_address: '192.168.1.1',
    customer_user_agent: 'Mozilla/5.0',
    ...overrides,
  });
}

describe('OrderSidebar', () => {
  describe('Order Actions', () => {
    it('renders status select with current status', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      const select = screen.getByLabelText('Update Status') as HTMLSelectElement;
      expect(select.value).toBe('processing');
    });

    it('calls onStatusUpdate when status changes', () => {
      const onStatusUpdate = vi.fn();
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={onStatusUpdate} />);
      fireEvent.change(screen.getByLabelText('Update Status'), { target: { value: 'completed' } });
      expect(onStatusUpdate).toHaveBeenCalledWith('completed');
    });

    it('disables select when updatingStatus', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={true} onStatusUpdate={vi.fn()} />);
      expect(screen.getByLabelText('Update Status')).toBeDisabled();
    });

    it('shows "Updating..." when updatingStatus', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={true} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });

    it('hides "Updating..." when not updating', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
    });
  });

  describe('Customer Details', () => {
    it('renders billing name', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
    });

    it('renders billing company', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('renders billing address', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('Suite 4')).toBeInTheDocument();
    });

    it('renders email as mailto link', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      const emailLink = screen.getByText('alice@test.com');
      expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:alice@test.com');
    });

    it('renders phone as tel link', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      const phoneLink = screen.getByText('+359888123456');
      expect(phoneLink.closest('a')).toHaveAttribute('href', 'tel:+359888123456');
    });

    it('renders shipping address when present', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('Shipping Address')).toBeInTheDocument();
      expect(screen.getByText('Bob Ship')).toBeInTheDocument();
      expect(screen.getByText('456 Port Ave')).toBeInTheDocument();
    });

    it('hides shipping address when no shipping data', () => {
      const order = createOrder({
        shipping: {
          first_name: '',
          last_name: '',
          company: '',
          address_1: '',
          address_2: '',
          city: '',
          state: '',
          postcode: '',
          country: '',
          phone: '',
        },
      });
      render(<OrderSidebar order={order} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.queryByText('Shipping Address')).not.toBeInTheDocument();
    });
  });

  describe('Payment Details', () => {
    it('renders payment method', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('Credit Card')).toBeInTheDocument();
    });

    it('renders transaction ID', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('TX-789')).toBeInTheDocument();
    });

    it('shows "Paid" when date_paid exists', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });

    it('shows "Unpaid" when no date_paid', () => {
      const order = createOrder({ date_paid: null });
      render(<OrderSidebar order={order} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('Unpaid')).toBeInTheDocument();
    });

    it('hides payment method when not set', () => {
      const order = createOrder({ payment_method_title: '' });
      render(<OrderSidebar order={order} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.queryByText('Payment Method:')).not.toBeInTheDocument();
    });

    it('hides transaction ID when not set', () => {
      const order = createOrder({ transaction_id: '' });
      render(<OrderSidebar order={order} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.queryByText('Transaction ID:')).not.toBeInTheDocument();
    });
  });

  describe('Order Information', () => {
    it('renders order number', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('#42')).toBeInTheDocument();
    });

    it('renders customer ID when > 0', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('hides customer ID when 0', () => {
      const order = createOrder({ customer_id: 0 });
      render(<OrderSidebar order={order} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.queryByText('Customer ID:')).not.toBeInTheDocument();
    });

    it('renders customer IP', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });

    it('renders user agent', () => {
      render(<OrderSidebar order={createOrder()} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.getByText('Mozilla/5.0')).toBeInTheDocument();
    });

    it('hides customer IP when not set', () => {
      const order = createOrder({ customer_ip_address: '' });
      render(<OrderSidebar order={order} updatingStatus={false} onStatusUpdate={vi.fn()} />);
      expect(screen.queryByText('Customer IP:')).not.toBeInTheDocument();
    });
  });
});
