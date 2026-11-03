export type Theme = 'light' | 'dark';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface RecentSearch {
  id: string;
  query: string;
  type: 'global' | 'orders' | 'products' | 'customers';
  storeId: string | null;
  timestamp: string;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export interface FilterPreset {
  id: string;
  name: string;
  type: 'orders' | 'products' | 'customers';
  filters: Record<string, unknown>;
  /** Saved-view extras (optional so legacy presets still load) */
  search?: string;
  pageSize?: number;
  /** Orders/products lists only; missing => default sort / all columns shown */
  sort?: SortState;
  hiddenColumns?: string[];
  storeId: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
  showPageSize?: boolean;
  onPageSizeChange?: (size: number) => void;
}
