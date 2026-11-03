import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import VariationsTab from '../VariationsTab';
import { createMockStore, createMockProduct } from '../../__test_utils__';
import useOffline from '../../stores/offlineStore';
import { tempIdFor, mutatePlaceholder } from '../../utils/offlinePlaceholders';
import type { WooCommerceProduct } from '../../types';

const m = vi.hoisted(() => ({ Service: vi.fn(), getProductVariations: vi.fn() }));
vi.mock('../../services/woocommerce', () => ({ __esModule: true, default: m.Service }));

const store = createMockStore();
const product = createMockProduct({
  id: 7,
  type: 'variable',
  attributes: [
    { id: 1, name: 'Size', position: 0, visible: true, variation: true, options: ['S'] },
  ],
}) as WooCommerceProduct;

const queue = (data: Record<string, unknown>) =>
  tempIdFor(useOffline.getState().addPendingOperation('create_variation', data, store.id));

describe('VariationsTab pending variations', () => {
  beforeEach(() => {
    useOffline.setState({ pendingOperations: [] });
    m.getProductVariations.mockResolvedValue({ success: true, data: [] });
    m.Service.mockImplementation(function () {
      return { getProductVariations: m.getProductVariations };
    });
  });

  it('lists queued variations of this product with a badge (not other products)', async () => {
    queue({
      productId: 7,
      regular_price: '10',
      attributes: [{ id: 1, name: 'Size', option: 'S' }],
    });
    queue({
      productId: 8,
      regular_price: '99',
      attributes: [{ id: 1, name: 'Size', option: 'XL' }],
    });
    render(<VariationsTab product={product} storeConfig={store} />);

    expect(await screen.findByText('Size: S')).toBeInTheDocument();
    expect(screen.getByText('Pending sync')).toBeInTheDocument();
    expect(screen.queryByText('Size: XL')).not.toBeInTheDocument();
  });

  it('drops the row when the queued create is cancelled', async () => {
    const tempId = queue({
      productId: 7,
      attributes: [{ id: 1, name: 'Size', option: 'S' }],
    });
    render(<VariationsTab product={product} storeConfig={store} />);
    await screen.findByText('Size: S');

    mutatePlaceholder('delete_variation', { productId: 7, id: tempId }, store.id);
    await waitFor(() => expect(screen.queryByText('Size: S')).not.toBeInTheDocument());
    expect(useOffline.getState().pendingOperations).toHaveLength(0);
  });
});
