export type ActivityAction =
  | 'order_status_changed'
  | 'order_updated'
  | 'order_note_added'
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'product_bulk_updated'
  | 'stock_updated'
  | 'coupon_created'
  | 'coupon_updated'
  | 'coupon_deleted'
  | 'store_added'
  | 'store_removed'
  | 'cache_cleared'
  | 'settings_changed';

export type ActivityEntityType = 'order' | 'product' | 'coupon' | 'store' | 'system';

export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: number | string;
  entityName?: string;
  storeId: string | null;
  storeName?: string;
  details?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  timestamp: string;
}
