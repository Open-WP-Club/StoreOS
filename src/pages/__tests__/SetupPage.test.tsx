import { vi, Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SetupPage from '../SetupPage';
import { useStoreConfig } from '../../stores';
import WooCommerceService from '../../services/woocommerce';
import { createMockStore } from '../../__test_utils__/mockFactories';

vi.mock('../../stores');
vi.mock('../../services/woocommerce');

const mockAddStore = vi.fn();
const mockRemoveStore = vi.fn();
const mockUpdateStore = vi.fn();
let mockStores: ReturnType<typeof createMockStore>[] = [];
const mockTestConnection = vi.fn();

beforeEach(() => {
  mockStores = [];

  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = {
      addStore: mockAddStore,
      stores: mockStores,
      removeStore: mockRemoveStore,
      updateStore: mockUpdateStore,
    };
    return selector ? selector(state) : state;
  });

  (WooCommerceService as Mock).mockImplementation(function () { return {
    testConnection: mockTestConnection,
  }; });

  window.confirm = vi.fn(() => true);
});

describe('SetupPage', () => {
  describe('empty state', () => {
    it('shows "No stores connected yet" when no stores', () => {
      render(<SetupPage />);
      const matches = screen.getAllByText('No stores connected yet');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('shows Add Store button', () => {
      render(<SetupPage />);
      expect(screen.getByText('Add Store')).toBeInTheDocument();
    });

    it('renders app branding header', () => {
      render(<SetupPage />);
      expect(screen.getByText('StoreOS')).toBeInTheDocument();
      expect(screen.getByText(`Version ${__APP_VERSION__}`)).toBeInTheDocument();
    });
  });

  describe('store list', () => {
    it('renders connected stores', () => {
      mockStores = [createMockStore({ name: 'My Shop', url: 'https://myshop.com' })];
      render(<SetupPage />);
      expect(screen.getByText('My Shop')).toBeInTheDocument();
      expect(screen.getByText('https://myshop.com')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('shows store count', () => {
      mockStores = [createMockStore(), createMockStore()];
      render(<SetupPage />);
      expect(screen.getByText('2 stores connected')).toBeInTheDocument();
    });

    it('shows singular for 1 store', () => {
      mockStores = [createMockStore()];
      render(<SetupPage />);
      expect(screen.getByText('1 store connected')).toBeInTheDocument();
    });
  });

  describe('add store form', () => {
    it('opens form when Add Store clicked', () => {
      render(<SetupPage />);
      fireEvent.click(screen.getByText('Add Store'));
      expect(screen.getByText('Add New Store')).toBeInTheDocument();
      expect(screen.getByLabelText('Store Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Store URL')).toBeInTheDocument();
      expect(screen.getByLabelText('Consumer Key')).toBeInTheDocument();
      expect(screen.getByLabelText('Consumer Secret')).toBeInTheDocument();
    });

    it('closes form when X clicked', () => {
      render(<SetupPage />);
      fireEvent.click(screen.getByText('Add Store'));
      expect(screen.getByText('Add New Store')).toBeInTheDocument();

      // Click the close button (X icon)
      const closeButtons = screen.getAllByRole('button');
      const closeBtn = closeButtons.find(btn => btn.querySelector('.lucide-x'));
      if (closeBtn) fireEvent.click(closeBtn);
    });

    it('submits form and adds store on success', async () => {
      mockTestConnection.mockResolvedValue({
        success: true,
        data: { settings: { currency: 'EUR', currency_symbol: '€' } },
      });

      render(<SetupPage />);
      fireEvent.click(screen.getByText('Add Store'));

      fireEvent.change(screen.getByLabelText('Store Name'), { target: { value: 'Test Store', name: 'name' } });
      fireEvent.change(screen.getByLabelText('Store URL'), { target: { value: 'https://test.com', name: 'url' } });
      fireEvent.change(screen.getByLabelText('Consumer Key'), { target: { value: 'ck_test', name: 'consumerKey' } });
      fireEvent.change(screen.getByLabelText('Consumer Secret'), { target: { value: 'cs_test', name: 'consumerSecret' } });

      await act(async () => {
        fireEvent.submit(screen.getByText('Add Store', { selector: 'button[type="submit"]' }));
      });

      expect(mockTestConnection).toHaveBeenCalled();
      expect(mockAddStore).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Store',
          url: 'https://test.com',
          currency: 'EUR',
          currencySymbol: '€',
        })
      );
    });

    it('shows error on connection failure', async () => {
      mockTestConnection.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      render(<SetupPage />);
      fireEvent.click(screen.getByText('Add Store'));

      fireEvent.change(screen.getByLabelText('Store Name'), { target: { value: 'Test', name: 'name' } });
      fireEvent.change(screen.getByLabelText('Store URL'), { target: { value: 'https://bad.com', name: 'url' } });
      fireEvent.change(screen.getByLabelText('Consumer Key'), { target: { value: 'ck_bad', name: 'consumerKey' } });
      fireEvent.change(screen.getByLabelText('Consumer Secret'), { target: { value: 'cs_bad', name: 'consumerSecret' } });

      await act(async () => {
        fireEvent.submit(screen.getByText('Add Store', { selector: 'button[type="submit"]' }));
      });

      expect(screen.getByText('Connection failed: Invalid credentials')).toBeInTheDocument();
      expect(mockAddStore).not.toHaveBeenCalled();
    });

    it('shows error on exception', async () => {
      mockTestConnection.mockRejectedValue(new Error('Network error'));

      render(<SetupPage />);
      fireEvent.click(screen.getByText('Add Store'));

      fireEvent.change(screen.getByLabelText('Store Name'), { target: { value: 'Test', name: 'name' } });
      fireEvent.change(screen.getByLabelText('Store URL'), { target: { value: 'https://err.com', name: 'url' } });
      fireEvent.change(screen.getByLabelText('Consumer Key'), { target: { value: 'ck_e', name: 'consumerKey' } });
      fireEvent.change(screen.getByLabelText('Consumer Secret'), { target: { value: 'cs_e', name: 'consumerSecret' } });

      await act(async () => {
        fireEvent.submit(screen.getByText('Add Store', { selector: 'button[type="submit"]' }));
      });

      expect(screen.getByText('Error: Network error')).toBeInTheDocument();
    });

    it('shows "Testing Connection..." during test', async () => {
      let resolveTest: (value: unknown) => void;
      mockTestConnection.mockReturnValue(new Promise((resolve) => { resolveTest = resolve; }));

      render(<SetupPage />);
      fireEvent.click(screen.getByText('Add Store'));

      fireEvent.change(screen.getByLabelText('Store Name'), { target: { value: 'T', name: 'name' } });
      fireEvent.change(screen.getByLabelText('Store URL'), { target: { value: 'https://t.com', name: 'url' } });
      fireEvent.change(screen.getByLabelText('Consumer Key'), { target: { value: 'ck', name: 'consumerKey' } });
      fireEvent.change(screen.getByLabelText('Consumer Secret'), { target: { value: 'cs', name: 'consumerSecret' } });

      act(() => {
        fireEvent.submit(screen.getByText('Add Store', { selector: 'button[type="submit"]' }));
      });

      expect(screen.getByText('Testing Connection...')).toBeInTheDocument();

      await act(async () => {
        resolveTest!({ success: true, data: { settings: {} } });
      });
    });

    it('shows help section in add form', () => {
      render(<SetupPage />);
      fireEvent.click(screen.getByText('Add Store'));
      expect(screen.getByText('How to get API credentials')).toBeInTheDocument();
    });
  });

  describe('delete store', () => {
    it('calls removeStore after confirmation', () => {
      const store = createMockStore({ id: 'store-1', name: 'Delete Me' });
      mockStores = [store];

      render(<SetupPage />);
      fireEvent.click(screen.getByTitle('Remove store'));
      expect(window.confirm).toHaveBeenCalled();
      expect(mockRemoveStore).toHaveBeenCalledWith('store-1');
    });

    it('does not remove if confirm is cancelled', () => {
      (window.confirm as Mock).mockReturnValue(false);
      mockStores = [createMockStore({ id: 'store-1' })];

      render(<SetupPage />);
      fireEvent.click(screen.getByTitle('Remove store'));
      expect(mockRemoveStore).not.toHaveBeenCalled();
    });
  });

  describe('edit store', () => {
    it('opens edit form with store data', () => {
      const store = createMockStore({
        id: 'store-1',
        name: 'My Shop',
        url: 'https://myshop.com',
        consumerKey: 'ck_123',
        consumerSecret: 'cs_456',
      });
      mockStores = [store];

      render(<SetupPage />);
      fireEvent.click(screen.getByTitle('Edit store'));

      expect(screen.getByText('Edit Store')).toBeInTheDocument();
      expect(screen.getByDisplayValue('My Shop')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://myshop.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ck_123')).toBeInTheDocument();
    });

    it('shows POS settings in edit form', () => {
      mockStores = [createMockStore()];
      render(<SetupPage />);
      fireEvent.click(screen.getByTitle('Edit store'));
      expect(screen.getByText('POS Настройки')).toBeInTheDocument();
    });

    it('saves edit with connection test', async () => {
      mockTestConnection.mockResolvedValue({
        success: true,
        data: { settings: { currency: 'BGN', currency_symbol: 'лв.' } },
      });

      mockStores = [createMockStore({ id: 'store-1', name: 'Old Name' })];
      render(<SetupPage />);
      fireEvent.click(screen.getByTitle('Edit store'));

      fireEvent.change(screen.getByDisplayValue('Old Name'), { target: { value: 'New Name', name: 'name' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Save Changes'));
      });

      expect(mockTestConnection).toHaveBeenCalled();
      expect(mockUpdateStore).toHaveBeenCalledWith(
        'store-1',
        expect.objectContaining({
          name: 'New Name',
          currency: 'BGN',
          currencySymbol: 'лв.',
        })
      );
    });

    it('shows cancel button in edit form', () => {
      mockStores = [createMockStore()];
      render(<SetupPage />);
      fireEvent.click(screen.getByTitle('Edit store'));
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });
});
