import { useState, useEffect, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  X,
  ArrowLeft,
  Package,
  User,
  Loader2,
  Keyboard,
  History,
  BarChart3,
  RotateCcw,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useStoreConfig } from '../stores';
import { usePOSStore } from '../stores/posStore';
import { formatPrice } from '../utils/currency';
import { usePOSProducts } from '../hooks/usePOSProducts';
import { usePOSCheckout } from '../hooks/usePOSCheckout';
import { usePOSDailyReport } from '../hooks/usePOSDailyReport';
import { usePOSVariants } from '../hooks/usePOSVariants';
import Numpad from '../components/Numpad';
import POSProductGrid from '../components/POSProductGrid';
import POSCart from '../components/POSCart';
import POSDailyReportModal from '../components/POSDailyReportModal';
import POSRecentTransactionsModal from '../components/POSRecentTransactionsModal';
import type { ProductVariation } from '../types';

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
      {showShortcuts && (
        <div className="absolute top-16 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              Клавиатурни shortcuts
            </h3>
            <button onClick={() => setShowShortcuts(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Плащане</span>
              <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F8</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">+ Количество</span>
              <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">+</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">- Количество</span>
              <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">-</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Затвори</span>
              <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Esc</kbd>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">При плащане:</p>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Каса</span>
                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F1</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Карта</span>
                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F2</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Друго</span>
                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F3</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Завърши</span>
                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F4</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scratchpad Popup */}
      {showScratchpad && (
        <div className="absolute top-16 right-4 z-50 bg-yellow-50 dark:bg-gray-800 rounded-xl shadow-xl border border-yellow-200 dark:border-yellow-700 p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-yellow-600" />
              Бележник
            </h3>
            <div className="flex items-center gap-2">
              {scratchpadNote.trim() && (
                <button
                  onClick={() => setScratchpadNote('')}
                  className="p-1 hover:bg-yellow-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500"
                  title="Изчисти"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setShowScratchpad(false)} className="p-1 hover:bg-yellow-100 dark:hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          <textarea
            value={scratchpadNote}
            onChange={(e) => setScratchpadNote(e.target.value)}
            placeholder="Запиши си нещо..."
            rows={6}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-yellow-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Запазва се автоматично
          </p>
        </div>
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
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="presentation"
          onClick={() => checkout.setShowCustomerSearch(false)}
          onKeyDown={(e) => e.key === 'Escape' && checkout.setShowCustomerSearch(false)}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Избери клиент
                </h3>
                <button onClick={() => checkout.setShowCustomerSearch(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={checkout.customerSearchTerm}
                  onChange={(e) => checkout.setCustomerSearchTerm(e.target.value)}
                  placeholder="Търси по име, email или телефон..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- POS requires immediate input focus
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {checkout.loadingCustomers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : checkout.customerSearchTerm.length < 2 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Въведи поне 2 символа за търсене</p>
                </div>
              ) : checkout.customers.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Няма намерени клиенти</p>
                </div>
              ) : (
                checkout.customers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => checkout.handleSelectCustomer(customer)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      {customer.avatar_url ? (
                        <img src={customer.avatar_url} alt={`${customer.first_name} ${customer.last_name}`} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {customer.first_name} {customer.last_name}
                        {!customer.first_name && !customer.last_name && customer.username}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{customer.email}</p>
                      {customer.billing?.phone && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">Тел: {customer.billing.phone}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {customer.orders_count !== undefined && (
                        <p className="text-xs text-gray-400">{customer.orders_count} поръчки</p>
                      )}
                      {customer.total_spent && parseFloat(customer.total_spent) > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400">{formatPrice(parseFloat(customer.total_spent))}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
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
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="presentation"
          onClick={() => !dailyReport.processingRefund && dailyReport.setRefundingTransaction(null)}
          onKeyDown={(e) => e.key === 'Escape' && !dailyReport.processingRefund && dailyReport.setRefundingTransaction(null)}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Възстановяване на поръчка
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Сигурни ли сте, че искате да възстановите поръчка #{dailyReport.refundingTransaction.id} на стойност{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatPrice(dailyReport.refundingTransaction.total)}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => dailyReport.setRefundingTransaction(null)}
                  disabled={dailyReport.processingRefund}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Отказ
                </button>
                <button
                  onClick={() => dailyReport.handleRefund(dailyReport.refundingTransaction!)}
                  disabled={dailyReport.processingRefund}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {dailyReport.processingRefund ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-5 h-5" />
                  )}
                  Възстанови
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variant Picker Modal */}
      {variants.showVariantPicker && variants.selectedVariableProduct && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="presentation"
          onClick={variants.closeVariantPicker}
          onKeyDown={(e) => e.key === 'Escape' && variants.closeVariantPicker()}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                {variants.selectedVariableProduct.images?.[0]?.src ? (
                  <div className="w-16 h-16 rounded-lg flex-shrink-0">
                    <img
                      src={variants.selectedVariableProduct.images[0].src}
                      alt={variants.selectedVariableProduct.name}
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling as HTMLElement | null;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                    />
                    <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 items-center justify-center hidden">
                      <Package className="w-7 h-7 text-gray-400" />
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Package className="w-7 h-7 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {variants.selectedVariableProduct.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Избери вариант</p>
                </div>
                <button onClick={variants.closeVariantPicker} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {variants.loadingVariations ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : variants.productVariations.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Няма налични варианти</p>
                </div>
              ) : (
                variants.productVariations.map((variation: ProductVariation) => {
                  const variationPrice = parseFloat(variation.sale_price || variation.price || '0');
                  const regularPrice = parseFloat(variation.regular_price || variation.price || '0');
                  const onSale = variation.sale_price && parseFloat(variation.sale_price) > 0;
                  const inStock = variation.stock_status !== 'outofstock';

                  return (
                    <button
                      key={variation.id}
                      onClick={() => inStock && variants.handleAddVariation(variation)}
                      disabled={!inStock}
                      className={`w-full flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-left transition-colors ${
                        inStock ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                        {variation.image?.src ? (
                          <>
                            <img
                              src={variation.image.src}
                              alt={variants.getVariationName(variation)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const placeholder = target.nextElementSibling as HTMLElement | null;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                            <div className="w-full h-full items-center justify-center hidden">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {variants.getVariationName(variation)}
                        </p>
                        {variation.sku && <p className="text-xs text-gray-400">SKU: {variation.sku}</p>}
                        {!inStock && <p className="text-xs text-red-500">Изчерпан</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">{formatPrice(variationPrice)}</p>
                        {onSale && <p className="text-xs text-gray-400 line-through">{formatPrice(regularPrice)}</p>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
