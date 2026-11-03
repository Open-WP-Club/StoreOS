import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VariationsTab from '../VariationsTab';
import type { WooCommerceProduct, WooCommerceStore } from '../../types';

const svc = vi.hoisted(() => ({
  getProductVariations: vi.fn(),
  batchProductVariations: vi.fn(),
}));

vi.mock('../../services/woocommerce', () => ({
  default: class {
    getProductVariations = svc.getProductVariations;
    batchProductVariations = svc.batchProductVariations;
  },
}));
vi.mock('../../hooks/useOfflineMutation', () => ({
  useOfflineMutation: () => ({ mutate: vi.fn(), mutateApi: vi.fn(), isOnline: true }),
}));

const product = {
  id: 1,
  attributes: [
    { id: 1, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M'] },
  ],
} as unknown as WooCommerceProduct;
const store = { id: 's', url: 'https://x.test' } as unknown as WooCommerceStore;

describe('VariationsTab Generate All confirmation', () => {
  beforeEach(() => {
    svc.getProductVariations.mockResolvedValue({ success: true, data: [] });
    svc.batchProductVariations.mockResolvedValue({
      success: true,
      data: {
        create: [
          { id: 1, attributes: [] },
          { id: 2, attributes: [] },
        ],
      },
    });
  });

  it('does not create until confirmed', async () => {
    render(<VariationsTab product={product} storeConfig={store} />);
    await userEvent.click(await screen.findByRole('button', { name: /generate all/i }));
    expect(screen.getByText('Generate all variations?')).toBeInTheDocument();
    expect(svc.batchProductVariations).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(svc.batchProductVariations).toHaveBeenCalledTimes(1));
  });

  it('cancel creates nothing', async () => {
    render(<VariationsTab product={product} storeConfig={store} />);
    await userEvent.click(await screen.findByRole('button', { name: /generate all/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Generate all variations?')).not.toBeInTheDocument();
    expect(svc.batchProductVariations).not.toHaveBeenCalled();
  });
});
