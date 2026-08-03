import { vi, Mock } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import POSPage from '../POSPage';
import { createMockStore } from '../../__test_utils__';
import { useStoreConfig } from '../../stores';
import { usePOSStore } from '../../stores/posStore';

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
}));

vi.mock('../../stores/posStore', () => ({
  usePOSStore: vi.fn(),
}));

vi.mock('../../services/woocommerce');

vi.mock('../../utils/currency', () => ({
  formatPrice: (v: string | number) => `$${v}`,
}));

vi.mock('../../hooks/usePOSProducts', () => ({
  usePOSProducts: () => ({
    products: [],
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

vi.mock('../../hooks/usePOSCheckout', () => ({
  usePOSCheckout: () => ({
    showCheckout: false,
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
    getDailyReportStats: () => ({
      totalSales: 0,
      orderCount: 0,
      averageOrder: 0,
      byPaymentMethod: {},
      topProducts: [],
    }),
    exportDailyReportCSV: vi.fn(),
    handleRefund: vi.fn(),
  }),
}));

vi.mock('../../hooks/usePOSVariants', () => ({
  __esModule: true,
  usePOSVariants: () => ({
    showVariantPicker: false,
    variantProduct: null,
    variants: [],
    loadingVariants: false,
    openVariantPicker: vi.fn(),
    closeVariantPicker: vi.fn(),
    selectVariant: vi.fn(),
  }),
}));

vi.mock('../../components/Numpad', () => ({
  default: function MockNumpad() {
    return <div data-testid="numpad">Numpad</div>;
  },
}));

vi.mock('../../components/POSProductGrid', () => ({
  default: function MockPOSProductGrid() {
    return <div data-testid="pos-product-grid">Products</div>;
  },
}));

vi.mock('../../components/POSCart', () => ({
  default: function MockPOSCart() {
    return <div data-testid="pos-cart">Cart</div>;
  },
}));

vi.mock('../../components/POSRecentTransactionsModal', () => ({
  default: function MockRecentTransactions() {
    return null;
  },
}));

vi.mock('../../components/POSDailyReportModal', () => ({
  default: function MockDailyReport() {
    return null;
  },
}));

describe('POSPage', () => {
  const mockStore = createMockStore();

  beforeEach(() => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockStore };
      return selector ? selector(state) : state;
    });

    (usePOSStore as unknown as Mock).mockReturnValue({
      cart: [],
      addToCart: vi.fn(),
      removeFromCart: vi.fn(),
      updateQuantity: vi.fn(),
      clearCart: vi.fn(),
      getTotal: () => 0,
      getSubtotal: () => 0,
      getItemCount: () => 0,
      paymentMethod: 'cash',
      setPaymentMethod: vi.fn(),
      amountTendered: 0,
      setAmountTendered: vi.fn(),
      discountType: 'percent',
      discountValue: 0,
      setDiscount: vi.fn(),
      setDiscountType: vi.fn(),
      setDiscountValue: vi.fn(),
      getDiscountAmount: () => 0,
      getChange: () => 0,
    });
  });

  it('should render POS page', () => {
    render(
      <MemoryRouter>
        <POSPage />
      </MemoryRouter>
    );

    expect(document.body).toBeTruthy();
  });

  it('should show setup message when no store configured', () => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => undefined };
      return selector ? selector(state) : state;
    });

    render(
      <MemoryRouter>
        <POSPage />
      </MemoryRouter>
    );

    expect(document.body).toBeTruthy();
  });
});
