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
  | 'update_customer'
  | 'update_review'
  | 'delete_review'
  | 'batch_reviews'
  | 'create_variation'
  | 'update_variation'
  | 'delete_variation'
  | 'batch_variations';

/** Cached item state when an update was queued; lets replay detect edits made elsewhere meanwhile. */
export interface OperationBase {
  /** date_modified_gmt (or date_modified) of the item at queue time */
  modified: string;
  /** previous values of the fields the op changes */
  prev: Record<string, unknown>;
  /** batch ops: per-item snapshots of the update items, keyed by item id (modified/prev above are unused) */
  items?: Record<string, { modified: string; prev: Record<string, unknown> }>;
}

/** Set when replay found the server item changed under the same fields; the op is held, not sent. */
export interface OperationConflict {
  fields: string[];
  /** current server values of the conflicting fields */
  server: Record<string, unknown>;
  /** stock ops: my change relative to the expected quantity */
  stockDelta?: number;
  /** batch ops: the held (conflicting) update items; `fields`/`server` above are then empty */
  items?: Array<{ id: number; fields: string[]; server: Record<string, unknown> }>;
}

export interface PendingOperation {
  id: string;
  type: PendingOperationType;
  data: Record<string, unknown>;
  storeId: string;
  timestamp: number;
  retryCount: number;
  lastError?: string;
  /** absent on ops queued before conflict detection: replayed without checks */
  base?: OperationBase;
  conflict?: OperationConflict;
}

export interface OfflineState {
  isOnline: boolean;
  pendingOperations: PendingOperation[];
  lastSyncAttempt: number | null;
}
