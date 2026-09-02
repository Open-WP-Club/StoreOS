import type {
  WooCommerceProduct,
  WooCommerceOrder,
  WooCommerceCustomer,
  WooCommerceCoupon,
  CacheEntry,
  ProductsCacheEntry,
  OrdersCacheEntry,
  CacheState,
} from '../../types';

export type CacheType = 'products' | 'orders' | 'customers' | 'coupons';

export interface CacheStoreState {
  cache: CacheState;
}

export interface ProductsSlice {
  getCachedProducts: (currentStoreId: string) => Promise<WooCommerceProduct[] | null>;
  setCachedProducts: (data: WooCommerceProduct[], currentStoreId: string, now: number) => Promise<void>;
  setProductsLastSync: (timestamp: string) => Promise<void>;
  getProductsLastSync: () => string | null;
}

export interface OrdersSlice {
  getCachedOrders: (currentStoreId: string) => Promise<WooCommerceOrder[] | null>;
  setCachedOrders: (data: WooCommerceOrder[], currentStoreId: string, now: number) => Promise<void>;
}

export interface CustomersSlice {
  getCachedCustomers: (currentStoreId: string) => Promise<WooCommerceCustomer[] | null>;
  setCachedCustomers: (data: WooCommerceCustomer[], currentStoreId: string, now: number) => Promise<void>;
}

export interface CouponsSlice {
  getCachedCoupons: (currentStoreId: string) => Promise<WooCommerceCoupon[] | null>;
  setCachedCoupons: (data: WooCommerceCoupon[], currentStoreId: string, now: number) => Promise<void>;
}

export interface CacheStoreActions extends ProductsSlice, OrdersSlice, CustomersSlice, CouponsSlice {
  getCachedData: (
    type: CacheType
  ) => Promise<WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[] | WooCommerceCoupon[] | null>;
  setCachedData: (
    type: CacheType,
    data: WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[] | WooCommerceCoupon[]
  ) => Promise<void>;
  clearCache: () => Promise<void>;
  clearCacheForType: (type: CacheType) => Promise<void>;
  isCacheValid: (type: CacheType) => boolean;
  getCacheAge: (type: CacheType) => number | null;
}

export type CacheStore = CacheStoreState & CacheStoreActions;

/** Initial cache state for each data type */
export const createEmptyCacheEntry = <T>(): CacheEntry<T> => ({
  data: null,
  timestamp: null,
  storeId: null,
});

export const createEmptyProductsCacheEntry = (): ProductsCacheEntry => ({
  ...createEmptyCacheEntry<WooCommerceProduct[]>(),
  lastSync: null,
});

export const createEmptyOrdersCacheEntry = (): OrdersCacheEntry => ({
  ...createEmptyCacheEntry<WooCommerceOrder[]>(),
});
