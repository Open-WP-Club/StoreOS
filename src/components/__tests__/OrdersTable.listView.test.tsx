import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrdersTable from '../OrdersTable';
import type { Order } from '../../types';

const order = {
  id: 7,
  total: '12.00',
  currency_symbol: '$',
  date_created: '2024-01-01T00:00:00',
  status: 'pending',
  billing: { first_name: 'Ann', last_name: 'Lee', email: 'a@b.c' },
} as unknown as Order;

const renderTable = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <OrdersTable
        paginatedOrders={[order]}
        selectedOrderIds={[]}
        onSelectAll={vi.fn()}
        onSelectOrder={vi.fn()}
        onStatusChange={vi.fn()}
        currentPage={1}
        totalItems={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('OrdersTable sort + columns', () => {
  it('shows all columns by default', () => {
    renderTable();
    for (const h of ['Customer', 'Date', 'Status', 'Total']) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it('hides optional columns (header and cells)', () => {
    renderTable({ hiddenColumns: ['customer', 'total'] });
    expect(screen.queryByText('Customer')).toBeNull();
    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByText(/Ann Lee/)).toBeNull();
    expect(screen.queryByText('$12.00')).toBeNull();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('clicking a sortable header calls onSort and shows the direction', () => {
    const onSort = vi.fn();
    renderTable({ onSort, sort: { key: 'total', dir: 'desc' } });
    expect(screen.getByLabelText('descending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Date/ }));
    expect(onSort).toHaveBeenCalledWith({ key: 'date', dir: 'asc' });
    fireEvent.click(screen.getByRole('button', { name: /Total/ }));
    expect(onSort).toHaveBeenLastCalledWith(null);
  });
});
