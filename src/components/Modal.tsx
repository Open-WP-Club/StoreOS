import { useEffect, type ReactElement, type ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  /** Panel classes (background, size, padding...). */
  className: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  children: ReactNode;
}

/** Shared modal shell: dimmed backdrop + dialog panel, Escape/backdrop to close. */
export default function Modal({
  onClose,
  closeOnEscape = true,
  closeOnBackdrop = true,
  className,
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
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
        {...aria}
      >
        {children}
      </div>
    </div>
  );
}
