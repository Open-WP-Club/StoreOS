import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
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

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLDivElement>(null);

  // Initial focus (first autofocus/focusable, else the panel) + restore focus on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      (panel.querySelector<HTMLElement>('[autofocus],[data-autofocus]') ?? panel).focus();
    }
    return () => {
      if (prev?.isConnected) prev.focus();
    };
  }, []);

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
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key !== 'Tab') return;
          // Focus trap: cycle Tab / Shift+Tab inside the dialog.
          const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
          const first = items[0];
          const last = items[items.length - 1];
          if (!first || !last) {
            e.preventDefault();
            return;
          }
          const active = document.activeElement;
          if (e.shiftKey && (active === first || active === e.currentTarget)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        aria-label={title}
        {...aria}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Затвори"
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
