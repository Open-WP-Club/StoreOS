import type { WooCommerceMetaData } from './common';
import type { ProductImage } from './products';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'trash'
  | 'checkout-draft';

export interface BillingAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
}

export interface ShippingAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
}

export interface OrderItemTax {
  id: number;
  total: string;
  subtotal: string;
}

export interface OrderLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  taxes: OrderItemTax[];
  meta_data: WooCommerceMetaData[];
  sku: string;
  price: number;
  image?: ProductImage;
  parent_name?: string;
}

export interface OrderTaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  rate_percent: number;
  meta_data: WooCommerceMetaData[];
}

export interface OrderShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  instance_id: string;
  total: string;
  total_tax: string;
  taxes: OrderItemTax[];
  meta_data: WooCommerceMetaData[];
}

export interface OrderFeeLine {
  id: number;
  name: string;
  tax_class: string;
  tax_status: 'taxable' | 'none';
  amount: string;
  total: string;
  total_tax: string;
  taxes: OrderItemTax[];
  meta_data: WooCommerceMetaData[];
}

export interface OrderCouponLine {
  id: number;
  code: string;
  discount: string;
  discount_tax: string;
  meta_data: WooCommerceMetaData[];
}

export interface OrderRefund {
  id: number;
  reason: string;
  total: string;
}

export interface OrderNote {
  id: number;
  author: string;
  date_created: string;
  date_created_gmt: string;
  note: string;
  customer_note: boolean;
}

export interface WooCommerceOrder {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: OrderStatus;
  currency: string;
  currency_symbol?: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  customer_id: number;
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;
  billing: BillingAddress;
  shipping: ShippingAddress;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_paid: string | null;
  date_paid_gmt: string | null;
  date_completed: string | null;
  date_completed_gmt: string | null;
  cart_hash: string;
  meta_data: WooCommerceMetaData[];
  line_items: OrderLineItem[];
  tax_lines: OrderTaxLine[];
  shipping_lines: OrderShippingLine[];
  fee_lines: OrderFeeLine[];
  coupon_lines: OrderCouponLine[];
  refunds: OrderRefund[];
}

export interface OrderUpdateData {
  status?: OrderStatus;
  customer_note?: string;
  billing?: Partial<BillingAddress>;
  shipping?: Partial<ShippingAddress>;
  meta_data?: WooCommerceMetaData[];
  line_items?: Partial<OrderLineItem>[];
  shipping_lines?: Partial<OrderShippingLine>[];
  fee_lines?: Partial<OrderFeeLine>[];
  coupon_lines?: Array<{ code: string }>;
}

export interface OrderQueryParams {
  context?: 'view' | 'edit';
  _fields?: string;
  modified_after?: string;
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
  parent?: number[];
  parent_exclude?: number[];
  status?: OrderStatus | OrderStatus[];
  customer?: number;
  product?: number;
  dp?: number;
}

export interface OrderFilters {
  status: string;
  dateFrom: string;
  dateTo: string;
  totalMin: string;
  totalMax: string;
  paymentMethod: string;
}
