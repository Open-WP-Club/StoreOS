import type { WooCommerceMetaData } from './common';

export type CouponDiscountType = 'percent' | 'fixed_cart' | 'fixed_product';

export interface WooCommerceCoupon {
  id: number;
  code: string;
  amount: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  discount_type: CouponDiscountType;
  description: string;
  date_expires: string | null;
  date_expires_gmt: string | null;
  usage_count: number;
  individual_use: boolean;
  product_ids: number[];
  excluded_product_ids: number[];
  usage_limit: number | null;
  usage_limit_per_user: number | null;
  limit_usage_to_x_items: number | null;
  free_shipping: boolean;
  product_categories: number[];
  excluded_product_categories: number[];
  exclude_sale_items: boolean;
  minimum_amount: string;
  maximum_amount: string;
  email_restrictions: string[];
  used_by: string[];
  meta_data: WooCommerceMetaData[];
}

export interface CouponUpdateData {
  code?: string;
  discount_type?: CouponDiscountType;
  amount?: string;
  description?: string;
  date_expires?: string | null;
  individual_use?: boolean;
  product_ids?: number[];
  excluded_product_ids?: number[];
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  limit_usage_to_x_items?: number | null;
  free_shipping?: boolean;
  product_categories?: number[];
  excluded_product_categories?: number[];
  exclude_sale_items?: boolean;
  minimum_amount?: string;
  maximum_amount?: string;
  email_restrictions?: string[];
  meta_data?: WooCommerceMetaData[];
}

export interface CouponQueryParams {
  context?: 'view' | 'edit';
  _fields?: string;
  page?: number;
  per_page?: number;
  search?: string;
  after?: string;
  before?: string;
  exclude?: number[];
  include?: number[];
  offset?: number;
  order?: 'asc' | 'desc';
  orderby?: 'date' | 'id' | 'include' | 'title' | 'slug';
  code?: string;
}
