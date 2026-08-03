import { useState, useRef, useEffect, ReactElement } from 'react';
import { Download, ChevronDown, Printer } from 'lucide-react';

interface ExportMenuProps {
  onExportCSV: () => void;
  onExportPDF: () => void;
  onPrint?: () => void;
  disabled?: boolean;
}

export default function ExportMenu({ onExportCSV, onExportPDF, onPrint, disabled }: ExportMenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
          <button
            onClick={() => {
              onExportCSV();
              setOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              onExportPDF();
              setOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Export PDF
          </button>
          {onPrint && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => {
                  onPrint();
                  setOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
