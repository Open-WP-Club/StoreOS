import { useState, useEffect, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  ArrowLeft,
  Package,
  Keyboard,
  History,
  BarChart3,
  StickyNote,
} from 'lucide-react';
import { useStoreConfig } from '../stores';
import { usePOSStore } from '../stores/posStore';
import { usePOSProducts } from '../hooks/usePOSProducts';
import { usePOSCheckout } from '../hooks/usePOSCheckout';
import { usePOSDailyReport } from '../hooks/usePOSDailyReport';
import { usePOSVariants } from '../hooks/usePOSVariants';
import Numpad from '../components/Numpad';
import POSProductGrid from '../components/POSProductGrid';
import POSCart from '../components/POSCart';
import POSDailyReportModal from '../components/POSDailyReportModal';
import POSRecentTransactionsModal from '../components/POSRecentTransactionsModal';
import POSShortcutsPanel from '../components/POSShortcutsPanel';
import POSScratchpad from '../components/POSScratchpad';
import POSCustomerSearchModal from '../components/POSCustomerSearchModal';
import POSRefundConfirmModal from '../components/POSRefundConfirmModal';
import POSVariantPickerModal from '../components/POSVariantPickerModal';

const SCRATCHPAD_KEY = 'pos_scratchpad_note';

export default function POSPage(): ReactElement {
  const navigate = useNavigate();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();
  const currencySymbol = currentStore?.currencySymbol || '';

  // POS Store
  const posStore = usePOSStore();
  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    paymentMethod,
    setPaymentMethod,
    amountTendered,
    setAmountTendered,
    discountType,
    discountValue,
    setDiscount,
    getSubtotal,
    getDiscountAmount,
    getTotal,
    getChange,
    getItemCount,
  } = posStore;

  // Hooks
  const dailyReport = usePOSDailyReport();
  const checkout = usePOSCheckout(dailyReport.saveRecentTransaction);
  const productsHook = usePOSProducts(addToCart);
  const variants = usePOSVariants(addToCart);

  // Numpad state
  const [numpadOpen, setNumpadOpen] = useState(false);
  const [numpadValue, setNumpadValue] = useState('');
  const [numpadMode, setNumpadMode] = useState<'quantity' | 'amount'>('quantity');
  const [numpadProductId, setNumpadProductId] = useState<number | null>(null);

  // Shortcuts & scratchpad
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [scratchpadNote, setScratchpadNote] = useState((): string => {
    try {
      return localStorage.getItem(SCRATCHPAD_KEY) || '';
    } catch {
      return '';
    }
  });

  // Save scratchpad
  useEffect(() => {
    try {
      localStorage.setItem(SCRATCHPAD_KEY, scratchpadNote);
    } catch {
      // silently handled
    }
  }, [scratchpadNote]);

  // Numpad helpers
  const openQuantityNumpad = (productId: number, currentQty: number): void => {
    setNumpadProductId(productId);
    setNumpadValue(currentQty.toString());
    setNumpadMode('quantity');
    setNumpadOpen(true);
  };

  const openAmountNumpad = (): void => {
    setNumpadValue(amountTendered > 0 ? amountTendered.toString() : '');
    setNumpadMode('amount');
    setNumpadOpen(true);
  };

  const handleNumpadConfirm = (): void => {
    const value = parseFloat(numpadValue) || 0;
    if (numpadMode === 'quantity' && numpadProductId !== null) {
      updateQuantity(numpadProductId, Math.max(1, Math.floor(value)));
    } else if (numpadMode === 'amount') {
      setAmountTendered(value);
    }
    setNumpadOpen(false);
    setNumpadValue('');
    setNumpadProductId(null);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) checkout.setShowCheckout(true);
      }

      if (e.key === 'Escape') {
        if (checkout.showCheckout) checkout.setShowCheckout(false);
        else if (productsHook.showCategoryDropdown) productsHook.setShowCategoryDropdown(false);
      }

      if (!isInputField) {
        if (e.key === '+' || e.key === 'NumpadAdd') {
          e.preventDefault();
          const lastItem = cart[cart.length - 1];
          if (lastItem) updateQuantity(lastItem.product.id, lastItem.quantity + 1);
        }
        if (e.key === '-' || e.key === 'NumpadSubtract') {
          e.preventDefault();
          const lastItem = cart[cart.length - 1];
          if (lastItem) updateQuantity(lastItem.product.id, lastItem.quantity - 1);
        }
      }

      if (checkout.showCheckout) {
        if (e.key === 'F1') { e.preventDefault(); setPaymentMethod('cash'); }
        if (e.key === 'F2') { e.preventDefault(); setPaymentMethod('card'); }
        if (e.key === 'F3') { e.preventDefault(); setPaymentMethod('other'); }
        if (e.key === 'F4' || (e.key === 'Enter' && !isInputField)) {
          e.preventDefault();
          if (!checkout.processingOrder && (paymentMethod !== 'cash' || amountTendered >= getTotal())) {
            checkout.handleCheckout();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [
    cart,
    checkout,
    productsHook,
    paymentMethod,
    amountTendered,
    updateQuantity,
    setPaymentMethod,
    getTotal,
  ]);

  if (!currentStore) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Моля, конфигурирайте магазин първо</p>
          <button
            onClick={() => navigate('/setup')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Към настройки
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">POS</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentStore.name || currentStore.url}
          </span>
          <button
            onClick={() => dailyReport.setShowDailyReport(true)}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Дневен отчет"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => dailyReport.setShowRecentTransactions(true)}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 relative"
            title="Последни транзакции"
          >
            <History className="w-5 h-5" />
            {dailyReport.recentTransactions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                {Math.min(dailyReport.recentTransactions.length, 9)}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowScratchpad(!showScratchpad)}
            className={`p-2 rounded-lg transition-colors relative ${
              showScratchpad
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
            title="Бележник"
          >
            <StickyNote className="w-5 h-5" />
            {scratchpadNote.trim() && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className={`p-2 rounded-lg transition-colors ${
              showShortcuts
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
            title="Клавиатурни shortcuts (F8)"
          >
            <Keyboard className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Keyboard Shortcuts Legend */}
      {showShortcuts && <POSShortcutsPanel onClose={() => setShowShortcuts(false)} />}

      {/* Scratchpad Popup */}
      {showScratchpad && (
        <POSScratchpad
          note={scratchpadNote}
          onNoteChange={setScratchpadNote}
          onClear={() => setScratchpadNote('')}
          onClose={() => setShowScratchpad(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Products */}
        <POSProductGrid
          products={productsHook.products}
          filteredProducts={productsHook.filteredProducts}
          loading={productsHook.loading}
          loadingMore={productsHook.loadingMore}
          hasMore={productsHook.hasMore}
          totalProducts={productsHook.totalProducts}
          loadError={productsHook.loadError}
          retryCountdown={productsHook.retryCountdown}
          searchTerm={productsHook.searchTerm}
          onSearchTermChange={productsHook.setSearchTerm}
          onSearchKeyDown={productsHook.handleSearchKeyDown}
          selectedCategory={productsHook.selectedCategory}
          onSelectCategory={productsHook.setSelectedCategory}
          categorySearch={productsHook.categorySearch}
          onCategorySearchChange={productsHook.setCategorySearch}
          showCategoryDropdown={productsHook.showCategoryDropdown}
          onToggleCategoryDropdown={() => productsHook.setShowCategoryDropdown(!productsHook.showCategoryDropdown)}
          onCloseCategoryDropdown={() => productsHook.setShowCategoryDropdown(false)}
          categories={productsHook.categories}
          filteredCategories={productsHook.filteredCategories}
          categoryDropdownRef={productsHook.categoryDropdownRef}
          loadMoreRef={productsHook.loadMoreRef}
          infiniteScrollEnabled={productsHook.infiniteScrollEnabled}
          onLoadMore={productsHook.loadMoreProducts}
          onProductClick={variants.handleProductClick}
          onCancelRetry={productsHook.cancelRetry}
          onRetry={() => productsHook.loadProducts(1)}
        />

        {/* Right: Cart */}
        <POSCart
          cart={cart}
          removeFromCart={removeFromCart}
          updateQuantity={updateQuantity}
          clearCart={clearCart}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          amountTendered={amountTendered}
          setAmountTendered={setAmountTendered}
          discountType={discountType}
          discountValue={discountValue}
          setDiscount={setDiscount}
          getSubtotal={getSubtotal}
          getDiscountAmount={getDiscountAmount}
          getTotal={getTotal}
          getChange={getChange}
          getItemCount={getItemCount}
          showCheckout={checkout.showCheckout}
          setShowCheckout={checkout.setShowCheckout}
          processingOrder={checkout.processingOrder}
          onCheckout={checkout.handleCheckout}
          selectedCustomer={checkout.selectedCustomer}
          onClearCustomer={checkout.clearCustomer}
          onShowCustomerSearch={() => checkout.setShowCustomerSearch(true)}
          orderNote={checkout.orderNote}
          onOrderNoteChange={checkout.setOrderNote}
          currencySymbol={currencySymbol}
          onOpenQuantityNumpad={openQuantityNumpad}
          onOpenAmountNumpad={openAmountNumpad}
        />
      </div>

      {/* Numpad Modal */}
      {numpadOpen && (
        <Numpad
          value={numpadValue}
          onChange={setNumpadValue}
          onClose={() => {
            setNumpadOpen(false);
            setNumpadValue('');
            setNumpadProductId(null);
          }}
          onConfirm={handleNumpadConfirm}
          title={numpadMode === 'quantity' ? 'Въведи количество' : 'Въведи платена сума'}
          allowDecimal={numpadMode === 'amount'}
        />
      )}

      {/* Customer Search Modal */}
      {checkout.showCustomerSearch && (
        <POSCustomerSearchModal
          searchTerm={checkout.customerSearchTerm}
          onSearchTermChange={checkout.setCustomerSearchTerm}
          loadingCustomers={checkout.loadingCustomers}
          customers={checkout.customers}
          onSelectCustomer={checkout.handleSelectCustomer}
          onClose={() => checkout.setShowCustomerSearch(false)}
        />
      )}

      {/* Recent Transactions Modal */}
      {dailyReport.showRecentTransactions && (
        <POSRecentTransactionsModal
          recentTransactions={dailyReport.recentTransactions}
          onClose={() => dailyReport.setShowRecentTransactions(false)}
          onRefund={dailyReport.setRefundingTransaction}
        />
      )}

      {/* Daily Report Modal */}
      {dailyReport.showDailyReport && (
        <POSDailyReportModal
          stats={dailyReport.getDailyReportStats()}
          onClose={() => dailyReport.setShowDailyReport(false)}
          onExportCSV={dailyReport.exportDailyReportCSV}
        />
      )}

      {/* Refund Confirmation Modal */}
      {dailyReport.refundingTransaction && (
        <POSRefundConfirmModal
          transaction={dailyReport.refundingTransaction}
          processing={dailyReport.processingRefund}
          onCancel={() => dailyReport.setRefundingTransaction(null)}
          onConfirm={() => dailyReport.handleRefund(dailyReport.refundingTransaction!)}
        />
      )}

      {/* Variant Picker Modal */}
      {variants.showVariantPicker && variants.selectedVariableProduct && (
        <POSVariantPickerModal
          product={variants.selectedVariableProduct}
          variations={variants.productVariations}
          loading={variants.loadingVariations}
          onSelectVariation={variants.handleAddVariation}
          getVariationName={variants.getVariationName}
          onClose={variants.closeVariantPicker}
        />
      )}
    </div>
  );
}
