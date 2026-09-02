import { ReactElement } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import type { RecentTransaction } from '../hooks/usePOSDailyReport';

interface POSRefundConfirmModalProps {
  transaction: RecentTransaction;
  processing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Refund confirmation modal for the POS daily report / recent transactions flow.
 */
export function POSRefundConfirmModal({
  transaction,
  processing,
  onCancel,
  onConfirm,
}: POSRefundConfirmModalProps): ReactElement {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
      onClick={() => !processing && onCancel()}
      onKeyDown={(e) => e.key === 'Escape' && !processing && onCancel()}
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
            Сигурни ли сте, че искате да възстановите поръчка #{transaction.id} на стойност{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatPrice(transaction.total)}
            </span>
            ?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={processing}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Отказ
            </button>
            <button
              onClick={onConfirm}
              disabled={processing}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processing ? (
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
  );
}

export default POSRefundConfirmModal;
