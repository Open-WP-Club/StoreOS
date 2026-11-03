import type { WooCommerceProduct, WooCommerceOrder, WooCommerceCustomer } from '../../types';
import { searchProducts } from './products';
import { searchOrders } from './orders';
import { searchCustomers } from './customers';

/**
 * Universal search result item with type information
 */
export interface UniversalSearchResult {
  id: number;
  type: 'product' | 'order' | 'customer';
  title: string;
  subtitle: string;
  score: number;
  data: WooCommerceProduct | WooCommerceOrder | WooCommerceCustomer;
}

/**
 * Universal search across products, orders, and customers
 * Returns categorized results sorted by relevance
 */
export function universalSearch(
  query: string,
  products: WooCommerceProduct[],
  orders: WooCommerceOrder[],
  customers: WooCommerceCustomer[],
  maxPerType: number = 5
): {
  products: UniversalSearchResult[];
  orders: UniversalSearchResult[];
  customers: UniversalSearchResult[];
} {
  if (!query || query.trim() === '') {
    return { products: [], orders: [], customers: [] };
  }

  // Search products
  const productResults = searchProducts(products, query, { minScore: 0.3 })
    .slice(0, maxPerType)
    .map((p) => ({
      id: p.id,
      type: 'product' as const,
      title: p.name,
      subtitle: p.sku ? `SKU: ${p.sku}` : `$${p.price}`,
      score: p._searchScore,
      data: p,
    }));

  // Search orders
  const orderResults = searchOrders(orders, query, { minScore: 0.2 })
    .slice(0, maxPerType)
    .map((o) => ({
      id: o.id,
      type: 'order' as const,
      title: `#${o.number || o.id}`,
      subtitle:
        `${o.billing?.first_name || ''} ${o.billing?.last_name || ''} - ${o.billing?.email || ''}`.trim(),
      score: o._searchScore,
      data: o,
    }));

  // Search customers
  const customerResults = searchCustomers(customers, query, { minScore: 0.2 })
    .slice(0, maxPerType)
    .map((c) => ({
      id: c.id,
      type: 'customer' as const,
      title: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || c.email,
      subtitle: c.email,
      score: c._searchScore,
      data: c,
    }));

  return {
    products: productResults,
    orders: orderResults,
    customers: customerResults,
  };
}
