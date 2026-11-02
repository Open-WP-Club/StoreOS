import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkEditForm from '../BulkEditForm';
import BulkEditPreview from '../BulkEditPreview';
import type { WooCommerceProduct } from '../../types';

type FormProps = React.ComponentProps<typeof BulkEditForm>;

const baseFields: FormProps['editFields'] = {
  changePrice: false,
  priceAction: 'set',
  priceValue: '',
  priceType: 'fixed',
  changeSalePrice: false,
  salePriceAction: 'set',
  salePriceValue: '',
  salePriceType: 'fixed',
  saleDateFrom: '',
  saleDateTo: '',
  changeStock: false,
  stockAction: 'set',
  stockValue: '',
  changeStockStatus: false,
  stockStatus: 'instock',
  changeManageStock: false,
  manageStock: true,
  changeTaxStatus: false,
  taxStatus: 'taxable',
  changeCatalogVisibility: false,
  catalogVisibility: 'visible',
  changeShippingClass: false,
  shippingClass: '',
  changeFeatured: false,
  featured: false,
  changeCategories: false,
  categories: '',
  changeTags: false,
  tags: '',
};

const p = (id: number): WooCommerceProduct => ({ id, name: `P${id}` }) as unknown as WooCommerceProduct;

const makeProps = (over: Partial<FormProps> = {}): FormProps => ({
  editFields: baseFields,
  onFieldToggle: vi.fn(),
  onFieldChange: vi.fn(),
  filterByCategory: false,
  selectedCategoryId: '',
  availableCategories: [],
  effectiveProducts: [p(1), p(2)],
  selectedProducts: [p(1), p(2)],
  allProducts: undefined,
  onCategoryIdChange: vi.fn(),
  onSetFilterByCategory: vi.fn(),
  onClose: vi.fn(),
  onPreview: vi.fn(),
  ...over,
});

const withFields = (f: Partial<FormProps['editFields']>) => ({ ...baseFields, ...f });

