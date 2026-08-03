import React, { ReactElement } from 'react';
import {
  X,
  Banknote,
  CreditCard,
  QrCode,
  BarChart3,
  Download,
  Trophy,
  Medal,
  Award,
} from 'lucide-react';
import { formatPrice } from '../utils/currency';
import type { DailyReportStats } from '../hooks/usePOSDailyReport';

interface POSDailyReportModalProps {
  stats: DailyReportStats;
  onClose: () => void;
  onExportCSV: () => void;
}

/**
 * Modal showing daily POS report stats with export option.
 */
export function POSDailyReportModal({
  stats,
  onClose,
  onExportCSV,
}: POSDailyReportModalProps): ReactElement {
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
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Дневен отчет
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {/* Date */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('bg-BG', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>

          {/* Summary Stats */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{formatPrice(stats.totalSales)}</p>
                <p className="text-xs opacity-80">Общо продажби</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.orderCount}</p>
                <p className="text-xs opacity-80">Поръчки</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatPrice(stats.averageOrder)}</p>
                <p className="text-xs opacity-80">Средна стойност</p>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
              По метод на плащане
            </h4>
            {Object.keys(stats.byPaymentMethod).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                Няма транзакции за днес
              </p>
            ) : (
              Object.entries(stats.byPaymentMethod).map(([method, data]) => (
                <div
                  key={method}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {method === 'Каса' && <Banknote className="w-4 h-4 text-green-600" />}
                    {method === 'Карта' && <CreditCard className="w-4 h-4 text-blue-600" />}
                    {method === 'Друго' && <QrCode className="w-4 h-4 text-purple-600" />}
                    <span className="font-medium text-gray-900 dark:text-white">{method}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatPrice(data.total)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {data.count} поръчки
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Top Selling Products */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Най-продавани днес
            </h4>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                Няма данни за продукти
              </p>
            ) : (
              <div className="space-y-2">
                {stats.topProducts.map((product, index) => (
                  <div
                    key={product.productId}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {index === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                      {index === 1 && <Medal className="w-5 h-5 text-gray-400" />}
                      {index === 2 && <Award className="w-5 h-5 text-amber-700" />}
                      {index > 2 && (
                        <span className="text-sm font-medium text-gray-400">{index + 1}.</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
                        {product.name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-blue-600">x{product.quantity}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatPrice(product.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onExportCSV}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Експорт CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export default POSDailyReportModal;
