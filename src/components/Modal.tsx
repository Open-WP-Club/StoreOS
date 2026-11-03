import { useEffect, type ReactElement, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  onClose: () => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  /** Panel classes (background, size, padding...). Defaults to a compact card. */
  className?: string;
  /** Optional header with title and close button (also used as aria-label). */
  title?: string;
  /** 'top' = top-aligned, scrollable overlay (palettes/switchers). */
  position?: 'center' | 'top';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  children: ReactNode;
}

/** Shared modal shell: dimmed backdrop + dialog panel, Escape/backdrop to close. */
export default function Modal({
  onClose,
  closeOnEscape = true,
  closeOnBackdrop = true,
  className = 'w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5',
  title,
  position = 'center',
  children,
  ...aria
}: ModalProps): ReactElement {
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeOnEscape, onClose]);

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex justify-center z-50 ${
        position === 'top' ? 'items-start overflow-y-auto p-4 pt-[10vh]' : 'items-center'
      }`}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={className}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={title}
        {...aria}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Затвори"
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
