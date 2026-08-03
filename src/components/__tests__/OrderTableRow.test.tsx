import { vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrderTableRow from '../OrderTableRow';
import { createMockOrder } from '../../__test_utils__/mockFactories';
import { formatPrice } from '../../utils/currency';
import { formatDate } from '../../utils/dateTime';

vi.mock('../../utils/currency');
vi.mock('../../utils/dateTime');
vi.mock('../../constants', () => ({
  getOrderStatusColor: (status: string) => `color-${status}`,
}));

beforeEach(() => {
  (formatPrice as Mock).mockImplementation((val, sym) => `${sym || '$'}${val}`);
  (formatDate as Mock).mockReturnValue('2026-01-15');
});

function renderRow(overrides = {}, isSelected = false, onSelect = vi.fn()) {
  const order = createMockOrder({
    id: 42,
    billing: {
      first_name: 'Alice',
      last_name: 'Wonder',
      email: 'alice@test.com',
      address_1: '',
      address_2: '',
      city: '',
      state: '',
      postcode: '',
      country: '',
      company: '',
      phone: '',
    },
    total: '99.50',
    currency_symbol: '€',
    status: 'processing',
    date_created: '2026-01-15T10:00:00',
    ...overrides,
  });

  return render(
    <MemoryRouter>
      <table>
        <tbody>
          <OrderTableRow order={order} isSelected={isSelected} onSelect={onSelect} />
        </tbody>
      </table>
    </MemoryRouter>
  );
}

describe('OrderTableRow', () => {
  it('renders order ID as a link', () => {
    renderRow();
    const link = screen.getByText('#42');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/orders/42');
  });

  it('renders customer name and email', () => {
    renderRow();
    expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('renders formatted date', () => {
    renderRow();
    expect(formatDate).toHaveBeenCalledWith('2026-01-15T10:00:00');
    expect(screen.getByText('2026-01-15')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    renderRow();
    const badge = screen.getByText('processing');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('color-processing');
  });

  it('renders formatted price with currency symbol', () => {
    renderRow();
    expect(formatPrice).toHaveBeenCalledWith('99.50', '€');
  });

  it('renders View Details link', () => {
    renderRow();
    const link = screen.getByText('View Details');
    expect(link.closest('a')).toHaveAttribute('href', '/orders/42');
  });

  it('calls onSelect when checkbox clicked', () => {
    const onSelect = vi.fn();
    renderRow({}, false, onSelect);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onSelect).toHaveBeenCalledWith(42);
  });

  it('checkbox reflects isSelected prop', () => {
    renderRow({}, true);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('checkbox is unchecked when isSelected is false', () => {
    renderRow({}, false);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
