import { vi, Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductTableRow from '../ProductTableRow';
import { createMockProduct } from '../../__test_utils__/mockFactories';
import { formatPrice } from '../../utils/currency';
import type { ProductImage } from '../../types';

vi.mock('../../utils/currency');

beforeEach(() => {
  (formatPrice as Mock).mockImplementation((val) => `$${val}`);
});

const defaultCallbacks = {
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onQuickEditSave: vi.fn(() => Promise.resolve()),
};

function renderRow(productOverrides = {}, isSelected = false, callbacks = {}) {
  const product = createMockProduct({
    id: 42,
    name: 'Widget',
    sku: 'WDG-01',
    price: '29.99',
    regular_price: '29.99',
    stock_status: 'instock',
    stock_quantity: 15,
    manage_stock: true,
    images: [{ id: 1, src: 'https://img.com/widget.jpg', name: 'widget', alt: 'widget' } as ProductImage],
    ...productOverrides,
  });

  const props = { ...defaultCallbacks, ...callbacks };

  return render(
    <MemoryRouter>
      <table>
        <tbody>
          <ProductTableRow product={product} isSelected={isSelected} {...props} />
        </tbody>
      </table>
    </MemoryRouter>
  );
}

describe('ProductTableRow', () => {
  describe('rendering', () => {
    it('renders product name as link', () => {
      renderRow();
      const link = screen.getByText('Widget');
      expect(link.closest('a')).toHaveAttribute('href', '/products/42');
    });

    it('renders SKU', () => {
      renderRow();
      expect(screen.getByText('WDG-01')).toBeInTheDocument();
    });

    it('renders N/A when no SKU', () => {
      renderRow({ sku: '' });
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('renders formatted price', () => {
      renderRow();
      expect(formatPrice).toHaveBeenCalledWith('29.99');
    });

    it('renders product image', () => {
      renderRow();
      const img = screen.getByAltText('Widget');
      expect(img).toHaveAttribute('src', 'https://img.com/widget.jpg');
    });

    it('renders placeholder when no images', () => {
      renderRow({ images: [] });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders stock status badge', () => {
      renderRow();
      expect(screen.getByText('instock')).toBeInTheDocument();
    });

    it('renders stock quantity when manage_stock is true', () => {
      renderRow({ stock_quantity: 15 });
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('renders "Not managed" when manage_stock is false', () => {
      renderRow({ manage_stock: false });
      expect(screen.getByText('Not managed')).toBeInTheDocument();
    });
  });

  describe('checkbox', () => {
    it('calls onSelect when clicked', () => {
      const onSelect = vi.fn();
      renderRow({}, false, { onSelect });
      fireEvent.click(screen.getByRole('checkbox'));
      expect(onSelect).toHaveBeenCalledWith(42);
    });

    it('reflects isSelected prop', () => {
      renderRow({}, true);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  describe('action buttons', () => {
    it('Edit links to product page', () => {
      renderRow();
      const editLink = screen.getByText('Edit').closest('a');
      expect(editLink).toHaveAttribute('href', '/products/42');
    });

    it('Clone calls onDuplicate with product', () => {
      const onDuplicate = vi.fn();
      renderRow({}, false, { onDuplicate });
      fireEvent.click(screen.getByText('Clone'));
      expect(onDuplicate).toHaveBeenCalledWith(expect.objectContaining({ id: 42, name: 'Widget' }));
    });

    it('Delete calls onDelete with product id', () => {
      const onDelete = vi.fn();
      renderRow({}, false, { onDelete });
      fireEvent.click(screen.getByText('Delete'));
      expect(onDelete).toHaveBeenCalledWith(42);
    });
  });

  describe('quick edit', () => {
    it('enters quick edit mode when price clicked', () => {
      renderRow();
      fireEvent.click(screen.getByText('$29.99'));
      expect(screen.getByDisplayValue('29.99')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onQuickEditSave when Save clicked', async () => {
      const onQuickEditSave = vi.fn(() => Promise.resolve());
      renderRow({}, false, { onQuickEditSave });
      fireEvent.click(screen.getByText('$29.99'));
      fireEvent.change(screen.getByDisplayValue('29.99'), { target: { value: '35.00' } });
      await act(async () => {
        fireEvent.click(screen.getByText('Save'));
      });
      expect(onQuickEditSave).toHaveBeenCalledWith(42, '35.00');
    });

    it('calls onQuickEditSave on Enter key', async () => {
      const onQuickEditSave = vi.fn(() => Promise.resolve());
      renderRow({}, false, { onQuickEditSave });
      fireEvent.click(screen.getByText('$29.99'));
      const input = screen.getByDisplayValue('29.99');
      fireEvent.change(input, { target: { value: '40.00' } });
      await act(async () => {
        fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
      });
      expect(onQuickEditSave).toHaveBeenCalledWith(42, '40.00');
    });

    it('exits quick edit on Cancel', () => {
      renderRow();
      fireEvent.click(screen.getByText('$29.99'));
      expect(screen.getByText('Save')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.getByText('$29.99')).toBeInTheDocument();
    });
  });

  describe('stock highlighting', () => {
    it('applies red background for out of stock', () => {
      renderRow({ stock_status: 'outofstock', stock_quantity: 0 });
      const row = screen.getByRole('row');
      expect(row.className).toContain('bg-red-50');
    });

    it('applies yellow background for low stock', () => {
      renderRow({ stock_status: 'instock', stock_quantity: 3 });
      const row = screen.getByRole('row');
      expect(row.className).toContain('bg-yellow-50');
    });

    it('no highlight for normal stock', () => {
      renderRow({ stock_status: 'instock', stock_quantity: 50 });
      const row = screen.getByRole('row');
      expect(row.className).not.toContain('bg-red-50');
      expect(row.className).not.toContain('bg-yellow-50');
    });
  });
});
