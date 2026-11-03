import { vi, Mock, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomersPage from '../CustomersPage';
import { useStoreConfig, useCache } from '../../stores';
import useSearch from '../../stores/searchStore';
import useCustomerNotes from '../../stores/customerNotesStore';
import {
  createMockStore,
  createMockCustomer,
  createMockOrder,
  createMockBilling,
} from '../../__test_utils__';

vi.mock('../../stores', () => ({ useStoreConfig: vi.fn(), useCache: vi.fn() }));
vi.mock('../../services/woocommerce');
vi.mock('../../components/FilterPresetManager', () => ({ default: () => null }));
vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: () => ({ loadingState: { isLoading: false, progress: 0 } }),
}));

const store = createMockStore();
const phone = (n: string) => createMockBilling({ phone: `+359 ${n}${n}${n} ${n}${n}${n}` });
const customers = [
  createMockCustomer({
    id: 1,
    first_name: 'Ann',
    last_name: 'Lee',
    email: 'ann@test.com',
    total_spent: '100',
    billing: phone('1'),
  }),
  createMockCustomer({
    id: 2,
    first_name: 'Bob',
    last_name: 'Ray',
    email: 'bob@test.com',
    total_spent: '10',
    billing: phone('2'),
  }),
  // same email as Ann (plus-tag normalised) -> duplicate group
  createMockCustomer({
    id: 3,
    first_name: 'Annie',
    last_name: 'Lee',
    email: 'ann+shop@test.com',
    total_spent: '5',
    billing: phone('3'),
  }),
];
const orders = [
  createMockOrder({ id: 10, customer_id: 1, total: '40.00', status: 'completed' }),
  createMockOrder({ id: 11, customer_id: 1, total: '60.00', status: 'completed' }),
  createMockOrder({ id: 12, customer_id: 2, total: '99.00', status: 'completed' }),
];

beforeEach(() => {
  (useStoreConfig as unknown as Mock).mockImplementation((sel?: (s: unknown) => unknown) => {
    const state = { getCurrentStore: () => store };
    return sel ? sel(state) : state;
  });
  const state = {
    cache: { customers: { data: customers }, orders: { data: orders } },
    getCachedData: vi.fn().mockResolvedValue(customers),
    setCachedData: vi.fn(),
    clearCacheForType: vi.fn(),
  };
  (useCache as unknown as Mock).mockImplementation((sel?: (s: unknown) => unknown) =>
    sel ? sel(state) : state
  );
  useSearch.setState({ savedFilterPresets: [] });
  useCustomerNotes.setState({ byStore: {} });
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CustomersPage />
    </MemoryRouter>
  );

const dataRows = () => screen.getAllByRole('row').slice(1);

describe('CustomersPage tags, duplicates and profile extras', () => {
  it('hides the tag filter when no customer has a tag', () => {
    renderPage();
    expect(screen.queryByLabelText('Filter by tag')).not.toBeInTheDocument();
  });

  it('tag filter lists known tags and narrows the table', () => {
    useCustomerNotes.getState().addTag(store.id, 2, 'vip');
    useCustomerNotes.getState().addTag(store.id, 3, 'Wholesale');
    renderPage();
    const select = screen.getByLabelText('Filter by tag');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['All tags', 'vip', 'wholesale']);
    expect(dataRows()).toHaveLength(3);
    fireEvent.change(select, { target: { value: 'vip' } });
    expect(dataRows()).toHaveLength(1);
    expect(dataRows()[0]).toHaveTextContent('Bob');
    fireEvent.change(select, { target: { value: '' } });
    expect(dataRows()).toHaveLength(3);
  });

  it('Find duplicates opens the modal with the matching group, and closes again', () => {
    renderPage();
    expect(screen.queryByText('Possible duplicate customers')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Find duplicates' }));
    expect(screen.getByText('Possible duplicate customers')).toBeInTheDocument();
    const groups = screen.getAllByTestId('duplicate-group');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveTextContent('Matched by email');
    expect(groups[0]).toHaveTextContent('#1 Ann Lee');
    expect(groups[0]).toHaveTextContent('(primary)');
    expect(groups[0]).not.toHaveTextContent('Bob');
    // marking tags only the non-primary customer, locally
    fireEvent.click(within(groups[0]!).getByRole('button', { name: 'Mark as duplicate' }));
    expect(useCustomerNotes.getState().byStore[store.id]?.[3]?.tags).toEqual(['duplicate']);
    expect(useCustomerNotes.getState().byStore[store.id]?.[1]).toBeUndefined();
  });

  it('customer detail modal shows profile extras from cached orders and edits tags/notes', () => {
    renderPage();
    fireEvent.click(screen.getByText('Ann Lee'));
    const extras = screen.getByTestId('customer-profile-extras');
    expect(within(extras).getByTestId('profile-orders')).toHaveTextContent('2');
    expect(within(extras).getByTestId('profile-ltv')).toHaveTextContent('100.00');

    fireEvent.change(within(extras).getByLabelText('New tag'), { target: { value: ' VIP ' } });
    fireEvent.click(within(extras).getByRole('button', { name: 'Add' }));
    expect(within(extras).getByText('vip')).toBeInTheDocument();
    expect(useCustomerNotes.getState().byStore[store.id]?.[1]?.tags).toEqual(['vip']);

    fireEvent.change(within(extras).getByLabelText('Customer notes'), {
      target: { value: 'pays late' },
    });
    expect(useCustomerNotes.getState().byStore[store.id]?.[1]?.notes).toBe('pays late');

    fireEvent.click(within(extras).getByLabelText('Remove tag vip'));
    expect(within(extras).queryByText('vip')).not.toBeInTheDocument();
  });
});
