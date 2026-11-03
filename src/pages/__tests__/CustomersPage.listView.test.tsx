import { vi, Mock } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomersPage from '../CustomersPage';
import { useStoreConfig, useCache } from '../../stores';
import useSearch from '../../stores/searchStore';
import { createMockStore, createMockCustomer } from '../../__test_utils__';
import type { FilterPreset } from '../../types';

vi.mock('../../stores', () => ({ useStoreConfig: vi.fn(), useCache: vi.fn() }));
vi.mock('../../services/woocommerce');
vi.mock('../../components/FilterPresetManager', () => ({ default: () => null }));
vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: () => ({ loadingState: { isLoading: false, progress: 0 } }),
}));

const customers = [
  createMockCustomer({ id: 1, first_name: 'Bob', last_name: 'B', orders_count: 1 }),
  createMockCustomer({ id: 2, first_name: 'Amy', last_name: 'A', orders_count: 9 }),
  createMockCustomer({ id: 3, first_name: 'Cat', last_name: 'C', orders_count: 5 }),
];
const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.querySelector('td')?.textContent?.trim().slice(0, 3));

beforeEach(() => {
  const store = createMockStore();
  (useStoreConfig as unknown as Mock).mockImplementation((sel?: (s: unknown) => unknown) => {
    const state = { getCurrentStore: () => store };
    return sel ? sel(state) : state;
  });
  const state = {
    cache: { customers: { data: customers } },
    getCachedData: vi.fn().mockResolvedValue(customers),
    setCachedData: vi.fn(),
    clearCacheForType: vi.fn(),
  };
  (useCache as unknown as Mock).mockImplementation((sel?: (s: unknown) => unknown) =>
    sel ? sel(state) : state
  );
});

const preset = (extra: Partial<FilterPreset>): FilterPreset => ({
  id: 'v1',
  name: 'v',
  type: 'customers',
  filters: {},
  storeId: null,
  createdAt: '',
  ...extra,
});

const renderPage = (entry = '/customers') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <CustomersPage />
    </MemoryRouter>
  );

describe('CustomersPage list view', () => {
  it('sorts by clicking headers (asc then desc)', () => {
    useSearch.setState({ savedFilterPresets: [] });
    renderPage();
    fireEvent.click(
      within(screen.getByRole('columnheader', { name: /Orders/ })).getByRole('button')
    );
    expect(names()).toEqual(['Bob', 'Cat', 'Amy']);
    fireEvent.click(
      within(screen.getByRole('columnheader', { name: /Orders/ })).getByRole('button')
    );
    expect(names()).toEqual(['Amy', 'Cat', 'Bob']);
  });

  it('Columns menu hides a column', () => {
    useSearch.setState({ savedFilterPresets: [] });
    renderPage();
    fireEvent.click(screen.getByText('Columns'));
    fireEvent.click(screen.getByLabelText('Email'));
    expect(screen.queryByRole('columnheader', { name: 'Email' })).toBeNull();
  });

  it('applies sort and hidden columns from a saved view', () => {
    useSearch.setState({
      savedFilterPresets: [
        preset({ sort: { key: 'orders', dir: 'desc' }, hiddenColumns: ['phone', 'nope'] }),
      ],
    });
    renderPage('/customers?view=v1');
    expect(names()).toEqual(['Amy', 'Cat', 'Bob']);
    expect(screen.queryByRole('columnheader', { name: 'Phone' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
  });

  it('legacy view without sort/hiddenColumns resets to defaults', () => {
    useSearch.setState({ savedFilterPresets: [preset({ search: 'a', pageSize: 10 })] });
    renderPage('/customers?view=v1');
    expect(screen.getByRole('columnheader', { name: 'Phone' })).toBeInTheDocument();
  });
});
