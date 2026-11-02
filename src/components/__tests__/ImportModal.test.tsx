import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportModal from '../ImportModal';
import { createMockProduct } from '../../__test_utils__/mockFactories';

const batchProducts = vi.fn();
vi.mock('../../stores', () => ({
  useStoreConfig: (sel: (s: unknown) => unknown) =>
    sel({ getCurrentStore: () => ({ id: 's1', url: 'https://shop.test', consumerKey: 'ck_test', consumerSecret: 'cs_test' }) }),
}));
vi.mock('../../services/woocommerce', () => ({
  default: class {
    batchProducts = (...a: unknown[]) => batchProducts(...a);
  },
}));

const csvFile = (text: string): File => {
  const f = new File([text], 'p.csv', { type: 'text/csv' });
  // jsdom File.text may be missing
  if (!f.text) Object.defineProperty(f, 'text', { value: () => Promise.resolve(text) });
  return f;
};

const setup = async (csv: string, products = [createMockProduct({ id: 1, sku: 'A', name: 'Old', regular_price: '5' })]) => {
  const onClose = vi.fn();
  const onImported = vi.fn();
  const showToast = vi.fn();
  render(<ImportModal products={products} onClose={onClose} onImported={onImported} showToast={showToast} />);
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [csvFile(csv)] } });
  return { onClose, onImported, showToast };
};

describe('ImportModal', () => {
  it('rejects a file with only a header', async () => {
    await setup('sku,name');
    expect(await screen.findByText('The file has no data rows.')).toBeInTheDocument();
  });

  it('auto-maps columns, previews create/update and imports', async () => {
    batchProducts.mockResolvedValue({ success: true, data: { create: [{ id: 9 }], update: [{ id: 1 }] } });
    const { onImported, onClose, showToast } = await setup('SKU,Name,Regular price\nA,New,7\nB,Brand,3');
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    expect(screen.getByText(/1 to create, 1 to update/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 products' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const arg = batchProducts.mock.calls[0]![0];
    expect(arg.create).toHaveLength(1);
    expect(arg.update[0].id).toBe(1);
    expect(showToast).toHaveBeenCalledWith('Imported 2 products', 'success');
    expect(onImported).toHaveBeenCalled();
  });

  it('reports per-item batch failures', async () => {
    batchProducts.mockResolvedValue({
      success: true,
      data: { create: [{ error: { message: 'bad' } }], update: [{ id: 1 }] },
    });
    const { onImported, showToast } = await setup('SKU,Name\nA,New\nB,Brand');
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 products' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Import: 1 of 2 failed', 'error'));
    expect(onImported).toHaveBeenCalled(); // partial success still refreshes
  });

  it('counts a whole failed batch and skips refresh when all fail', async () => {
    batchProducts.mockResolvedValue({ success: false, error: 'down' });
    const { onImported, showToast } = await setup('SKU,Name\nB,Brand');
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 products' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Import: 1 of 1 failed', 'error'));
    expect(onImported).not.toHaveBeenCalled();
  });

  it('shows invalid rows and disables import when nothing is runnable', async () => {
    await setup('SKU,Name\n,NoSku');
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    expect(screen.getByText(/1 invalid/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 products' })).toBeDisabled();
  });

  it('Back returns to the mapping step', async () => {
    await setup('SKU,Name\nA,New');
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('SKU')).toBeInTheDocument();
  });
});
