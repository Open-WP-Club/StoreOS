import { ReactElement } from 'react';
import { Keyboard, X } from 'lucide-react';

interface POSShortcutsPanelProps {
  onClose: () => void;
}

/**
 * Keyboard shortcuts legend popup for the POS page.
 */
export function POSShortcutsPanel({ onClose }: POSShortcutsPanelProps): ReactElement {
  return (
    <div className="absolute top-16 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Keyboard className="w-4 h-4" />
          Клавиатурни shortcuts
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Плащане</span>
          <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F8</kbd>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">+ Количество</span>
          <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">+</kbd>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">- Количество</span>
          <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">-</kbd>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Затвори</span>
          <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Esc</kbd>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">При плащане:</p>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Каса</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F1</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Карта</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F2</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Друго</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F3</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Завърши</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">F4</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

export default POSShortcutsPanel;
