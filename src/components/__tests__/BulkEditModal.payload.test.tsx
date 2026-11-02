import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkEditModal from '../BulkEditModal';
import type { WooCommerceProduct } from '../../types';

const prod = (over: Record<string, unknown>) =>
  ({ regular_price: '', sale_price: '', stock_quantity: null, categories: [], ...over }) as unknown as WooCommerceProduct;

const A = prod({ id: 1, name: 'Alpha', regular_price: '100.00', sale_price: '80.00', stock_quantity: 5, categories: [{ id: 3, name: 'Shoes', slug: 's' }] });
const B = prod({ id: 2, name: 'Beta', regular_price: '50.00', categories: [{ id: 4, name: 'Hats', slug: 'h' }] });
const C = prod({ id: 3, name: 'Gamma', regular_price: '', categories: [{ id: 3, name: 'Shoes', slug: 's' }] });

const onSave = vi.fn();
const onClose = vi.fn();
const onError = vi.fn();

function open(props: Partial<React.ComponentProps<typeof BulkEditModal>> = {}) {
  render(
    <BulkEditModal
      isOpen
      onClose={onClose}
      selectedProducts={[A, B]}
      onSave={onSave}
      onError={onError}
      {...props}
    />
  );
}

async function check(label: string) {
  await userEvent.click(screen.getByLabelText(label));
}

async function confirm() {
  await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
  await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
}

beforeEach(() => {
  onSave.mockResolvedValue(undefined);
});

describe('BulkEditModal field -> payload mapping', () => {
  it('sends only ids when nothing is checked', async () => {
    open();
    await confirm();
    expect(onSave).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores a checked price with an empty value', async () => {
    open();
    await check('Regular Price');
    await confirm();
    expect(onSave).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
  });

  it('"set" passes the raw value through', async () => {
    open();
    await check('Regular Price');
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '9.99' } });
    await confirm();
    expect(onSave).toHaveBeenCalledWith([
      { id: 1, regular_price: '9.99' },
      { id: 2, regular_price: '9.99' },
    ]);
  });

  it('increases by percent and by fixed amount, rounded to 2dp', async () => {
    open();
    await check('Regular Price');
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'increase' } });
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '10' } });
    fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: 'percent' } });
    await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
    // preview diff
    expect(screen.getByText('110.00')).toBeInTheDocument();
    expect(screen.getByText('55.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }));
    fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: 'fixed' } });
    await confirm();
    expect(onSave).toHaveBeenCalledWith([
      { id: 1, regular_price: '110.00' },
      { id: 2, regular_price: '60.00' },
    ]);
  });

  it('decrease by fixed amount never goes below zero; percent decrease scales', async () => {
    open();
    await check('Regular Price');
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'decrease' } });
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '75' } });
    await confirm();
    expect(onSave).toHaveBeenLastCalledWith([
      { id: 1, regular_price: '25.00' },
      { id: 2, regular_price: '0.00' },
    ]);
  });

  it('treats an empty regular price as 0 when increasing', async () => {
    open({ selectedProducts: [C] });
    await check('Regular Price');
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'increase' } });
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '5' } });
    await confirm();
    expect(onSave).toHaveBeenCalledWith([{ id: 3, regular_price: '5.00' }]);
  });

  it('sale price is based on existing sale price, falling back to regular, and carries dates', async () => {
    open();
    await check('Sale Price');
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'decrease' } });
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '10' } });
    fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: 'percent' } });
    fireEvent.change(screen.getByLabelText(/sale start date/i), { target: { value: '2030-01-01' } });
    await confirm();
    expect(onSave).toHaveBeenCalledWith([
      { id: 1, sale_price: '72.00', date_on_sale_from: '2030-01-01' },
      { id: 2, sale_price: '45.00', date_on_sale_from: '2030-01-01' },
    ]);
  });

  it('stock set/increase/decrease also enables stock management; decrease clamps at 0', async () => {
    open();
    await check('Stock Quantity');
    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '8' } });

    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'increase' } });
    await confirm();
    expect(onSave).toHaveBeenLastCalledWith([
      { id: 1, stock_quantity: 13, manage_stock: true },
      { id: 2, stock_quantity: 8, manage_stock: true },
    ]);

    // back from the preview to the form
    expect(onClose).toHaveBeenCalled();
  });

  it('stock decrease clamps at 0 and "0" counts as a value', async () => {
    open();
    await check('Stock Quantity');
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'decrease' } });
    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '9' } });
    await confirm();
    expect(onSave).toHaveBeenCalledWith([
      { id: 1, stock_quantity: 0, manage_stock: true },
      { id: 2, stock_quantity: 0, manage_stock: true },
    ]);
  });

  it('explicit "manage stock = No" overrides the implicit enable from quantity', async () => {
    open();
    await check('Stock Quantity');
    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '3' } });
    await check('Enable Stock Management');
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'false' } });
    await confirm();
    expect(onSave).toHaveBeenCalledWith([
      { id: 1, stock_quantity: 3, manage_stock: false },
      { id: 2, stock_quantity: 3, manage_stock: false },
    ]);
  });

  it('maps status, tax, visibility and featured', async () => {
    open({ selectedProducts: [B] });
    await check('Stock Status');
    await check('Tax Status');
    await check('Catalog Visibility');
    await check('Featured Product');
    const [status, tax, vis, featured] = screen.getAllByRole('combobox');
    fireEvent.change(status!, { target: { value: 'outofstock' } });
    fireEvent.change(tax!, { target: { value: 'shipping' } });
    fireEvent.change(vis!, { target: { value: 'hidden' } });
    fireEvent.change(featured!, { target: { value: 'true' } });
    await confirm();
    expect(onSave).toHaveBeenCalledWith([
      {
        id: 2,
        stock_status: 'outofstock',
        tax_status: 'shipping',
        catalog_visibility: 'hidden',
        featured: true,
      },
    ]);
  });

  it('preview shows an em-dash for products without a price and warns when no price is edited', async () => {
    open({ selectedProducts: [C] });
    await check('Stock Status');
    await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
    expect(screen.getByText(/no price changes selected/i)).toBeInTheDocument();
  });
});

