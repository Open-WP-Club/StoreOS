import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CopyToStoreModal from '../CopyToStoreModal';
import { createMockProduct } from '../../__test_utils__/mockFactories';
import type { Store } from '../../types';

const store = (id: string): Store =>
  ({
    id,
    name: `Store ${id}`,
    url: `https://${id}.test`,
    consumerKey: 'ck_test',
    consumerSecret: 'cs_test',
  }) as Store;

vi.mock('../../stores', () => ({
  useStoreConfig: (sel: (s: unknown) => unknown) => sel({ stores: [store('src'), store('tgt')] }),
}));

const cat = (id: number, name: string, parent = 0) => ({
  id,
  name,
  slug: name.toLowerCase(),
  parent,
});
vi.mock('../../services/woocommerce', () => ({
  default: class {
    s: { id: string };
    constructor(s: { id: string }) {
      this.s = s;
    }
    getProductCategories = () =>
      Promise.resolve({
        success: true,
        data: this.s.id === 'src' ? [cat(1, 'Men'), cat(2, 'Shoes', 1), cat(3, 'Boots', 2)] : [],
      });
    getProductAttributes = () => Promise.resolve({ success: true, data: [] });
    getAllProducts = () => Promise.resolve({ success: true, data: [] });
  },
}));

describe('CopyToStoreModal category tree preview', () => {
  it('lists new categories parents-first with indentation', async () => {
    const product = createMockProduct({
      id: 1,
      sku: 'A',
      categories: [{ id: 3, name: 'Boots', slug: 'boots' }],
    });
    render(
      <CopyToStoreModal
        kind="products"
        items={[product]}
        sourceStore={store('src')}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Preview'));
    await waitFor(() => expect(screen.getByText(/3 new categories/)).toBeInTheDocument());
    const rows = ['Men', 'Shoes', 'Boots'].map((n) => screen.getByText(new RegExp(`${n}$`)));
    expect(rows.map((el) => el.style.paddingLeft)).toEqual(['0px', '16px', '32px']);
    expect(rows[0]?.textContent).toBe('Men');
    expect(rows[1]?.textContent).toBe('└ Shoes');
  });
});
