import React, { ReactElement } from 'react';
import { History, X, User, RotateCcw } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import type { RecentTransaction } from '../hooks/usePOSDailyReport';

interface POSRecentTransactionsModalProps {
  recentTransactions: RecentTransaction[];
  onClose: () => void;
  onRefund: (tx: RecentTransaction) => void;
}

/**
 * Modal showing recent POS transactions with refund option.
 */
export function POSRecentTransactionsModal({
  recentTransactions,
  onClose,
  onRefund,
}: POSRecentTransactionsModalProps): ReactElement {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
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
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5" />
            Последни транзакции
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Transactions List */}
        <div className="max-h-96 overflow-y-auto">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Няма скорошни транзакции</p>
            </div>
          ) : (
            recentTransactions.map((tx) => {
              const date = new Date(tx.timestamp);
              const isToday = new Date().toDateString() === date.toDateString();
              const timeStr = date.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
              const dateStr = isToday ? 'Днес' : date.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });

              return (
                <div
                  key={`${tx.id}-${tx.timestamp}`}
                  className={`p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                    tx.refunded
                      ? 'bg-red-50/50 dark:bg-red-900/10'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${
                          tx.refunded
                            ? 'text-gray-400 dark:text-gray-500 line-through'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          Поръчка #{tx.id}
                        </p>
                        {tx.refunded && (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full font-medium">
                            Възстановена
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {tx.itemCount} артикула • {tx.paymentMethod}
                      </p>
                      {tx.customerName && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" />
                          {tx.customerName}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        tx.refunded
                          ? 'text-gray-400 dark:text-gray-500 line-through'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {formatPrice(tx.total)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {dateStr}, {timeStr}
                      </p>
                      {!tx.refunded && (
                        <button
                          onClick={() => onRefund(tx)}
                          className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 ml-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Възстанови
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {recentTransactions.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Показани {recentTransactions.length} транзакции
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default POSRecentTransactionsModal;
