import { useState, ReactElement } from 'react';
import {
  CheckSquare,
  X,
  RefreshCw,
  Download,
  Trash2,
  Printer,
  ChevronDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { Order, OrderStatus } from '../types';

interface BulkActionsBarProps {
  selectedCount: number;
  selectedOrders: Order[];
  onStatusChange: (status: OrderStatus) => Promise<void>;
  onExport: () => void;
  onDelete?: () => Promise<void>;
  onPrintLabels?: () => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
}

const ORDER_STATUSES: Array<{ value: OrderStatus; label: string; color: string }> = [
  { value: 'pending', label: 'Pending Payment', color: 'bg-gray-100 text-gray-800' },
  { value: 'processing', label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  { value: 'on-hold', label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  { value: 'refunded', label: 'Refunded', color: 'bg-purple-100 text-purple-800' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-800' },
];

export default function BulkActionsBar({
  selectedCount,
  selectedOrders,
  onStatusChange,
  onExport,
  onDelete,
  onPrintLabels,
  onClearSelection,
  isProcessing = false,
}: BulkActionsBarProps): ReactElement {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('processing');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Calculate totals for selected orders
  const totalValue = selectedOrders.reduce(
    (sum, order) => sum + parseFloat(order.total || '0'),
    0
  );

  // Get currency symbol from first order
  const currencySymbol = selectedOrders[0]?.currency_symbol || '';

  const handleStatusChange = async (): Promise<void> => {
    setShowStatusDropdown(false);
    await onStatusChange(selectedStatus);
  };

  const handleDelete = async (): Promise<void> => {
    setShowDeleteConfirm(false);
    if (onDelete) {
      await onDelete();
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 rounded-lg shadow-lg p-4 mb-4 animate-in slide-in-from-top duration-200">
      <div className="flex items-center justify-between">
        {/* Left: Selection info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white">
            <CheckSquare className="w-5 h-5" />
            <span className="font-semibold text-lg">
              {selectedCount} {selectedCount === 1 ? 'поръчка' : 'поръчки'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-blue-100 text-sm">
            <span className="px-2 py-1 bg-white/20 rounded">
              Общо: {totalValue.toFixed(2)} {currencySymbol}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Status Change Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Смени статус</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showStatusDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-20">
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Избери нов статус
                </div>
                {ORDER_STATUSES.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => {
                      setSelectedStatus(status.value);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                      selectedStatus === status.value ? 'bg-gray-100 dark:bg-gray-700' : ''
                    }`}
                  >
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    {selectedStatus === status.value && (
                      <span className="text-blue-600 dark:text-blue-400">✓</span>
                    )}
                  </button>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 px-3">
                  <button
                    onClick={handleStatusChange}
                    disabled={isProcessing}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Приложи
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Export Button */}
          <button
            onClick={onExport}
            disabled={isProcessing}
            className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors disabled:opacity-50"
            title="Експорт в CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Експорт</span>
          </button>

          {/* Print Labels Button (if available) */}
          {onPrintLabels && (
            <button
              onClick={onPrintLabels}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors disabled:opacity-50"
              title="Печат етикети"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Печат</span>
            </button>
          )}

          {/* Delete Button (if available) */}
          {onDelete && (
            <div className="relative">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                title="Изтрий избраните"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Delete Confirmation Popup */}
              {showDeleteConfirm && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-red-200 dark:border-red-800 p-4 z-20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Изтриване на {selectedCount} поръчки?
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Това действие не може да бъде отменено.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Отказ
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Изтрий
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clear Selection */}
          <button
            onClick={onClearSelection}
            className="p-2 hover:bg-white/20 text-white rounded-lg transition-colors"
            title="Изчисти селекцията"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showStatusDropdown || showDeleteConfirm) && (
        <div
          className="fixed inset-0 z-10"
          role="presentation"
          onClick={() => {
            setShowStatusDropdown(false);
            setShowDeleteConfirm(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowStatusDropdown(false);
              setShowDeleteConfirm(false);
            }
          }}
        />
      )}
    </div>
  );
}
