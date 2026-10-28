import { vi, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StoreHealthPage from '../StoreHealthPage';
import { ToastProvider } from '../../contexts/ToastContext';
import { createMockStore } from '../../__test_utils__';
import { useStoreConfig } from '../../stores';
import WooCommerceService from '../../services/woocommerce';

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
}));

vi.mock('../../services/woocommerce');

const mockTestConnection = vi.fn();
const mockGetPaymentGateways = vi.fn();
const mockGetShippingZones = vi.fn();
const mockGetWebhooks = vi.fn();

const systemStatus = {
  environment: { wp_version: '6.5', version: '9.0', php_version: '8.2.1' },
  database: {},
  theme: {},
  settings: {},
  active_plugins: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/health']}>
      <ToastProvider>
        <Routes>
          <Route path="/health" element={<StoreHealthPage />} />
          <Route path="/setup" element={<div>Setup route</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('StoreHealthPage', () => {
  beforeEach(() => {
    const store = createMockStore();
    (useStoreConfig as unknown as Mock).mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ getCurrentStore: () => store })
    );
    (WooCommerceService as unknown as Mock).mockImplementation(function () {
      return {
        testConnection: mockTestConnection,
        getPaymentGateways: mockGetPaymentGateways,
        getShippingZones: mockGetShippingZones,
        getWebhooks: mockGetWebhooks,
      };
    });
    mockTestConnection.mockResolvedValue({ success: true, data: systemStatus });
    mockGetPaymentGateways.mockResolvedValue({
      success: true,
      data: [
        { id: 'cod', title: 'Cash on delivery', enabled: true },
        { id: 'bacs', title: 'Bank transfer', enabled: false },
      ],
    });
    mockGetShippingZones.mockResolvedValue({ success: true, data: [{ id: 1 }, { id: 2 }] });
    mockGetWebhooks.mockResolvedValue({
      success: true,
      data: [
        { id: 1, status: 'active' },
        { id: 2, status: 'paused' },
      ],
    });
  });

  it('shows the Integrations section with data on success', async () => {
    renderPage();
    expect(await screen.findByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Cash on delivery')).toBeInTheDocument();
    expect(screen.queryByText(/Bank transfer/)).not.toBeInTheDocument();
    expect(screen.getByText('1 active / 2 total')).toBeInTheDocument();
  });

  it.each([
    ['payment gateways', mockGetPaymentGateways],
    ['shipping zones', mockGetShippingZones],
    ['webhooks', mockGetWebhooks],
  ])('hides Integrations when %s request fails', async (_name, mockFn) => {
    mockFn.mockResolvedValue({ success: false, error: 'forbidden' });
    renderPage();
    await waitFor(() => expect(mockGetWebhooks).toHaveBeenCalled());
    await screen.findByText(/Active Plugins/);
    expect(screen.queryByText('Integrations')).not.toBeInTheDocument();
  });

  it('shows an "Open Setup" toast action on invalid credentials', async () => {
    mockTestConnection.mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
      code: 'invalid_credentials',
    });
    renderPage();
    expect(await screen.findByText(/check the store keys in Setup/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Setup' }));
    expect(await screen.findByText('Setup route')).toBeInTheDocument();
  });

  it('shows no Open Setup action for other errors', async () => {
    mockTestConnection.mockResolvedValue({ success: false, error: 'boom' });
    renderPage();
    expect(await screen.findByText('Connection Failed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Setup' })).not.toBeInTheDocument();
  });
});
