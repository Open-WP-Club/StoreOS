import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Numpad } from '../Numpad';
import { POSCart } from '../POSCart';
import { POSScratchpad } from '../POSScratchpad';
import { POSShortcutsPanel } from '../POSShortcutsPanel';
import { POSCustomerSearchModal } from '../POSCustomerSearchModal';
import { POSDailyReportModal } from '../POSDailyReportModal';
import { POSRecentTransactionsModal } from '../POSRecentTransactionsModal';
import { POSVariantPickerModal } from '../POSVariantPickerModal';
import { POSRefundConfirmModal } from '../POSRefundConfirmModal';
import { POSProductGrid } from '../POSProductGrid';
import { createMockProduct, createMockCustomer } from '../../__test_utils__';
import type { CartItem } from '../../stores/posStore';
import type { RecentTransaction } from '../../hooks/usePOSDailyReport';

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

const noop = vi.fn();

/** Every <button> must have an aria-label or visible text (title alone is not enough). */
function expectNamedButtons(ui: ReactElement): number {
  const { container } = render(ui);
  const buttons = Array.from(document.body.querySelectorAll('button'));
  expect(container).toBeTruthy();
  expect(buttons.length).toBeGreaterThan(0);
  const unnamed = buttons.filter(
    (b) => !(b.getAttribute('aria-label')?.trim() || b.textContent?.trim())
  );
  expect(unnamed.map((b) => b.outerHTML)).toEqual([]);
  return buttons.length;
}

const product = createMockProduct({ id: 1, name: 'Widget' });
const cartItem: CartItem = { product, price: 10, quantity: 2 };
const tx: RecentTransaction = {
  id: 5,
  total: 20,
  itemCount: 2,
  items: [{ productId: 1, name: 'Widget', quantity: 2, price: 10 }],
  paymentMethod: 'cash',
  timestamp: '2024-01-01T10:00:00Z',
};

const cartProps = (over: Partial<React.ComponentProps<typeof POSCart>> = {}) =>
  ({
    cart: [cartItem],
    removeFromCart: noop,
    updateQuantity: noop,
    clearCart: noop,
    paymentMethod: 'cash',
    setPaymentMethod: noop,
    amountTendered: 5,
    setAmountTendered: noop,
    discountType: 'percent',
    discountValue: 0,
    setDiscount: noop,
    getSubtotal: () => 20,
    getDiscountAmount: () => 0,
    getTotal: () => 20,
    getChange: () => 0,
    setLineDiscount: noop,
    getLineDiscountAmount: () => 0,
    splitPayments: null,
    setSplitPayments: noop,
    getPaymentSummary: () => ({
      applied: [],
      tendered: 0,
      change: 0,
      remaining: 0,
      valid: true,
    }),
    getItemCount: () => 2,
    showCheckout: true,
    setShowCheckout: noop,
    processingOrder: false,
    onCheckout: noop,
    selectedCustomer: createMockCustomer({ id: 1 }),
    onClearCustomer: noop,
    onShowCustomerSearch: noop,
    orderNote: '',
    onOrderNoteChange: noop,
    currencySymbol: 'лв',
    onOpenQuantityNumpad: noop,
    onOpenAmountNumpad: noop,
    ...over,
  }) as React.ComponentProps<typeof POSCart>;

describe('POS buttons have accessible names', () => {
  it('Numpad', () => {
    expectNamedButtons(<Numpad value="1" onChange={noop} onClose={noop} onConfirm={noop} />);
  });

  it('POSCart (checkout, customer selected)', () => {
    expectNamedButtons(<POSCart {...cartProps()} />);
  });

  it('POSCart (split payments)', () => {
    expectNamedButtons(
      <POSCart
        {...cartProps({
          splitPayments: [
            { method: 'cash', amount: 10 },
            { method: 'card', amount: 10 },
          ],
        })}
      />
    );
  });

  it('POSScratchpad', () => {
    expectNamedButtons(
      <POSScratchpad note="x" onNoteChange={noop} onClear={noop} onClose={noop} />
    );
  });

  it('POSShortcutsPanel', () => {
    expectNamedButtons(<POSShortcutsPanel onClose={noop} />);
  });

  it('POSCustomerSearchModal', () => {
    expectNamedButtons(
      <POSCustomerSearchModal
        searchTerm="a"
        onSearchTermChange={noop}
        loadingCustomers={false}
        customers={[createMockCustomer({ id: 1 })]}
        onSelectCustomer={noop}
        onClose={noop}
      />
    );
  });

  it('POSDailyReportModal', () => {
    expectNamedButtons(
      <POSDailyReportModal
        stats={{
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          byPaymentMethod: {},
          topProducts: [],
        }}
        onClose={noop}
        onExportCSV={noop}
      />
    );
  });

  it('POSRecentTransactionsModal', () => {
    expectNamedButtons(
      <POSRecentTransactionsModal recentTransactions={[tx]} onClose={noop} onRefund={noop} />
    );
  });

  it('POSVariantPickerModal', () => {
    expectNamedButtons(
      <POSVariantPickerModal
        product={product}
        variations={[]}
        loading={false}
        onSelectVariation={noop}
        getVariationName={() => 'v'}
        onClose={noop}
      />
    );
  });

  it('POSRefundConfirmModal', () => {
    expectNamedButtons(
      <POSRefundConfirmModal transaction={tx} processing={false} onCancel={noop} onConfirm={noop} />
    );
  });

  it('POSProductGrid (search, category dropdown, products)', () => {
    expectNamedButtons(
      <POSProductGrid
        products={[product]}
        filteredProducts={[product]}
        loading={false}
        loadingMore={false}
        hasMore
        totalProducts={1}
        loadError={null}
        retryCountdown={0}
        searchTerm="w"
        onSearchTermChange={noop}
        onSearchKeyDown={noop}
        selectedCategory="all"
        onSelectCategory={noop}
        categorySearch="c"
        onCategorySearchChange={noop}
        showCategoryDropdown
        onToggleCategoryDropdown={noop}
        onCloseCategoryDropdown={noop}
        categories={['Cat']}
        filteredCategories={['Cat']}
        categoryDropdownRef={{ current: null }}
        loadMoreRef={{ current: null }}
        infiniteScrollEnabled={false}
        onLoadMore={noop}
        onProductClick={noop}
        onCancelRetry={noop}
        onRetry={noop}
      />
    );
  });
});
