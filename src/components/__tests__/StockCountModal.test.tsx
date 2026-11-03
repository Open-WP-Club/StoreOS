import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StockCountModal from '../StockCountModal';
import { createMockProduct } from '../../__test_utils__';

const products = [
  createMockProduct({ id: 1, name: 'Alpha', sku: 'A-1', manage_stock: true, stock_quantity: 5 }),
  createMockProduct({ id: 2, name: 'Beta', sku: 'B-2', manage_stock: true, stock_quantity: 3 }),
  createMockProduct({
    id: 3,
    name: 'Gamma',
    sku: 'G-3',
    manage_stock: false,
    stock_quantity: null,
  }),
];

describe('StockCountModal', () => {
  let onApply: Mock<(changes: Array<{ productId: number; counted: number }>) => Promise<void>>;
  let onClose: Mock<() => void>;
  const user = userEvent.setup();

  beforeEach(() => {
    onApply = vi.fn().mockResolvedValue(undefined);
    onClose = vi.fn();
    render(<StockCountModal products={products} onClose={onClose} onApply={onApply} />);
  });

  const scan = async (code: string): Promise<void> => {
    await user.type(screen.getByLabelText('Scan barcode'), `${code}{Enter}`);
  };
  const rowOf = (name: string): HTMLElement => screen.getByText(name).closest('tr')!;

  it('starts empty with Apply disabled', () => {
    expect(screen.getByText('No items scanned yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply 0 changes/ })).toBeDisabled();
  });

  it('each scan adds 1 to the counted quantity and clears the input', async () => {
    await scan('a-1'); // case-insensitive SKU
    expect(screen.getByLabelText('Counted Alpha')).toHaveValue(1);
    await scan('A-1');
    expect(screen.getByLabelText('Counted Alpha')).toHaveValue(2);
    expect(screen.getByLabelText('Scan barcode')).toHaveValue('');
  });

  it('shows system quantity and signed difference', async () => {
    await scan('A-1'); // counted 1 vs system 5 -> -4
    const cells = within(rowOf('Alpha')).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('5');
    expect(cells[3]).toHaveTextContent('-4');
    await user.clear(screen.getByLabelText('Counted Alpha'));
    await user.type(screen.getByLabelText('Counted Alpha'), '8');
    expect(within(rowOf('Alpha')).getAllByRole('cell')[3]).toHaveTextContent('+3');
  });

  it('unknown code and unmanaged-stock products show a message and are not added', async () => {
    await scan('nope');
    expect(screen.getByText('No product with code nope')).toBeInTheDocument();
    await scan('G-3');
    expect(screen.getByText('Gamma does not manage stock')).toBeInTheDocument();
    expect(screen.queryByLabelText('Counted Gamma')).not.toBeInTheDocument();
    expect(screen.getByText('No items scanned yet.')).toBeInTheDocument();
  });

  it('Apply sends only changed items, then closes', async () => {
    await scan('A-1');
    await user.clear(screen.getByLabelText('Counted Alpha'));
    await user.type(screen.getByLabelText('Counted Alpha'), '5'); // equals system -> no diff
    await scan('B-2');
    await user.clear(screen.getByLabelText('Counted Beta'));
    await user.type(screen.getByLabelText('Counted Beta'), '7');
    await user.click(screen.getByRole('button', { name: 'Apply 1 change' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith([{ productId: 2, counted: 7 }]);
    expect(onClose).toHaveBeenCalled();
  });
});