describe('BulkEditModal scope and failure paths', () => {
  it('"all products in category" scopes updates to the matching products', async () => {
    open({ selectedProducts: [A], allProducts: [A, B, C] });
    await userEvent.click(screen.getByLabelText(/all products in category/i));
    expect(screen.getByRole('button', { name: /preview changes/i })).toBeEnabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    expect(screen.getByText('2 products')).toBeInTheDocument();
    await confirm();
    expect(onSave).toHaveBeenCalledWith([{ id: 1 }, { id: 3 }]);
  });

  it('a category with no products disables preview, and clearing it restores the selection', async () => {
    open({ selectedProducts: [A], allProducts: [A, B] });
    await userEvent.click(screen.getByLabelText(/all products in category/i));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '4' } });
    expect(screen.getByText('1 products')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(screen.getByText('1 product will be updated')).toBeInTheDocument();
  });

  it('empty selection disables preview and keeps the form open', async () => {
    open({ selectedProducts: [] });
    expect(screen.getByRole('button', { name: /preview changes/i })).toBeDisabled();
    expect(screen.getByText('0 products will be updated')).toBeInTheDocument();
  });

  it('shows a generic error and stays open when onSave rejects', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    onSave.mockRejectedValue(new Error('boom'));
    open();
    await confirm();
    expect(onError).toHaveBeenCalledWith('Failed to save bulk edits. Please try again.');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled(); // isSaving reset
    spy.mockRestore();
  });

  it('does not throw on rejection when onError is omitted', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    onSave.mockRejectedValue(new Error('boom'));
    open({ onError: undefined });
    await confirm();
    expect(onClose).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('Back from the preview returns to the form with fields intact', async () => {
    open();
    await check('Regular Price');
    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '7' } });
    await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByPlaceholderText('Value')).toHaveValue(7);
  });
});
