import type { ReactNode } from 'react';
import type { OnBatchLoaded } from './api';

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

export interface FilterPreset {
  id: string;
  name: string;
  type: 'orders' | 'products';
  filters: Record<string, unknown>;
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

export interface DataManagerProps {
  dataType: 'products' | 'orders';
  onDataLoaded: <T>(data: T[]) => void;
  onLoading?: (isLoading: boolean) => void;
  onError?: (error: string) => void;
  forceRefresh?: boolean | number;
  progressiveLoading?: {
    batchSize?: number;
    batchDelay?: number;
  };
  children?: ReactNode;
}

export interface UseProgressiveLoadingOptions<T> {
  dataType: 'products' | 'orders';
  batchSize?: number;
  batchDelay?: number;
  onBatchLoaded?: OnBatchLoaded<T>;
  autoStart?: boolean;
}

export interface UseProgressiveLoadingResult<T> {
  data: T[];
  loading: boolean;
  progress: number;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

export interface UseKeyboardShortcutOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}