describe('BulkEditForm', () => {
  it('hides all value inputs until a field is checked', () => {
    render(<BulkEditForm {...makeProps()} />);
    expect(screen.queryByPlaceholderText('Value')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Quantity')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it.each([
    ['Regular Price', 'changePrice'],
    ['Sale Price', 'changeSalePrice'],
    ['Stock Quantity', 'changeStock'],
    ['Stock Status', 'changeStockStatus'],
    ['Enable Stock Management', 'changeManageStock'],
    ['Tax Status', 'changeTaxStatus'],
    ['Catalog Visibility', 'changeCatalogVisibility'],
    ['Featured Product', 'changeFeatured'],
  ])('toggling "%s" calls onFieldToggle(%s)', async (label, key) => {
    const props = makeProps();
    render(<BulkEditForm {...props} />);
    await userEvent.click(screen.getByLabelText(label));
    expect(props.onFieldToggle).toHaveBeenCalledWith(key);
  });

  it('shows pluralised footer count and singular for one product', () => {
    const { rerender } = render(<BulkEditForm {...makeProps()} />);
    expect(screen.getByText('2 products will be updated')).toBeInTheDocument();
    rerender(<BulkEditForm {...makeProps({ effectiveProducts: [p(1)] })} />);
    expect(screen.getByText('1 product will be updated')).toBeInTheDocument();
  });

  it('disables Preview when no products are in scope and does not fire', async () => {
    const props = makeProps({ effectiveProducts: [] });
    render(<BulkEditForm {...props} />);
    const btn = screen.getByRole('button', { name: /preview changes/i });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(props.onPreview).not.toHaveBeenCalled();
  });

  it('fires onPreview, Cancel and the close icon', async () => {
    const props = makeProps();
    render(<BulkEditForm {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByLabelText('Close modal'));
    expect(props.onPreview).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  describe('price inputs', () => {
    it('emits field changes for action, value and type', () => {
      const props = makeProps({
        editFields: withFields({ changePrice: true, priceAction: 'increase' }),
      });
      render(<BulkEditForm {...props} />);
      const [action, type] = screen.getAllByRole('combobox') as HTMLSelectElement[];
      fireEvent.change(action!, { target: { value: 'decrease' } });
      fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '12.5' } });
      fireEvent.change(type!, { target: { value: 'percent' } });
      expect(props.onFieldChange).toHaveBeenCalledWith('priceAction', 'decrease');
      expect(props.onFieldChange).toHaveBeenCalledWith('priceValue', '12.5');
      expect(props.onFieldChange).toHaveBeenCalledWith('priceType', 'percent');
    });

    it('disables the type select when action is "set"', () => {
      render(<BulkEditForm {...makeProps({ editFields: withFields({ changePrice: true }) })} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[2]).toBeUndefined();
      expect(selects[1]).toBeDisabled();
    });
  });

  describe('sale price inputs', () => {
    const fields = withFields({ changeSalePrice: true, salePriceAction: 'decrease' });

    it('emits changes and date range values', () => {
      const props = makeProps({ editFields: fields });
      render(<BulkEditForm {...props} />);
      fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '5' } });
      fireEvent.change(screen.getByLabelText(/sale start date/i), { target: { value: '2030-01-01' } });
      fireEvent.change(screen.getByLabelText(/sale end date/i), { target: { value: '2030-02-01' } });
      const [action, type] = screen.getAllByRole('combobox');
      fireEvent.change(action!, { target: { value: 'increase' } });
      fireEvent.change(type!, { target: { value: 'percent' } });
      expect(props.onFieldChange).toHaveBeenCalledWith('salePriceValue', '5');
      expect(props.onFieldChange).toHaveBeenCalledWith('saleDateFrom', '2030-01-01');
      expect(props.onFieldChange).toHaveBeenCalledWith('saleDateTo', '2030-02-01');
      expect(props.onFieldChange).toHaveBeenCalledWith('salePriceAction', 'increase');
      expect(props.onFieldChange).toHaveBeenCalledWith('salePriceType', 'percent');
    });

    it('end date min follows start date', () => {
      render(
        <BulkEditForm {...makeProps({ editFields: { ...fields, saleDateFrom: '2030-01-01' } })} />
      );
      expect(screen.getByLabelText(/sale end date/i)).toHaveAttribute('min', '2030-01-01');
    });

    it('end date has no min when start is empty; type enabled for non-set action', () => {
      render(<BulkEditForm {...makeProps({ editFields: fields })} />);
      expect(screen.getByLabelText(/sale end date/i)).not.toHaveAttribute('min');
      expect(screen.getAllByRole('combobox')[1]).not.toBeDisabled();
    });
  });

  describe('inventory and product data selects', () => {
    it('stock quantity emits action and value', () => {
      const props = makeProps({ editFields: withFields({ changeStock: true }) });
      render(<BulkEditForm {...props} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'increase' } });
      fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '7' } });
      expect(props.onFieldChange).toHaveBeenCalledWith('stockAction', 'increase');
      expect(props.onFieldChange).toHaveBeenCalledWith('stockValue', '7');
    });

    it('stock status emits the chosen status', () => {
      const props = makeProps({ editFields: withFields({ changeStockStatus: true }) });
      render(<BulkEditForm {...props} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'onbackorder' } });
      expect(props.onFieldChange).toHaveBeenCalledWith('stockStatus', 'onbackorder');
    });

    it('manage stock and featured emit booleans, not strings', () => {
      const props = makeProps({
        editFields: withFields({ changeManageStock: true, changeFeatured: true }),
      });
      render(<BulkEditForm {...props} />);
      const [manage, featured] = screen.getAllByRole('combobox');
      fireEvent.change(manage!, { target: { value: 'false' } });
      fireEvent.change(featured!, { target: { value: 'true' } });
      expect(props.onFieldChange).toHaveBeenCalledWith('manageStock', false);
      expect(props.onFieldChange).toHaveBeenCalledWith('featured', true);
    });

    it('tax status and catalog visibility emit their values', () => {
      const props = makeProps({
        editFields: withFields({ changeTaxStatus: true, changeCatalogVisibility: true }),
      });
      render(<BulkEditForm {...props} />);
      const [tax, vis] = screen.getAllByRole('combobox');
      fireEvent.change(tax!, { target: { value: 'none' } });
      fireEvent.change(vis!, { target: { value: 'hidden' } });
      expect(props.onFieldChange).toHaveBeenCalledWith('taxStatus', 'none');
      expect(props.onFieldChange).toHaveBeenCalledWith('catalogVisibility', 'hidden');
    });
  });

  describe('scope', () => {
    const cats = [
      { id: 3, name: 'Shoes', slug: 'shoes' },
      { id: 4, name: 'Hats', slug: 'hats' },
    ];

    it('shows count of selected products and hides category option without allProducts', () => {
      render(<BulkEditForm {...makeProps({ availableCategories: cats })} />);
      expect(screen.getByLabelText(/selected products \(2\)/i)).toBeChecked();
      expect(screen.queryByLabelText(/all products in category/i)).not.toBeInTheDocument();
    });

    it('hides category option when there are no categories', () => {
      render(<BulkEditForm {...makeProps({ allProducts: [p(1)] })} />);
      expect(screen.queryByLabelText(/all products in category/i)).not.toBeInTheDocument();
    });

    it('switches scope via radios', async () => {
      const props = makeProps({ allProducts: [p(1)], availableCategories: cats });
      render(<BulkEditForm {...props} />);
      await userEvent.click(screen.getByLabelText(/all products in category/i));
      expect(props.onSetFilterByCategory).toHaveBeenCalledWith(true);
    });

    it('lists categories, emits selection and shows scoped count only once chosen', () => {
      const props = makeProps({
        allProducts: [p(1)],
        availableCategories: cats,
        filterByCategory: true,
        effectiveProducts: [p(1)],
      });
      const { rerender } = render(<BulkEditForm {...props} />);
      expect(screen.getByRole('option', { name: 'Shoes' })).toBeInTheDocument();
      expect(screen.queryByText('1 products')).not.toBeInTheDocument();
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '4' } });
      expect(props.onCategoryIdChange).toHaveBeenCalled();
      rerender(<BulkEditForm {...props} selectedCategoryId={3} />);
      expect(screen.getByText('1 products')).toBeInTheDocument();
    });
  });
});

