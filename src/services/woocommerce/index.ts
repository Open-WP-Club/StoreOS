import type { WooCommerceStore } from '../../types';
import { WooCommerceServiceAdmin } from './admin';

/**
 * WooCommerce Service
 *
 * Type-safe interface for WooCommerce REST API v3 operations.
 * Methods are organized by resource in separate modules:
 *   base.ts          — constructor, API init, shared helpers
 *   orders.ts        — orders + order notes
 *   products.ts      — products, batch ops, inventory, variations, categories, attributes
 *   customers.ts     — customers
 *   coupons.ts       — coupons
 *   tax-reviews.ts   — tax rates/classes + product reviews
 *   admin.ts         — reports, payment gateways, shipping zones, webhooks, settings
 *
 * Import path is unchanged: `import WooCommerceService from '../services/woocommerce'`
 */
class WooCommerceService extends WooCommerceServiceAdmin {
  constructor(storeConfig: WooCommerceStore) {
    super(storeConfig);
  }
}

export default WooCommerceService;
