import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';
import { exportTableToPDF } from '../utils/pdfExport';
import { buildReorderReport, DEFAULT_TARGET_DAYS } from '../utils/reorderReport';
import ExportMenu from './ExportMenu';
import Modal from './Modal';
import type { Order, Product } from '../types';

interface ReorderReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  orders: Order[];
  lowStockThreshold: number;
  storeName: string;
}

const inputCls =
  'px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md';

const ReorderReportModal: React.FC<ReorderReportModalProps> = ({
  isOpen,
  onClose,
  products,
  orders,
  lowStockThreshold,
  storeName,
}) => {
  const [targetDays, setTargetDays] = useState<number>(DEFAULT_TARGET_DAYS);
  // Manual overrides keyed by product id; reset whenever the target cover changes.
  const [overrides, setOverrides] = useState<{ days: number; qty: Record<number, number> }>({
    days: targetDays,
    qty: {},
  });

  const rows = useMemo(
    () => buildReorderReport(products, orders, { lowStockThreshold, targetDays }),
    [products, orders, lowStockThreshold, targetDays]
  );

  if (!isOpen) return null;

  const edits = overrides.days === targetDays ? overrides.qty : {};
  const finalRows = rows.map((r) => ({ ...r, orderQty: edits[r.id] ?? r.suggestedQty }));
  const daysLabel = (d: number | null): string => (d === null ? '∞' : String(d));
  const stamp = new Date().toISOString().split('T')[0] ?? '';

  const columns = [
    { key: 'supplier', label: 'Supplier' },
    { key: 'name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'stock', label: 'Stock' },
    { key: 'sold30d', label: 'Sold (30d)' },
    { key: 'daysLeft', label: 'Days left', format: (v: unknown) => daysLabel(v as number | null) },
    { key: 'orderQty', label: 'Reorder qty' },
  ];

  const handleCSV = (): void => {
    exportToCSV(finalRows, columns, `reorder-${storeName}-${stamp}.csv`);
  };
  const handlePDF = (): void => {
    exportTableToPDF(finalRows, columns, {
      title: `Reorder report - ${storeName}`,
      orientation: 'landscape',
    }).catch(() => undefined);
  };

  return (
    <Modal
      onClose={onClose}
      aria-label="Reorder report"
      className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] mx-4 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Reorder report</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-3 p-4 text-sm text-gray-700 dark:text-gray-300">
        <label htmlFor="reorder-target-days">Target cover (days)</label>
        <input
          id="reorder-target-days"
          type="number"
          min={1}
          value={targetDays}
          onChange={(e) => setTargetDays(Math.max(1, Number(e.target.value) || 1))}
          className={`w-20 ${inputCls}`}
        />
        <span className="text-gray-500 dark:text-gray-400">
          Based on the last 30 days of sales; low-stock threshold {lowStockThreshold}.
        </span>
        <div className="ml-auto">
          <ExportMenu
            onExportCSV={handleCSV}
            onExportPDF={handlePDF}
            disabled={finalRows.length === 0}
          />
        </div>
      </div>

      <div className="overflow-auto px-4 pb-4">
        {finalRows.length === 0 ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            Nothing needs reordering.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                {columns.map((c) => (
                  <th scope="col" key={c.key} className="py-2 pr-3 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-gray-900 dark:text-gray-100">
              {finalRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-3">{r.supplier}</td>
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3">{r.sku}</td>
                  <td className="py-2 pr-3">{r.stock}</td>
                  <td className="py-2 pr-3">{r.sold30d}</td>
                  <td className="py-2 pr-3">{daysLabel(r.daysLeft)}</td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      aria-label={`Reorder quantity for ${r.name}`}
                      value={r.orderQty}
                      onChange={(e) =>
                        setOverrides({
                          days: targetDays,
                          qty: {
                            ...edits,
                            [r.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          },
                        })
                      }
                      className={`w-24 ${inputCls}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
};

export default ReorderReportModal;
