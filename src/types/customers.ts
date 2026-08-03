import type { WooCommerceMetaData } from './common';
import type { BillingAddress, ShippingAddress } from './orders';

export interface WooCommerceCustomer {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
  billing: BillingAddress;
  shipping: ShippingAddress;
  is_paying_customer: boolean;
  avatar_url: string;
  meta_data: WooCommerceMetaData[];
  orders_count?: number;
  total_spent?: string;
}

export interface CustomerQueryParams {
  context?: 'view' | 'edit';
  page?: number;
  per_page?: number;
  search?: string;
  exclude?: number[];
  include?: number[];
  offset?: number;
  order?: 'asc' | 'desc';
  orderby?: 'id' | 'include' | 'name' | 'registered_date';
  email?: string;
  role?: string;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  topCustomers: Array<{
    id: number;
    name: string;
    email: string;
    totalSpent: number;
    orderCount: number;
  }>;
}
