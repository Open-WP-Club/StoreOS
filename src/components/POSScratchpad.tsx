import { ReactElement } from 'react';
import { StickyNote, X, Trash2 } from 'lucide-react';

interface POSScratchpadProps {
  note: string;
  onNoteChange: (note: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Scratchpad note popup for the POS page.
 */
export function POSScratchpad({
  note,
  onNoteChange,
  onClear,
  onClose,
}: POSScratchpadProps): ReactElement {
  return (
    <div className="absolute top-16 right-4 z-50 bg-yellow-50 dark:bg-gray-800 rounded-xl shadow-xl border border-yellow-200 dark:border-yellow-700 p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-yellow-600" />
          Бележник
        </h3>
        <div className="flex items-center gap-2">
          {note.trim() && (
            <button
              onClick={onClear}
              className="p-1 hover:bg-yellow-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500"
              title="Изчисти"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-yellow-100 dark:hover:bg-gray-700 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Запиши си нещо..."
        rows={6}
        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-yellow-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
      />
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Запазва се автоматично
      </p>
    </div>
  );
}

export default POSScratchpad;
