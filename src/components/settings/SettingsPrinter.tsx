import { memo, useState, useEffect } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { t } from '../../utils/i18n';
import type { Language } from '../../utils/i18n';

interface SettingsPrinterProps {
  language: Language;
  defaultPrinter: string | null;
  setDefaultPrinter: (p: string | null) => void;
}

const SettingsPrinter = memo(function SettingsPrinter({
  language,
  defaultPrinter,
  setDefaultPrinter,
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
          <RefreshCw
            className={`w-5 h-5 text-gray-500 ${loadingPrinters ? 'animate-spin' : ''}`}
          />
        </button>
      </div>
    </section>
  );
});

export default SettingsPrinter;
