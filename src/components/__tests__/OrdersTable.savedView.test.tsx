import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useCallback, useState } from 'react';
import OrdersTable from '../OrdersTable';
import { useApplySavedView } from '../../hooks/useApplySavedView';
import useSearch from '../../stores/searchStore';
import { ORDER_COLUMNS, ORDER_SORT, normalizeHidden, normalizeSort } from '../../utils/listView';
import type { FilterPreset, Order, SortState } from '../../types';

const order = {
  id: 1,
  total: '10.00',
  currency_symbol: '$',
  date_created: '2024-01-01T00:00:00',
  status: 'pending',
  billing: { first_name: 'Ann', last_name: 'Lee', email: 'a@b.c' },
} as unknown as Order;

// Mirrors OrdersPage's applyView wiring (the page itself is too heavy to render).
function Harness() {
  const [sort, setSort] = useState<SortState | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const apply = useCallback((p: FilterPreset) => {
    setSort(normalizeSort(p.sort, Object.keys(ORDER_SORT)));
    setHidden(
      normalizeHidden(
        p.hiddenColumns,
        ORDER_COLUMNS.map((c) => c.key)
      )
    );
  }, []);
  useApplySavedView(apply);
  return (
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
      sort={sort}
      onSort={setSort}
      hiddenColumns={hidden}
    />
  );
}

it('applying a saved view sets sort and hidden columns on the table', () => {
  const preset: FilterPreset = {
    id: 'v1',
    name: 'v',
    type: 'orders',
    filters: {},
    sort: { key: 'total', dir: 'desc' },
    hiddenColumns: ['customer', 'bogus'],
    storeId: null,
    createdAt: '',
  };
  useSearch.setState({ savedFilterPresets: [preset] });
  render(
    <MemoryRouter initialEntries={['/orders?view=v1']}>
      <Harness />
    </MemoryRouter>
  );
  expect(screen.queryByText('Customer')).toBeNull();
  expect(screen.getByText('Date')).toBeInTheDocument();
  expect(screen.getByText('Total').closest('th')).toHaveAttribute('aria-sort', 'descending');
});
