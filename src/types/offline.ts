export type PendingOperationType =
  | 'create_order'
  | 'update_order'
  | 'create_product'
  | 'update_product'
  | 'update_stock'
  | 'create_coupon'
  | 'update_coupon'
  | 'delete_coupon'
  | 'batch_coupons'
  | 'delete_product'
  | 'batch_products'
  | 'batch_orders';

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
