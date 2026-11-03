import { cloneElement } from 'react';
import { vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoriesPage from '../CategoriesPage';
import AttributesPage from '../AttributesPage';
import TaxPage from '../TaxPage';
import { createMockStore } from '../../__test_utils__';
import { useStoreConfig } from '../../stores';
import useOffline from '../../stores/offlineStore';
import { tempIdFor } from '../../utils/offlinePlaceholders';
import type { PendingOperationType } from '../../types';

const m = vi.hoisted(() => ({
  Service: vi.fn(),
  showToast: vi.fn(),
  removeToast: vi.fn(),
  api: {} as Record<string, Mock>,
}));

vi.mock('../../stores', () => ({ useStoreConfig: vi.fn() }));
vi.mock('../../services/woocommerce', () => ({ __esModule: true, default: m.Service }));
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], showToast: m.showToast, removeToast: m.removeToast }),
}));

const store = createMockStore();
let current = store;

// Categories/Attributes load when their loader callback changes identity,
// so swap the toast fn after mount to trigger the first load.
function renderLoaded(ui: React.ReactElement) {
  const r = render(ui);
  m.showToast = vi.fn(); // new identity -> page rebuilds its loader and loads
  r.rerender(cloneElement(ui));
  return r;
}
const ops = () => useOffline.getState().pendingOperations;
const queue = (type: PendingOperationType, data: Record<string, unknown>) => {
  const id = useOffline.getState().addPendingOperation(type, data, store.id);
  return { id, tempId: tempIdFor(id) };
};

const ok = (data: unknown) => vi.fn().mockResolvedValue({ success: true, data });

beforeEach(() => {
  useOffline.setState({ pendingOperations: [] });
  current = store;
  (useStoreConfig as unknown as Mock).mockImplementation((sel: (s: unknown) => unknown) =>
    sel({ getCurrentStore: () => current })
  );
  m.api = {
    getProductCategories: ok([]),
    deleteProductCategory: ok({}),
    updateProductCategory: ok({}),
    getProductAttributes: ok([]),
    getAttributeTerms: ok([]),
    deleteProductAttribute: ok({}),
    getTaxRates: ok([]),
    getTaxClasses: ok([{ slug: 'standard', name: 'Standard' }]),
    deleteTaxRate: ok({}),
    deleteTaxClass: ok({}),
    updateTaxRate: ok({}),
  };
  m.Service.mockImplementation(function () {
    return m.api;
  });
});

describe('CategoriesPage pending placeholders', () => {
  it('shows a queued category with a badge; deleting it cancels the create without an API call', async () => {
    const { tempId } = queue('create_category', { name: 'Offline Cat' });
    renderLoaded(<CategoriesPage />);
    const row = (await screen.findByText('Offline Cat')).closest('tr')!;
    expect(within(row).getByText('Pending sync')).toBeInTheDocument();

    await userEvent.click(within(row).getByTitle('Delete'));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' })).at(-1)!);

    await waitFor(() => expect(screen.queryByText('Offline Cat')).not.toBeInTheDocument());
    expect(ops()).toHaveLength(0);
    expect(m.api.deleteProductCategory).not.toHaveBeenCalled();
    expect(tempId).toBeLessThan(0);
  });

  it('does not offer a pending category as a parent', async () => {
    queue('create_category', { name: 'Offline Cat' });
    m.api.getProductCategories = ok([
      { id: 5, name: 'Real', slug: 'real', parent: 0, count: 0, display: 'default' },
    ]);
    renderLoaded(<CategoriesPage />);
    await screen.findByText('Offline Cat');
    await userEvent.click(screen.getByRole('button', { name: /add category/i }));
    const parent = await screen.findByLabelText(/parent/i);
    const labels = within(parent)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toContain('Real');
    expect(labels).not.toContain('Offline Cat');
  });
});

describe('AttributesPage pending placeholders', () => {
  it('shows pending attributes and their terms; no term fetch for a pending attribute', async () => {
    const attr = queue('create_attribute', { name: 'Color', slug: 'color' });
    renderLoaded(<AttributesPage />);
    const title = await screen.findByText('Color');
    expect(screen.getByText('Pending sync')).toBeInTheDocument();
    // a pending attribute cannot take terms yet
    expect(screen.queryByRole('button', { name: /^Term$/ })).not.toBeInTheDocument();

    await userEvent.click(title);
    expect(await screen.findByText(/once this attribute has synced/i)).toBeInTheDocument();
    expect(m.api.getAttributeTerms).not.toHaveBeenCalled();
    expect(attr.tempId).toBeLessThan(0);
  });

  it('shows a queued term under a real attribute', async () => {
    m.api.getProductAttributes = ok([
      { id: 3, name: 'Size', slug: 'size', type: 'select', order_by: 'menu_order' },
    ]);
    queue('create_attribute_term', { attributeId: 3, name: 'XL' });
    queue('create_attribute_term', { attributeId: 4, name: 'Other' });
    renderLoaded(<AttributesPage />);
    await userEvent.click(await screen.findByText('Size'));
    expect(await screen.findByText('XL')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
    expect(screen.getByText('Pending sync')).toBeInTheDocument();
  });

  it('deleting a pending attribute cancels the queued create', async () => {
    queue('create_attribute', { name: 'Color', slug: 'color' });
    renderLoaded(<AttributesPage />);
    const header = (await screen.findByText('Color')).closest(
      'div.flex.items-center.justify-between'
    )!;
    const buttons = within(header as HTMLElement).getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]!); // trash
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' })).at(-1)!);
    await waitFor(() => expect(ops()).toHaveLength(0));
    expect(m.api.deleteProductAttribute).not.toHaveBeenCalled();
  });
});

describe('TaxPage pending placeholders', () => {
  it('shows a pending rate and deleting it cancels the queued create', async () => {
    queue('create_tax_rate', { name: 'Offline VAT', rate: '20', country: 'BG' });
    render(<TaxPage />);
    const cell = await screen.findByText('Offline VAT');
    const row = cell.closest('tr')!;
    expect(within(row).getByText('Pending sync')).toBeInTheDocument();

    const buttons = within(row).getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]!);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' })).at(-1)!);
    await waitFor(() => expect(ops()).toHaveLength(0));
    expect(m.api.deleteTaxRate).not.toHaveBeenCalled();
    expect(await screen.findByText(/Tax Rates \(0\)/)).toBeInTheDocument();
  });

  it('shows a pending tax class and deleting it cancels the queued create', async () => {
    queue('create_tax_class', { name: 'Reduced Rate' });
    render(<TaxPage />);
    await screen.findByText(/Tax Classes \(2\)/);
    await userEvent.click(screen.getByText(/Tax Classes \(2\)/));
    const row = (await screen.findByText('Reduced Rate')).closest('tr')!;
    expect(within(row).getByText('Pending sync')).toBeInTheDocument();

    const buttons = within(row).getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]!);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' })).at(-1)!);
    await waitFor(() => expect(ops()).toHaveLength(0));
    expect(m.api.deleteTaxClass).not.toHaveBeenCalled();
  });

  it('a real class with the same slug as a queued create is not shown twice', async () => {
    queue('create_tax_class', { name: 'Standard' });
    render(<TaxPage />);
    await screen.findByText(/Tax Classes \(1\)/);
    expect(screen.queryByText('Pending sync')).not.toBeInTheDocument();
  });
});
