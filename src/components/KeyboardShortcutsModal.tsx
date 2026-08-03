import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useKeyboardShortcut, useIsMac } from '../hooks/useKeyboardShortcut';

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  category: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['⌘K', 'Ctrl+K'], description: 'Open command palette / quick search' },
      { keys: ['⌘P', 'Ctrl+P'], description: 'Open command palette' },
      { keys: ['Alt+H'], description: 'Go to Dashboard' },
      { keys: ['Alt+O'], description: 'Go to Orders' },
      { keys: ['Alt+P'], description: 'Go to Products' },
      { keys: ['Alt+C'], description: 'Go to Customers' },
      { keys: ['Alt+U'], description: 'Go to Coupons' },
    ],
  },
  {
    category: 'Data',
    shortcuts: [
      { keys: ['⌘R', 'Ctrl+R'], description: 'Refresh / reload page' },
      { keys: ['⌘N', 'Ctrl+N'], description: 'Navigate to Products (create new)' },
    ],
  },
  {
    category: 'General',
    shortcuts: [
      { keys: ['?', 'Ctrl+/'], description: 'Show this keyboard shortcuts help' },
      { keys: ['Esc'], description: 'Close modal / dismiss overlay' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
      {children}
    </kbd>
  );
}

function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps): React.ReactElement | null {
  const isMac = useIsMac();

  useKeyboardShortcut('escape', onClose, { enabled: isOpen, preventDefault: false });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close keyboard shortcuts"
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-start justify-center p-4 pt-[10vh]">
        <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Keyboard Shortcuts
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Shortcut list */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
            {SHORTCUT_CATEGORIES.map(({ category, shortcuts }) => (
              <div key={category} className="px-5 py-3">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {category}
                </div>
                <ul className="space-y-2">
                  {shortcuts.map(({ keys, description }) => (
                    <li key={description} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{description}</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        {/* Show Mac key on Mac, Windows key on Windows — fall back to both */}
                        {keys.length === 2 ? (
                          <Kbd>{isMac ? keys[0] : keys[1]}</Kbd>
                        ) : (
                          <Kbd>{keys[0]}</Kbd>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Press <Kbd>?</Kbd> or <Kbd>Ctrl+/</Kbd> to open this panel at any time
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsModal;
