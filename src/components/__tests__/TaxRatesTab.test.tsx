import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaxRatesTab from '../TaxRatesTab';
import type { TaxRateFormData } from '../../pages/TaxPage';
import type { WooCommerceTaxRate } from '../../types';

const form: TaxRateFormData = {
  country: '',
  state: '',
  postcode: '',
  city: '',
  rate: '',
  name: '',
  priority: 1,
  compound: false,
  shipping: true,
  class: 'standard',
};

const rate: WooCommerceTaxRate = {
  id: 5,
  country: '',
  state: '',
  postcode: '',
  city: '',
  postcodes: [],
  cities: [],
  rate: '8.5',
  name: 'GST',
  priority: 3,
  compound: false,
  shipping: false,
  order: 1,
  class: '',
};

function setup(props: Partial<React.ComponentProps<typeof TaxRatesTab>> = {}) {
  const p = {
    taxRates: [rate],
    filteredRates: [rate],
    taxClasses: [{ slug: 'standard', name: 'Standard' }],
    filterClass: 'all',
    onFilterClassChange: vi.fn(),
    loadData: vi.fn(),
    loading: false,
    showRateForm: false,
    editingRateId: null,
    rateForm: form,
    onRateFormChange: vi.fn(),
    onCreateRate: vi.fn(),
    onSaveRate: vi.fn(),
    onCancelRateForm: vi.fn(),
    saving: false,
    onEditRate: vi.fn(),
    onDeleteRate: vi.fn(),
    ...props,
  };
  render(<TaxRatesTab {...p} />);
  return p;
}

describe('TaxRatesTab', () => {
  it('renders wildcard fallbacks and default class', () => {
    setup();
    expect(screen.getAllByText('*')).toHaveLength(2);
    expect(screen.getByText('8.5000%')).toBeInTheDocument();
    expect(screen.getByText('standard')).toBeInTheDocument();
    expect(screen.queryByText('Compound')).not.toBeInTheDocument();
    expect(screen.queryByText('Shipping')).not.toBeInTheDocument();
  });

  it('renders option badges', () => {
    setup({ filteredRates: [{ ...rate, compound: true, shipping: true }] });
    expect(screen.getByText('Compound')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
  });

  it('fires row and toolbar callbacks', async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(p.loadData).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /add tax rate/i }));
    expect(p.onCreateRate).toHaveBeenCalled();
    await user.selectOptions(screen.getAllByRole('combobox')[0]!, 'standard');
    expect(p.onFilterClassChange).toHaveBeenCalledWith('standard');
    const row = screen.getByText('GST').closest('tr')!;
    const [edit, del] = Array.from(row.querySelectorAll('button'));
    await user.click(edit!);
    expect(p.onEditRate).toHaveBeenCalledWith(rate);
    await user.click(del!);
    expect(p.onDeleteRate).toHaveBeenCalledWith(5);
  });

  it('disables refresh while loading', () => {
    setup({ loading: true });
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });

  it('shows empty state whose action creates a rate', async () => {
    const user = userEvent.setup();
    const p = setup({ filteredRates: [] });
    expect(screen.getByText('No tax rates found')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /add tax rate/i });
    await user.click(buttons[buttons.length - 1]!);
    expect(p.onCreateRate).toHaveBeenCalled();
  });

  it('emits form changes with transforms', async () => {
    const user = userEvent.setup();
    const p = setup({ showRateForm: true });
    expect(screen.getByText('New Tax Rate')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Country Code'), 'b');
    expect(p.onRateFormChange).toHaveBeenLastCalledWith({ ...form, country: 'B' });
    await user.type(screen.getByLabelText('State Code'), 'x');
    expect(p.onRateFormChange).toHaveBeenLastCalledWith({ ...form, state: 'x' });
    await user.type(screen.getByLabelText('Rate (%) *'), '1');
    expect(p.onRateFormChange).toHaveBeenLastCalledWith({ ...form, rate: '1' });
    await user.type(screen.getByLabelText('Tax Name'), 'n');
    await user.type(screen.getByLabelText('Postcode'), 'p');
    await user.type(screen.getByLabelText('City'), 'c');
    await user.click(screen.getByLabelText('Compound'));
    expect(p.onRateFormChange).toHaveBeenLastCalledWith({ ...form, compound: true });
    await user.click(screen.getByLabelText('Apply to shipping'));
    expect(p.onRateFormChange).toHaveBeenLastCalledWith({ ...form, shipping: false });
  });

  it('falls back to priority 1 for non-numeric input', async () => {
    const user = userEvent.setup();
    const p = setup({ showRateForm: true, rateForm: { ...form, priority: 4 } });
    await user.clear(screen.getByLabelText('Priority'));
    expect(p.onRateFormChange).toHaveBeenLastCalledWith({ ...form, priority: 1 });
  });

  it('form buttons: edit label, save, cancel, saving state', async () => {
    const user = userEvent.setup();
    const p = setup({ showRateForm: true, editingRateId: 5 });
    expect(screen.getByText('Edit Tax Rate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(p.onSaveRate).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onCancelRateForm).toHaveBeenCalled();
  });

  it('disables save while saving', () => {
    setup({ showRateForm: true, saving: true });
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });
});
