export type PendingOperationType =
  | 'create_order'
  | 'update_order'
  | 'create_product'
  | 'update_product'
  | 'update_stock'
  | 'create_coupon'
  | 'update_coupon'
  | 'delete_coupon';

export interface PendingOperation {
  id: string;
  type: PendingOperationType;
  data: Record<string, unknown>;
  storeId: string;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface OfflineState {
  isOnline: boolean;
  pendingOperations: PendingOperation[];
  lastSyncAttempt: number | null;
}
