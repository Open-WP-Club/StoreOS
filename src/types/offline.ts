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
  | 'batch_orders'
  | 'create_category'
  | 'update_category'
  | 'delete_category'
  | 'create_attribute'
  | 'update_attribute'
  | 'delete_attribute'
  | 'create_attribute_term'
  | 'update_attribute_term'
  | 'delete_attribute_term'
  | 'create_tax_rate'
  | 'update_tax_rate'
  | 'delete_tax_rate'
  | 'create_tax_class'
  | 'delete_tax_class'
  | 'update_review'
  | 'delete_review'
  | 'batch_reviews'
  | 'create_variation'
  | 'update_variation'
  | 'delete_variation'
  | 'batch_variations';

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
