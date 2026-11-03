import { memo, useState, useEffect } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import NumberInput from '../NumberInput';
import { MAX_DISCOUNT_PERCENT } from '../../utils/posPricing';
import { t } from '../../utils/i18n';
import type { Language } from '../../utils/i18n';

interface SettingsPrinterProps {
  language: Language;
  defaultPrinter: string | null;
  setDefaultPrinter: (p: string | null) => void;
  autoPrintReceipt: boolean;
  setAutoPrintReceipt: (v: boolean) => void;
  receiptShowLogo: boolean;
  setReceiptShowLogo: (v: boolean) => void;
  receiptVatRate: number;
  setReceiptVatRate: (v: number) => void;
  maxDiscountPercent: number;
  setMaxDiscountPercent: (v: number) => void;
  openCashDrawer: boolean;
  setOpenCashDrawer: (v: boolean) => void;
}

const SettingsPrinter = memo(function SettingsPrinter({
  language,
  defaultPrinter,
  setDefaultPrinter,
  autoPrintReceipt,
  setAutoPrintReceipt,
  receiptShowLogo,
  setReceiptShowLogo,
  receiptVatRate,
  setReceiptVatRate,
  maxDiscountPercent,
  setMaxDiscountPercent,
  openCashDrawer,
  setOpenCashDrawer,
}: SettingsPrinterProps) {
  const [printers, setPrinters] = useState<string[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  useEffect(() => {
    const loadPrinters = async (): Promise<void> => {
      setLoadingPrinters(true);
      try {
        if (window.electronAPI && 'getPrinters' in window.electronAPI) {
          const printerList = await (
            window.electronAPI as { getPrinters: () => Promise<string[]> }
          ).getPrinters();
          setPrinters(printerList);
        } else {
          setPrinters(['Системен принтер']);
        }
      } catch {
        setPrinters(['Системен принтер']);
      } finally {
        setLoadingPrinters(false);
      }
    };

    loadPrinters();
  }, []);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Printer className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('printerLabel', language)}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={defaultPrinter || ''}
          onChange={(e) => setDefaultPrinter(e.target.value || null)}
          disabled={loadingPrinters}
          className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('printerNone', language)}</option>
          {printers.map((printer) => (
            <option key={printer} value={printer}>
              {printer}
            </option>
          ))}
        </select>
        <button
          onClick={() => window.location.reload()}
          disabled={loadingPrinters}
          className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          title={language === 'bg' ? 'Обнови списъка' : 'Refresh list'}
        >
          <RefreshCw className={`w-5 h-5 text-gray-500 ${loadingPrinters ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={autoPrintReceipt}
            onChange={(e) => setAutoPrintReceipt(e.target.checked)}
          />
          {language === 'bg'
            ? 'Автоматичен печат на бележка (80мм) при продажба'
            : 'Auto-print 80mm receipt on POS checkout'}
        </label>
        <label className="flex items-center gap-3">
          <NumberInput
            min={0}
            max={100}
            fallback={20}
            value={receiptVatRate}
            onValueChange={setReceiptVatRate}
            className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white text-center"
          />
          {language === 'bg'
            ? 'ДДС % в бележката (включен в цените; 0 скрива реда)'
            : 'Receipt VAT % (included in prices; 0 hides the line)'}
        </label>
        <label className="flex items-center gap-3">
          <NumberInput
            min={0}
            max={100}
            fallback={MAX_DISCOUNT_PERCENT}
            value={maxDiscountPercent}
            onValueChange={setMaxDiscountPercent}
            className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white text-center"
          />
          {language === 'bg'
            ? 'POS: максимална отстъпка в % (0-100)'
            : 'POS: maximum discount % (0-100)'}
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={receiptShowLogo}
            onChange={(e) => setReceiptShowLogo(e.target.checked)}
          />
          {language === 'bg'
            ? 'Лого на магазина най-горе в бележката'
            : 'Print the store logo at the top of the receipt'}
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={openCashDrawer}
            disabled={!defaultPrinter}
            onChange={(e) => setOpenCashDrawer(e.target.checked)}
          />
          {language === 'bg'
            ? 'Отваряне на касовото чекмедже (ESC/POS) при плащане в брой'
            : 'Open cash drawer (ESC/POS) on cash payments'}
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {language === 'bg'
            ? 'Чекмеджето изисква избран принтер и е нетествано с реален хардуер (macOS/Linux).'
            : 'The drawer needs a selected printer and is untested with real hardware (macOS/Linux only).'}
        </p>
      </div>
    </section>
  );
});

export default SettingsPrinter;
