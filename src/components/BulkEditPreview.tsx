import React from 'react';
import { X, ChevronLeft, AlertTriangle } from 'lucide-react';

interface PreviewRow {
  id: number;
  name: string;
  oldRegularPrice: string;
  newRegularPrice: string | null;
  oldSalePrice: string;
  newSalePrice: string | null;
}

interface BulkEditPreviewProps {
  rows: PreviewRow[];
  effectiveProductsCount: number;
  changeSalePrice: boolean;
  saleDateFrom: string;
  saleDateTo: string;
  changePrice: boolean;
  isSaving: boolean;
  onClose: () => void;
  onBack: () => void;
  onSave: () => void;
}

const BulkEditPreview: React.FC<BulkEditPreviewProps> = ({
  rows,
  effectiveProductsCount,
  changeSalePrice,
  saleDateFrom,
  saleDateTo,
  changePrice,
  isSaving,
  onClose,
  onBack,
  onSave,
}) => {
  const priceChanges = rows.filter((r) => r.newRegularPrice !== null || r.newSalePrice !== null);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Preview Changes — {effectiveProductsCount} products
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Warning if no price changes visible */}
          {priceChanges.length === 0 && (
            <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                No price changes selected. Other fields (stock, visibility, etc.) will still be updated.
              </p>
            </div>
          )}

          {/* Sale date range summary */}
          {changeSalePrice && (saleDateFrom || saleDateTo) && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 text-sm text-blue-900 dark:text-blue-300">
              Sale period:{' '}
              <strong>{saleDateFrom || '—'}</strong>
              {' → '}
              <strong>{saleDateTo || '—'}</strong>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-2 font-medium">Product</th>
                  {(changePrice) && (
                    <>
                      <th className="pb-2 font-medium px-3">Regular Price</th>
                      <th className="pb-2 font-medium px-3">→ New</th>
                    </>
                  )}
                  {(changeSalePrice) && (
                    <>
                      <th className="pb-2 font-medium px-3">Sale Price</th>
                      <th className="pb-2 font-medium px-3">→ New</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-2 text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
                      {row.name}
                    </td>
                    {changePrice && (
                      <>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                          {row.oldRegularPrice}
                        </td>
                        <td className="py-2 px-3 font-semibold text-green-700 dark:text-green-400">
                          {row.newRegularPrice ?? '—'}
                        </td>
                      </>
                    )}
                    {changeSalePrice && (
                      <>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                          {row.oldSalePrice}
                        </td>
                        <td className="py-2 px-3 font-semibold text-green-700 dark:text-green-400">
                          {row.newSalePrice ?? '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || effectiveProductsCount === 0}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : `Confirm — Update ${effectiveProductsCount} Products`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEditPreview;
