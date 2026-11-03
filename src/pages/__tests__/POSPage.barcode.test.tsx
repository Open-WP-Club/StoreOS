import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import POSPage from '../POSPage';
import { createMockProduct, createMockStore } from '../../__test_utils__';
import { usePOSStore } from '../../stores/posStore';

const toast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
const getProductVariations = vi.fn();
let scanProducts: ReturnType<typeof createMockProduct>[] = [];

vi.mock('../../stores', () => ({
  useStoreConfig: (selector: (s: unknown) => unknown) =>
    selector({ getCurrentStore: () => createMockStore() }),
}));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => toast }));
vi.mock('../../services/woocommerce', () => ({
  default: class {
    getProductVariations = getProductVariations;
  },
}));
vi.mock('../../hooks/usePOSProducts', () => ({
  usePOSProducts: () => ({
    products: scanProducts,
    filteredProducts: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    totalProducts: 0,
    loadError: null,
    retryCountdown: 0,
    searchTerm: '',
    setSearchTerm: vi.fn(),
    selectedCategory: 'all',
    setSelectedCategory: vi.fn(),
    categorySearch: '',
    setCategorySearch: vi.fn(),
    showCategoryDropdown: false,
    setShowCategoryDropdown: vi.fn(),
    categories: [],
    filteredCategories: [],
    categoryDropdownRef: { current: null },
    loadMoreRef: { current: null },
    infiniteScrollEnabled: true,
    loadProducts: vi.fn(),
    loadMoreProducts: vi.fn(),
    cancelRetry: vi.fn(),
    handleSearchKeyDown: vi.fn(),
  }),
}));
let checkoutOpen = false;
vi.mock('../../hooks/usePOSCheckout', () => ({
  usePOSCheckout: () => ({
    showCheckout: checkoutOpen,
    setShowCheckout: vi.fn(),
    processingOrder: false,
    showCustomerSearch: false,
    setShowCustomerSearch: vi.fn(),
    customerSearchTerm: '',
    setCustomerSearchTerm: vi.fn(),
    customers: [],
    loadingCustomers: false,
    selectedCustomer: null,
    handleSelectCustomer: vi.fn(),
    clearCustomer: vi.fn(),
    orderNote: '',
    setOrderNote: vi.fn(),
    handleCheckout: vi.fn(),
  }),
}));
vi.mock('../../hooks/usePOSDailyReport', () => ({
  usePOSDailyReport: () => ({
    showRecentTransactions: false,
    setShowRecentTransactions: vi.fn(),
    recentTransactions: [],
    showDailyReport: false,
    setShowDailyReport: vi.fn(),
    refundingTransaction: null,
    setRefundingTransaction: vi.fn(),
    processingRefund: false,
    saveRecentTransaction: vi.fn(),
    getTodayTransactions: () => [],
    getDailyReportStats: () => ({}),
    exportDailyReportCSV: vi.fn(),
    handleRefund: vi.fn(),
  }),
}));
vi.mock('../../components/POSProductGrid', () => ({ default: () => <div /> }));
vi.mock('../../components/POSCart', () => ({ default: () => <div /> }));
vi.mock('../../components/POSRecentTransactionsModal', () => ({ default: () => null }));
vi.mock('../../components/POSDailyReportModal', () => ({ default: () => null }));
vi.mock('../../components/POSVariantPickerModal', () => ({
  default: ({ product }: { product: { name: string } }) => (
    <div data-testid="variant-picker">{product.name}</div>
  ),
}));

/** Types a code as a fast burst (all keydowns in the same tick) then Enter. */
function burst(code: string, target: Element = document.body): void {
  for (const key of code) fireEvent.keyDown(target, { key });
  fireEvent.keyDown(target, { key: 'Enter' });
}

const renderPage = (): void => {
  render(
    <MemoryRouter>
      <POSPage />
    </MemoryRouter>
  );
};

describe('POSPage barcode scanning', () => {
  beforeEach(() => {
    checkoutOpen = false;
    usePOSStore.getState().clearCart();
    scanProducts = [
      createMockProduct({ id: 1, name: 'Simple Tee', sku: 'TEE-001', type: 'simple' }),
      createMockProduct({
        id: 2,
        name: 'Variable Hoodie',
        sku: 'HOOD-9',
        type: 'variable',
        variations: [21, 22],
      }),
    ];
    getProductVariations.mockResolvedValue({ success: true, data: [] });
  });

  it('adds the found product to the cart', () => {
    renderPage();
    burst('TEE-001');
    const cart = usePOSStore.getState().cart;
    expect(cart).toHaveLength(1);
    expect(cart[0]!.product.id).toBe(1);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('opens the variant picker for a variable product instead of adding it', async () => {
    renderPage();
    burst('HOOD-9');
    expect(await screen.findByTestId('variant-picker')).toHaveTextContent('Variable Hoodie');
    expect(usePOSStore.getState().cart).toHaveLength(0);
    await waitFor(() => expect(getProductVariations).toHaveBeenCalledWith(2));
  });

  it('warns with a toast on an unknown code', () => {
    renderPage();
    burst('ZZZ-404');
    expect(toast.warning).toHaveBeenCalledWith('Няма продукт с код ZZZ-404');
    expect(usePOSStore.getState().cart).toHaveLength(0);
  });

  it('ignores a burst typed into a text input', () => {
    renderPage();
    const input = document.createElement('input');
    document.body.appendChild(input);
    burst('TEE-001', input);
    input.remove();
    expect(usePOSStore.getState().cart).toHaveLength(0);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('ignores too-short codes', () => {
    renderPage();
    burst('AB'); // shorter than the minimum length
    expect(toast.warning).not.toHaveBeenCalled();
    expect(usePOSStore.getState().cart).toHaveLength(0);
  });

  it('does not scan while the checkout panel is open', () => {
    checkoutOpen = true;
    renderPage();
    burst('TEE-001');
    expect(usePOSStore.getState().cart).toHaveLength(0);
  });
});
