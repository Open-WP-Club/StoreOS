import type { WooCommerceProduct } from './products';
import type { WooCommerceOrder } from './orders';
import type { WooCommerceCustomer } from './customers';
import type { WooCommerceCoupon } from './coupons';

export interface CacheEntry<T> {
  data: T | null;
  timestamp: number | null;
  storeId: string | null;
}

export interface ProductsCacheEntry extends CacheEntry<WooCommerceProduct[]> {
  lastSync: string | null;
}

export interface OrdersCacheEntry extends CacheEntry<WooCommerceOrder[]> {
  partial?: boolean;
}

export interface CacheState {
  products: ProductsCacheEntry;
  productsRecent: CacheEntry<WooCommerceProduct[]>;
  productsOld: CacheEntry<WooCommerceProduct[]>;
  orders: OrdersCacheEntry;
  ordersRecent: CacheEntry<WooCommerceOrder[]>;
  ordersOld: CacheEntry<WooCommerceOrder[]>;
  customers: CacheEntry<WooCommerceCustomer[]>;
  coupons: CacheEntry<WooCommerceCoupon[]>;
}
