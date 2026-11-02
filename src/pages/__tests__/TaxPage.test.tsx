import { vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaxPage from '../TaxPage';
import { createMockStore } from '../../__test_utils__';
import { useStoreConfig } from '../../stores';
import type { WooCommerceTaxRate } from '../../types';

const m = vi.hoisted(() => ({
  getTaxRates: vi.fn(),
  getTaxClasses: vi.fn(),
  createTaxRate: vi.fn(),
  updateTaxRate: vi.fn(),
  deleteTaxRate: vi.fn(),
  createTaxClass: vi.fn(),
  deleteTaxClass: vi.fn(),
  showToast: vi.fn(),
  Service: vi.fn(),
}));

vi.mock('../../stores', () => ({ useStoreConfig: vi.fn() }));
vi.mock('../../services/woocommerce', () => ({ __esModule: true, default: m.Service }));
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], showToast: m.showToast, removeToast: vi.fn() }),
}));

const store = createMockStore();

const rate = (o: Partial<WooCommerceTaxRate> = {}): WooCommerceTaxRate => ({
  id: 1,
  country: 'BG',
  state: '',
  postcode: '',
  city: '',
  postcodes: [],
  cities: [],
  rate: '20.0000',
  name: 'VAT',
  priority: 1,
  compound: false,
  shipping: true,
  order: 1,
  class: '',
  ...o,
});

const classes = [
  { slug: 'standard', name: 'Standard' },
  { slug: 'reduced', name: 'Reduced' },
];

async function renderPage() {
  render(<TaxPage />);
  await waitFor(() => expect(screen.queryByText('Loading tax data...')).not.toBeInTheDocument());
}