describe('BulkEditPreview', () => {
  type PProps = React.ComponentProps<typeof BulkEditPreview>;
  const rows: PProps['rows'] = [
    { id: 1, name: 'Alpha', oldRegularPrice: '10.00', newRegularPrice: '12.00', oldSalePrice: '—', newSalePrice: null },
    { id: 2, name: 'Beta', oldRegularPrice: '20.00', newRegularPrice: null, oldSalePrice: '15.00', newSalePrice: '14.00' },
  ];
  const makePProps = (over: Partial<PProps> = {}): PProps => ({
    rows,
    effectiveProductsCount: 2,
    changeSalePrice: false,
    saleDateFrom: '',
    saleDateTo: '',
    changePrice: true,
    isSaving: false,
    onClose: vi.fn(),
    onBack: vi.fn(),
    onSave: vi.fn(),
    ...over,
  });

  it('renders old to new regular price diff with em-dash for unchanged', () => {
    render(<BulkEditPreview {...makePProps()} />);
    expect(screen.getByText('Preview Changes — 2 products')).toBeInTheDocument();
    expect(screen.getByText('10.00')).toBeInTheDocument();
    expect(screen.getByText('12.00')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // Beta new regular
    expect(screen.queryByText('Sale Price')).not.toBeInTheDocument();
    expect(screen.queryByText(/no price changes selected/i)).not.toBeInTheDocument();
  });

  it('shows sale columns only when changeSalePrice', () => {
    render(<BulkEditPreview {...makePProps({ changePrice: false, changeSalePrice: true })} />);
    expect(screen.queryByText('Regular Price')).not.toBeInTheDocument();
    expect(screen.getByText('Sale Price')).toBeInTheDocument();
    expect(screen.getByText('14.00')).toBeInTheDocument();
  });

  it('warns when no row has a price change', () => {
    const none = rows.map((r) => ({ ...r, newRegularPrice: null, newSalePrice: null }));
    render(<BulkEditPreview {...makePProps({ rows: none })} />);
    expect(screen.getByText(/no price changes selected/i)).toBeInTheDocument();
  });

  it('shows sale period with placeholders for missing ends, only with changeSalePrice', () => {
    const { rerender } = render(
      <BulkEditPreview {...makePProps({ changeSalePrice: true, saleDateFrom: '2030-01-01' })} />
    );
    expect(screen.getByText(/sale period/i)).toHaveTextContent('2030-01-01 → —');
    rerender(<BulkEditPreview {...makePProps({ changeSalePrice: false, saleDateFrom: '2030-01-01' })} />);
    expect(screen.queryByText(/sale period/i)).not.toBeInTheDocument();
  });

  it('save button label/disabled states', () => {
    const { rerender } = render(<BulkEditPreview {...makePProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm — Update 2 Products' })).toBeEnabled();
    rerender(<BulkEditPreview {...makePProps({ isSaving: true })} />);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    rerender(<BulkEditPreview {...makePProps({ effectiveProductsCount: 0, rows: [] })} />);
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });

  it('wires back, close and save', async () => {
    const props = makePProps();
    render(<BulkEditPreview {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    await userEvent.click(screen.getByLabelText('Close modal'));
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(props.onBack).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onSave).toHaveBeenCalled();
  });
});
