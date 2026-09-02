import { ReactElement } from 'react';
import { User, X, Search, Loader2 } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import type { WooCommerceCustomer } from '../types';

interface POSCustomerSearchModalProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  loadingCustomers: boolean;
  customers: WooCommerceCustomer[];
  onSelectCustomer: (customer: WooCommerceCustomer) => void;
  onClose: () => void;
}

/**
 * Customer search modal for the POS checkout flow.
 */
export function POSCustomerSearchModal({
  searchTerm,
  onSearchTermChange,
  loadingCustomers,
  customers,
  onSelectCustomer,
  onClose,
}: POSCustomerSearchModalProps): ReactElement {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
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
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Търси по име, email или телефон..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- POS requires immediate input focus
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loadingCustomers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : searchTerm.length < 2 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Въведи поне 2 символа за търсене</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Няма намерени клиенти</p>
            </div>
          ) : (
            customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
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
  );
}

export default POSCustomerSearchModal;
