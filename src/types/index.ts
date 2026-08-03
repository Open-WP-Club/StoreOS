/**
 * Comprehensive TypeScript type definitions for StoreOS - Built for WooCommerce
 * Based on WooCommerce REST API v3 documentation
 * @see https://woocommerce.github.io/woocommerce-rest-api-docs/
 *
 * Types are organised by domain in separate files.
 * All types are re-exported from here for backward compatibility.
 */

export * from './common';
export * from './store';
export * from './products';
export * from './orders';
export * from './customers';
export * from './coupons';
export * from './tax';
export * from './reviews';
export * from './activity';
export * from './offline';
export * from './api';
export * from './cache';
export * from './ui';
export * from './analytics';

// ============================================
// System Status Types
// ============================================

export interface SystemStatus {
  environment: {
    home_url: string;
    site_url: string;
    wc_version: string;
    wp_version: string;
    wp_multisite: boolean;
    wp_memory_limit: number;
    wp_debug_mode: boolean;
    wp_cron: boolean;
    language: string;
    server_info: string;
    php_version: string;
    mysql_version: string;
    default_timezone: string;
    fsockopen_or_curl_enabled: boolean;
    curl_version: string;
  };
  database: {
    wc_database_version: string;
    database_prefix: string;
    database_tables: Record<string, boolean>;
  };
  active_plugins: Array<{
    plugin: string;
    name: string;
    version: string;
    author: string;
    network_activated: boolean;
  }>;
  theme: {
    name: string;
    version: string;
    author_url: string;
    is_child_theme: boolean;
    has_woocommerce_support: boolean;
  };
  settings: {
    api_enabled: boolean;
    force_ssl: boolean;
    currency: string;
    currency_symbol: string;
    currency_position: string;
    thousand_separator: string;
    decimal_separator: string;
    number_of_decimals: number;
  };
}

// ============================================
// Type Aliases (for convenience)
// ============================================

export type { WooCommerceOrder as Order } from './orders';
export type { WooCommerceProduct as Product } from './products';
export type { WooCommerceCustomer as Customer } from './customers';
export type { WooCommerceCoupon as Coupon } from './coupons';
export type { WooCommerceStore as Store } from './store';
