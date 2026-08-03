import type { WooCommerceProduct, WooCommerceOrder, WooCommerceCustomer } from '../../types';
import { searchProducts } from './products';
import { searchOrders } from './orders';
import { searchCustomers } from './customers';

/**
 * Generate autocomplete suggestions from search query
 */
export function generateAutocompleteSuggestions(
  query: string,
  data: WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[],
  type: 'products' | 'orders' | 'customers' = 'products',
  maxSuggestions: number = 5
): string[] {
  if (!query || query.trim() === '') return [];

  const queryLower = query.toLowerCase();
  const suggestions = new Set<string>();

  if (type === 'products') {
    for (const item of data as WooCommerceProduct[]) {
      if (item.name?.toLowerCase().includes(queryLower)) {
        suggestions.add(item.name);
      }
      if (item.sku?.toLowerCase().includes(queryLower)) {
        suggestions.add(item.sku);
      }

      if (suggestions.size >= maxSuggestions) break;
    }
  } else if (type === 'orders') {
    for (const item of data as WooCommerceOrder[]) {
      const fullName = `${item.billing?.first_name || ''} ${item.billing?.last_name || ''}`.trim();
      if (fullName && fullName.toLowerCase().includes(queryLower)) {
        suggestions.add(fullName);
      }
      if (item.billing?.email?.toLowerCase().includes(queryLower)) {
        suggestions.add(item.billing.email);
      }

      if (suggestions.size >= maxSuggestions) break;
    }
  } else if (type === 'customers') {
    for (const item of data as WooCommerceCustomer[]) {
      const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim();
      if (fullName && fullName.toLowerCase().includes(queryLower)) {
        suggestions.add(fullName);
      }
      if (item.email?.toLowerCase().includes(queryLower)) {
        suggestions.add(item.email);
      }
      if (item.username?.toLowerCase().includes(queryLower)) {
        suggestions.add(item.username);
      }

      if (suggestions.size >= maxSuggestions) break;
    }
  }

  return Array.from(suggestions).slice(0, maxSuggestions);
}

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
): { products: UniversalSearchResult[]; orders: UniversalSearchResult[]; customers: UniversalSearchResult[] } {
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
      subtitle: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''} - ${o.billing?.email || ''}`.trim(),
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

/**
 * Highlight matching text in search results
 */
export function highlightMatch(text: string, query: string): string {
  if (!query || !text) return text;

  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-700">$1</mark>');
}
