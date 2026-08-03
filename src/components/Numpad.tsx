import React, { ReactElement } from 'react';
import { X, Check } from 'lucide-react';

export interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  allowDecimal?: boolean;
}

/**
 * On-screen numpad component for POS quantity and amount input.
 */
export function Numpad({ value, onChange, onClose, onConfirm, title = 'Въведи стойност', allowDecimal = true }: NumpadProps): ReactElement {
  const handleKey = (key: string): void => {
    if (key === 'C') {
      onChange('');
    } else if (key === '⌫') {
      onChange(value.slice(0, -1));
    } else if (key === '.') {
      if (allowDecimal && !value.includes('.')) {
        onChange(value + '.');
      }
    } else {
      onChange(value + key);
    }
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', allowDecimal ? '.' : '⌫'];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 w-80"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Display */}
        <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 mb-4">
          <div className="text-3xl font-bold text-right text-gray-900 dark:text-white min-h-[40px]">
            {value || '0'}
          </div>
        </div>

        {/* Numpad Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {keys.map((key) => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className={`p-4 text-xl font-semibold rounded-xl transition-colors ${
                key === 'C'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Backspace button */}
        {allowDecimal && (
          <button
            onClick={() => handleKey('⌫')}
            className="w-full p-3 mb-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-semibold"
          >
            ⌫ Изтрий
          </button>
        )}

        {/* Confirm Button */}
        <button
          onClick={onConfirm}
          className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Потвърди
        </button>
      </div>
    </div>
  );
}

export default Numpad;
