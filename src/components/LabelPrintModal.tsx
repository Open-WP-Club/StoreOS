import React, { useState } from 'react';
import { code128Modules, LABEL_SIZES, renderLabelsHtml } from '../utils/barcodeLabel';
import { printHtml } from '../utils/printReceipt';
import { exportLabelsPDF } from '../utils/pdfExport';
import { formatPrice } from '../utils/currency';
import useAppSettings from '../stores/appSettingsStore';
import Modal from './Modal';
import type { Product } from '../types';

interface LabelPrintModalProps {
  products: Product[];
  currencySymbol: string | null;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const MAX_HTML = 190 * 1024; // main process rejects > 200 KB
const inputCls =
  'px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md';
const btnCls = 'px-3 py-1.5 text-sm rounded-md disabled:opacity-50';

const LabelPrintModal: React.FC<LabelPrintModalProps> = ({
  products,
  currencySymbol,
  onClose,
  showToast,
}) => {
  const defaultPrinter = useAppSettings((s) => s.defaultPrinter);
  const [sizeId, setSizeId] = useState(LABEL_SIZES[0]!.id);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);

  const size = LABEL_SIZES.find((s) => s.id === sizeId) ?? LABEL_SIZES[0]!;
  const items = products.map((p) => ({ name: p.name, sku: p.sku || '', price: p.price || '' }));
  const n = Math.max(1, Math.min(100, Math.floor(copies) || 1));
  const noSku = items.filter((i) => !i.sku).length;

  const handlePrint = async (): Promise<void> => {
    const html = renderLabelsHtml(items, {
      size,
      showName,
      showPrice,
      showSku,
      copies: n,
      currencySymbol,
    });
    if (html.length > MAX_HTML) {
      showToast('Too many labels at once; select fewer products or copies', 'error');
      return;
    }
    setBusy(true);
    const ok = await printHtml(html, defaultPrinter);
    setBusy(false);
    if (ok) onClose();
    else showToast('Printing failed or is unavailable', 'error');
  };

  const handlePdf = async (): Promise<void> => {
    const labels = items.flatMap((i) =>
      Array.from({ length: n }, () => ({
        lines: [
          ...(showName ? [i.name] : []),
          ...(showSku && i.sku ? [i.sku] : []),
          ...(showPrice && i.price ? [formatPrice(i.price, currencySymbol)] : []),
        ],
        modules: showSku ? code128Modules(i.sku) : null,
      }))
    );
    setBusy(true);
    try {
      await exportLabelsPDF(labels, size, 'labels.pdf');
    } catch {
      showToast('PDF export failed', 'error');
    }
    setBusy(false);
  };

  return (
    <Modal
      onClose={onClose}
      title="Print labels"
      className="w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 text-gray-900 dark:text-white"
    >
      <div className="space-y-3 text-sm">
        <p className="text-gray-600 dark:text-gray-300">
          {products.length} product{products.length !== 1 ? 's' : ''} selected
        </p>
        <label className="flex items-center justify-between gap-3">
          Label size
          <select value={sizeId} onChange={(e) => setSizeId(e.target.value)} className={inputCls}>
            {LABEL_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          Copies per product
          <input
            type="number"
            min={1}
            max={100}
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value))}
            className={`${inputCls} w-20`}
          />
        </label>
        <div className="flex gap-4">
          {(
            [
              ['Name', showName, setShowName],
              ['Price', showPrice, setShowPrice],
              ['SKU + barcode', showSku, setShowSku],
            ] as const
          ).map(([label, val, set]) => (
            <label key={label} className="flex items-center gap-1.5">
              <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        {showSku && noSku > 0 && (
          <p className="text-amber-600 dark:text-amber-400">
            {noSku} product{noSku !== 1 ? 's have' : ' has'} no SKU, so no barcode.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className={`${btnCls} bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-100`}
          >
            Cancel
          </button>
          <button
            onClick={() => void handlePdf()}
            disabled={busy}
            className={`${btnCls} bg-gray-600 text-white hover:bg-gray-700`}
          >
            PDF
          </button>
          <button
            onClick={() => void handlePrint()}
            disabled={busy}
            className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700`}
          >
            Print
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LabelPrintModal;