describe('TaxPage', () => {
  beforeEach(() => {
    (useStoreConfig as unknown as Mock).mockImplementation((sel: (s: unknown) => unknown) =>
      sel({ getCurrentStore: () => store })
    );
    m.Service.mockImplementation(function () {
      return {
        getTaxRates: m.getTaxRates,
        getTaxClasses: m.getTaxClasses,
        createTaxRate: m.createTaxRate,
        updateTaxRate: m.updateTaxRate,
        deleteTaxRate: m.deleteTaxRate,
        createTaxClass: m.createTaxClass,
        deleteTaxClass: m.deleteTaxClass,
      };
    });
    m.getTaxRates.mockResolvedValue({
      success: true,
      data: [rate(), rate({ id: 2, country: 'DE', rate: '7', class: 'reduced', compound: true })],
    });
    m.getTaxClasses.mockResolvedValue({ success: true, data: classes });
    for (const k of [
      'createTaxRate',
      'updateTaxRate',
      'deleteTaxRate',
      'createTaxClass',
      'deleteTaxClass',
    ] as const) {
      m[k].mockResolvedValue({ success: true, data: {} });
    }
  });

  it('shows empty state without a store', () => {
    (useStoreConfig as unknown as Mock).mockImplementation((sel: (s: unknown) => unknown) =>
      sel({ getCurrentStore: () => null })
    );
    render(<TaxPage />);
    expect(screen.getByText('Please configure a store first.')).toBeInTheDocument();
    expect(m.getTaxRates).not.toHaveBeenCalled();
  });

  it('loads and renders rates with stats', async () => {
    await renderPage();
    expect(screen.getByText('Tax Rates (2)')).toBeInTheDocument();
    expect(screen.getByText('Tax Classes (2)')).toBeInTheDocument();
    expect(screen.getByText('20.0000%')).toBeInTheDocument();
    expect(screen.getByText('13.50%')).toBeInTheDocument(); // avg of 20 and 7
    expect(screen.getByText('Compound')).toBeInTheDocument();
  });

  it('toasts errors when loading fails (with and without message)', async () => {
    m.getTaxRates.mockResolvedValue({ success: false, error: '' });
    m.getTaxClasses.mockResolvedValue({ success: false, error: 'classes down' });
    await renderPage();
    expect(m.showToast).toHaveBeenCalledWith('Failed to load tax rates', 'error');
    expect(m.showToast).toHaveBeenCalledWith('classes down', 'error');
    expect(screen.getByText('No tax rates found')).toBeInTheDocument();
  });

  it('filters rates by class', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.selectOptions(screen.getAllByRole('combobox')[0]!, 'reduced');
    expect(screen.queryByText('20.0000%')).not.toBeInTheDocument();
    expect(screen.getByText('7.0000%')).toBeInTheDocument();
  });

  it('refresh reloads data', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(m.getTaxRates).toHaveBeenCalledTimes(2));
  });

  it('requires a rate before creating', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /add tax rate/i }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(m.showToast).toHaveBeenCalledWith('Tax rate is required', 'error');
    expect(m.createTaxRate).not.toHaveBeenCalled();
  });

  it('creates a rate and reloads', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /add tax rate/i }));
    expect(screen.getByText('New Tax Rate')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Country Code'), 'bg');
    await user.type(screen.getByLabelText('State Code'), 'S');
    await user.type(screen.getByLabelText('Rate (%) *'), '9');
    await user.type(screen.getByLabelText('Tax Name'), 'Reduced VAT');
    await user.type(screen.getByLabelText('Postcode'), '1000');
    await user.type(screen.getByLabelText('City'), 'Sofia');
    await user.selectOptions(screen.getByLabelText('Tax Class'), 'reduced');
    await user.clear(screen.getByLabelText('Priority'));
    await user.type(screen.getByLabelText('Priority'), '2');
    await user.click(screen.getByLabelText('Compound'));
    await user.click(screen.getByLabelText('Apply to shipping'));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(m.createTaxRate).toHaveBeenCalledWith({
        country: 'BG',
        state: 'S',
        postcode: '1000',
        city: 'Sofia',
        rate: '9',
        name: 'Reduced VAT',
        priority: 2,
        compound: true,
        shipping: false,
        class: 'reduced',
      })
    );
    expect(m.showToast).toHaveBeenCalledWith('Tax rate created', 'success');
    await waitFor(() => expect(m.getTaxRates).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('New Tax Rate')).not.toBeInTheDocument();
  });

  it('keeps the form open and toasts when create fails', async () => {
    m.createTaxRate.mockResolvedValue({ success: false, error: '' });
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /add tax rate/i }));
    await user.type(screen.getByLabelText('Rate (%) *'), '5');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(m.showToast).toHaveBeenCalledWith('Failed to save tax rate', 'error')
    );
    expect(screen.getByText('New Tax Rate')).toBeInTheDocument();
  });

  it('edits a rate', async () => {
    const user = userEvent.setup();
    await renderPage();
    const row = screen.getByText('20.0000%').closest('tr')!;
    await user.click(within(row).getAllByRole('button')[0]!);
    expect(screen.getByText('Edit Tax Rate')).toBeInTheDocument();
    expect(screen.getByLabelText('Rate (%) *')).toHaveValue('20.0000');
    expect(screen.getByLabelText('Tax Class')).toHaveValue('standard');
    await user.clear(screen.getByLabelText('Rate (%) *'));
    await user.type(screen.getByLabelText('Rate (%) *'), '21');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() =>
      expect(m.updateTaxRate).toHaveBeenCalledWith(1, expect.objectContaining({ rate: '21' }))
    );
    expect(m.showToast).toHaveBeenCalledWith('Tax rate updated', 'success');
  });

  it('cancels the rate form', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: /add tax rate/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('New Tax Rate')).not.toBeInTheDocument();
  });

  it('deletes a rate after confirmation', async () => {
    const user = userEvent.setup();
    await renderPage();
    const row = screen.getByText('20.0000%').closest('tr')!;
    await user.click(within(row).getAllByRole('button')[1]!);
    expect(screen.getByText('Delete Tax Rate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(m.deleteTaxRate).toHaveBeenCalledWith(1));
    expect(m.showToast).toHaveBeenCalledWith('Tax rate deleted', 'success');
    await waitFor(() => expect(screen.queryByText('Delete Tax Rate')).not.toBeInTheDocument());
  });

  it('toasts when delete fails and can cancel the dialog', async () => {
    m.deleteTaxRate.mockResolvedValue({ success: false, error: '' });
    const user = userEvent.setup();
    await renderPage();
    const row = screen.getByText('20.0000%').closest('tr')!;
    await user.click(within(row).getAllByRole('button')[1]!);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(m.deleteTaxRate).not.toHaveBeenCalled();
    await user.click(within(row).getAllByRole('button')[1]!);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('Failed to delete', 'error'));
  });

  describe('classes tab', () => {
    async function openClasses() {
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByRole('button', { name: /^Tax Classes/ }));
      return user;
    }

    it('lists classes with rate counts and protects the standard class', async () => {
      await openClasses();
      expect(screen.getByText('Built-in')).toBeInTheDocument();
      expect(screen.getAllByText('1 rate')).toHaveLength(2);
      expect(screen.getAllByTitle('Delete class')).toHaveLength(1);
    });

    it('validates and creates a class', async () => {
      const user = await openClasses();
      await user.click(screen.getByRole('button', { name: /add tax class/i }));
      await user.click(screen.getByRole('button', { name: 'Create' }));
      expect(m.showToast).toHaveBeenCalledWith('Class name is required', 'error');
      await user.type(screen.getByLabelText('Name *'), 'Zero');
      await user.click(screen.getByRole('button', { name: 'Create' }));
      await waitFor(() => expect(m.createTaxClass).toHaveBeenCalledWith({ name: 'Zero' }));
      expect(m.showToast).toHaveBeenCalledWith('Tax class created', 'success');
    });

    it('toasts a failed class create and cancels the form', async () => {
      m.createTaxClass.mockResolvedValue({ success: false, error: '' });
      const user = await openClasses();
      await user.click(screen.getByRole('button', { name: /add tax class/i }));
      await user.type(screen.getByLabelText('Name *'), 'Zero');
      await user.click(screen.getByRole('button', { name: 'Create' }));
      await waitFor(() =>
        expect(m.showToast).toHaveBeenCalledWith('Failed to create tax class', 'error')
      );
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText('New Tax Class')).not.toBeInTheDocument();
    });

    it('deletes a class', async () => {
      const user = await openClasses();
      await user.click(screen.getByTitle('Delete class'));
      expect(screen.getByText('Delete Tax Class')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(m.deleteTaxClass).toHaveBeenCalledWith('reduced'));
      expect(m.showToast).toHaveBeenCalledWith('Tax class deleted', 'success');
    });

    it('toasts a failed class delete', async () => {
      m.deleteTaxClass.mockResolvedValue({ success: false, error: 'in use' });
      const user = await openClasses();
      await user.click(screen.getByTitle('Delete class'));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('in use', 'error'));
    });

    it('shows empty state with no classes', async () => {
      m.getTaxClasses.mockResolvedValue({ success: true, data: [] });
      await openClasses();
      expect(screen.getByText('No tax classes found')).toBeInTheDocument();
    });
  });
});
