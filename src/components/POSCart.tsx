import React, { ReactElement } from 'react';
import {
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Package,
  User,
  Percent,
  Check,
  Loader2,
  Keyboard,
  StickyNote,
} from 'lucide-react';
import { formatPrice } from '../utils/currency';
import type { WooCommerceCustomer } from '../types';
import type { CartItem } from '../stores/posStore';

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

interface POSCartProps {
  cart: CartItem[];
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  paymentMethod: 'cash' | 'card' | 'other';
  setPaymentMethod: (method: 'cash' | 'card' | 'other') => void;
  amountTendered: number;
  setAmountTendered: (amount: number) => void;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  setDiscount: (type: 'percent' | 'fixed', value: number) => void;
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTotal: () => number;
  getChange: () => number;
  getItemCount: () => number;
  showCheckout: boolean;
  setShowCheckout: (show: boolean) => void;
  processingOrder: boolean;
  onCheckout: () => void;
  selectedCustomer: WooCommerceCustomer | null;
  onClearCustomer: () => void;
  onShowCustomerSearch: () => void;
  orderNote: string;
  onOrderNoteChange: (note: string) => void;
  currencySymbol: string;
  onOpenQuantityNumpad: (productId: number, currentQty: number) => void;
  onOpenAmountNumpad: () => void;
}

/**
 * POS cart panel with items, discount, totals, and payment controls.
 */
export function POSCart({
  cart,
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
  showCheckout,
  setShowCheckout,
  processingOrder,
  onCheckout,
  selectedCustomer,
  onClearCustomer,
  onShowCustomerSearch,
  orderNote,
  onOrderNoteChange,
  currencySymbol,
  onOpenQuantityNumpad,
  onOpenAmountNumpad,
}: POSCartProps): ReactElement {
  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Cart Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Кошница
          </h2>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
              {getItemCount()} артикула
            </span>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                Изчисти
              </button>
            )}
          </div>
        </div>

        {/* Customer Section */}
        <div className="mt-3">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/30 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
                  <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {selectedCustomer.email}
                  </p>
                </div>
              </div>
              <button
                onClick={onClearCustomer}
                className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onShowCustomerSearch}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 transition-colors"
            >
              <User className="w-4 h-4" />
              Добави клиент
            </button>
          )}
        </div>

        {/* Employee Note */}
        <div className="mt-3">
          <div className="relative">
            <StickyNote className="absolute left-3 top-3 w-4 h-4 text-gray-400 dark:text-gray-300" />
            <textarea
              value={orderNote}
              onChange={(e) => onOrderNoteChange(e.target.value)}
              placeholder="Бележка за поръчката..."
              rows={2}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-300 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Кошницата е празна</p>
            <p className="text-sm mt-1">Добавете продукти от ляво</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product.id}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0">
                  {item.product.images?.[0]?.src ? (
                    <img
                      src={item.product.images[0].src}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.product.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatPrice(item.price)} × {item.quantity}
                  </p>
                </div>

                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onOpenQuantityNumpad(item.product.id, item.quantity)}
                    className="w-12 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-center font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    title="Натисни за numpad"
                  >
                    {item.quantity}
                  </button>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Discount Section */}
      {cart.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <input
              type="number"
              value={discountValue || ''}
              onChange={(e) => setDiscount(discountType, parseFloat(e.target.value) || 0)}
              placeholder="Отстъпка"
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
            />
            <select
              value={discountType}
              onChange={(e) => setDiscount(e.target.value as 'percent' | 'fixed', discountValue)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
            >
              <option value="percent">%</option>
              <option value="fixed">{currencySymbol || 'fixed'}</option>
            </select>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Междинна сума</span>
          <span className="text-gray-900 dark:text-white">{formatPrice(getSubtotal())}</span>
        </div>
        {discountValue > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Отстъпка</span>
            <span>-{formatPrice(getDiscountAmount())}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-gray-900 dark:text-white">Общо</span>
          <span className="text-blue-600">{formatPrice(getTotal())}</span>
        </div>
      </div>

      {/* Payment Buttons */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {!showCheckout ? (
          <button
            onClick={() => setShowCheckout(true)}
            disabled={cart.length === 0}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            Плащане
          </button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`py-3 rounded-xl font-medium flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'cash'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span className="text-xs">Каса</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`py-3 rounded-xl font-medium flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'card'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs">Карта</span>
              </button>
              <button
                onClick={() => setPaymentMethod('other')}
                className={`py-3 rounded-xl font-medium flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'other'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span className="text-xs">Друго</span>
              </button>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amountTendered || ''}
                    onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
                    placeholder="Платена сума"
                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-lg font-medium text-center text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                  <button
                    onClick={onOpenAmountNumpad}
                    className="px-4 py-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    title="Отвори numpad"
                  >
                    <Keyboard className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setAmountTendered(amount)}
                      className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white transition-colors"
                    >
                      {amount} {currencySymbol}
                    </button>
                  ))}
                </div>
                {amountTendered >= getTotal() && (
                  <div className="text-center py-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Ресто: {formatPrice(getChange())}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Отказ
              </button>
              <button
                onClick={onCheckout}
                disabled={processingOrder || (paymentMethod === 'cash' && amountTendered < getTotal())}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {processingOrder ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Завърши
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default POSCart;
