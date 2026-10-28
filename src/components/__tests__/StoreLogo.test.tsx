import { vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import StoreLogo from '../StoreLogo';

vi.mock('../../stores/storeConfigStore', () => ({
  default: (sel: (s: unknown) => unknown) =>
    sel({
      currentStoreId: 's1',
      getCurrentStore: () => ({ id: 's1', url: 'https://shop.test' }),
    }),
}));
vi.mock('../../utils/storeLogo', () => ({
  getStoreLogo: vi.fn(),
}));
import { getStoreLogo } from '../../utils/storeLogo';

const img = () => document.querySelector('img') as HTMLImageElement;

describe('StoreLogo', () => {
  it('shows the remote icon and falls back on error', async () => {
    vi.mocked(getStoreLogo).mockResolvedValue('https://shop.test/icon.png');
    render(<StoreLogo />);
    await waitFor(() => expect(img().src).toBe('https://shop.test/icon.png'));
    fireEvent.error(img());
    await waitFor(() => expect(img().src).not.toContain('shop.test'));
  });

  it('uses the default icon when no logo is found', async () => {
    vi.mocked(getStoreLogo).mockResolvedValue(null);
    render(<StoreLogo />);
    await waitFor(() => expect(getStoreLogo).toHaveBeenCalled());
    expect(img().src).not.toContain('shop.test');
  });
});
