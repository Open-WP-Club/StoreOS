/**
 * Mock data factories for testing.
 * Creates realistic WooCommerce objects with sensible defaults.
 * All fields can be overridden via partial argument.
 */

import type {
  WooCommerceOrder,
  WooCommerceProduct,
  WooCommerceStore,
  WooCommerceCustomer,
  OrderLineItem,
  BillingAddress,
  ShippingAddress,
  OrderNote,
  ProductDimensions,
} from '../types';

let idCounter = 1;
const nextId = (): number => idCounter++;

/** Reset the ID counter between test suites */
export function resetIdCounter(): void {
  idCounter = 1;
}

// ============================================
// Store
// ============================================

export function createMockStore(overrides: Partial<WooCommerceStore> = {}): WooCommerceStore {
  const id = String(nextId());
  return {
    id,
    name: `Test Store ${id}`,
    url: 'https://example.com',
    consumerKey: 'ck_test_key',
    consumerSecret: 'cs_test_secret',
    createdAt: '2025-01-01T00:00:00.000Z',
    loadingSettings: {
      batchSize: 50,
      batchDelay: 500,
    },
    currency: 'USD',
    currencySymbol: '$',
    ...overrides,
  };
}

// ============================================
// Billing & Shipping Addresses
// ============================================

export function createMockBilling(overrides: Partial<BillingAddress> = {}): BillingAddress {
  return {
    first_name: 'John',
    last_name: 'Doe',
    company: '',
    address_1: '123 Main St',
    address_2: '',
    city: 'Sofia',
    state: 'SF',
    postcode: '1000',
    country: 'BG',
    email: 'john@example.com',
    phone: '+359888123456',
    ...overrides,
  };
}

export function createMockShipping(overrides: Partial<ShippingAddress> = {}): ShippingAddress {
  return {
    first_name: 'John',
    last_name: 'Doe',
    company: '',
    address_1: '123 Main St',
    address_2: '',
    city: 'Sofia',
    state: 'SF',
    postcode: '1000',
    country: 'BG',
    phone: '+359888123456',
    ...overrides,
  };
}

// ============================================
// Order Line Item
// ============================================

export function createMockLineItem(overrides: Partial<OrderLineItem> = {}): OrderLineItem {
  const id = nextId();
  return {
    id,
    name: `Product ${id}`,
    product_id: id + 100,
    variation_id: 0,
    quantity: 1,
    tax_class: '',
    subtotal: '25.00',
    subtotal_tax: '0.00',
    total: '25.00',
    total_tax: '0.00',
    taxes: [],
    meta_data: [],
    sku: `SKU-${id}`,
    price: 25,
    ...overrides,
  };
}

// ============================================
// Order
// ============================================

export function createMockOrder(overrides: Partial<WooCommerceOrder> = {}): WooCommerceOrder {
  const id = nextId();
  const lineItems = overrides.line_items || [createMockLineItem()];
  const total = overrides.total || lineItems.reduce((sum, li) => sum + parseFloat(li.total), 0).toFixed(2);

  return {
    id,
    parent_id: 0,
    number: String(id),
    order_key: `wc_order_${id}`,
    created_via: 'checkout',
    version: '9.0.0',
    status: 'processing',
    currency: 'USD',
    date_created: new Date().toISOString(),
    date_created_gmt: new Date().toISOString(),
    date_modified: new Date().toISOString(),
    date_modified_gmt: new Date().toISOString(),
    discount_total: '0.00',
    discount_tax: '0.00',
    shipping_total: '0.00',
    shipping_tax: '0.00',
    cart_tax: '0.00',
    total,
    total_tax: '0.00',
    prices_include_tax: false,
    customer_id: 1,
    customer_ip_address: '127.0.0.1',
    customer_user_agent: 'test',
    customer_note: '',
    billing: createMockBilling(),
    shipping: createMockShipping(),
    payment_method: 'bacs',
    payment_method_title: 'Direct Bank Transfer',
    transaction_id: '',
    date_paid: null,
    date_paid_gmt: null,
    date_completed: null,
    date_completed_gmt: null,
    cart_hash: '',
    meta_data: [],
    line_items: lineItems,
    tax_lines: [],
    shipping_lines: [],
    fee_lines: [],
    coupon_lines: [],
    refunds: [],
    ...overrides,
  };
}

// ============================================
// Order Note
// ============================================

export function createMockOrderNote(overrides: Partial<OrderNote> = {}): OrderNote {
  const id = nextId();
  return {
    id,
    author: 'admin',
    date_created: new Date().toISOString(),
    date_created_gmt: new Date().toISOString(),
    note: `Test note ${id}`,
    customer_note: false,
    ...overrides,
  };
}

// ============================================
// Product
// ============================================

export function createMockProduct(overrides: Partial<WooCommerceProduct> = {}): WooCommerceProduct {
  const id = nextId();
  return {
    id,
    name: `Test Product ${id}`,
    slug: `test-product-${id}`,
    permalink: `https://example.com/product/test-product-${id}`,
    date_created: new Date().toISOString(),
    date_created_gmt: new Date().toISOString(),
    date_modified: new Date().toISOString(),
    date_modified_gmt: new Date().toISOString(),
    type: 'simple',
    status: 'publish',
    featured: false,
    catalog_visibility: 'visible',
    description: '<p>Test description</p>',
    short_description: '<p>Short</p>',
    sku: `SKU-${id}`,
    price: '29.99',
    regular_price: '29.99',
    sale_price: '',
    date_on_sale_from: null,
    date_on_sale_from_gmt: null,
    date_on_sale_to: null,
    date_on_sale_to_gmt: null,
    price_html: '<span>$29.99</span>',
    on_sale: false,
    purchasable: true,
    total_sales: 10,
    virtual: false,
    downloadable: false,
    downloads: [],
    download_limit: -1,
    download_expiry: -1,
    external_url: '',
    button_text: '',
    tax_status: 'taxable',
    tax_class: '',
    manage_stock: true,
    stock_quantity: 50,
    stock_status: 'instock',
    backorders: 'no',
    backorders_allowed: false,
    backordered: false,
    sold_individually: false,
    weight: '0.5',
    dimensions: { length: '10', width: '5', height: '2' } as ProductDimensions,
    shipping_required: true,
    shipping_taxable: true,
    shipping_class: '',
    shipping_class_id: 0,
    reviews_allowed: true,
    average_rating: '4.5',
    rating_count: 5,
    related_ids: [],
    upsell_ids: [],
    cross_sell_ids: [],
    parent_id: 0,
    purchase_note: '',
    categories: [{ id: 1, name: 'General', slug: 'general' }],
    tags: [],
    images: [],
    attributes: [],
    default_attributes: [],
    variations: [],
    grouped_products: [],
    menu_order: 0,
    meta_data: [],
    ...overrides,
  };
}

// ============================================
// Customer
// ============================================

export function createMockCustomer(overrides: Partial<WooCommerceCustomer> = {}): WooCommerceCustomer {
  const id = nextId();
  return {
    id,
    date_created: new Date().toISOString(),
    date_created_gmt: new Date().toISOString(),
    date_modified: new Date().toISOString(),
    date_modified_gmt: new Date().toISOString(),
    email: `customer${id}@example.com`,
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'customer',
    username: `customer${id}`,
    billing: createMockBilling({ email: `customer${id}@example.com` }),
    shipping: createMockShipping(),
    is_paying_customer: true,
    avatar_url: '',
    meta_data: [],
    orders_count: 5,
    total_spent: '250.00',
    ...overrides,
  };
}
