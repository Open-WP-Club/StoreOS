import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildReceipt } from '../receipt';
import { printReceipt } from '../printReceipt';
import useAppSettings from '../../stores/appSettingsStore';

vi.mock('../storeLogo', () => ({
  getStoreLogo: vi.fn(async () => 'https://x.test/logo.png'),
}));

const receipt = buildReceipt({
  storeName: 'S',
  items: [{ name: 'A', quantity: 1, price: 1 }],
  total: 1,
  paymentMethod: 'cash',
});
const opts = {
  printer: null,
  openDrawer: false,
  currencySymbol: null,
  store: { id: '1', url: 'https://x.test' },
};

describe('printReceipt logo', () => {
  const print = vi.fn();
  beforeEach(() => {
    print.mockResolvedValue({ success: true });
    (window as unknown as { electronAPI: unknown }).electronAPI = { receipt: { print } };
  });

  it('includes the logo only when receiptShowLogo is on', async () => {
    useAppSettings.setState({ receiptShowLogo: false });
    await printReceipt(receipt, opts);
    expect(print.mock.calls[0]?.[0].html).not.toContain('<img');
    useAppSettings.setState({ receiptShowLogo: true });
    await printReceipt(receipt, opts);
    expect(print.mock.calls[1]?.[0].html).toContain('src="https://x.test/logo.png"');
  });
});
