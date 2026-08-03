import type { WooCommerceOrder, OrderFilters } from '../../types';
import { getSimilarityScore, type SearchOptions, type OrderSearchResult } from './fuzzy';

/**
 * Search orders with fuzzy matching
 */
export function searchOrders(
  orders: WooCommerceOrder[],
  query: string,
  options: SearchOptions = {}
): OrderSearchResult[] {
  const {
    fuzzyThreshold = 0.5,
    searchFields = ['id', 'billing.first_name', 'billing.last_name', 'billing.email'],
    minScore = 0.2,
  } = options;

  if (!query || query.trim() === '') {
    return orders as OrderSearchResult[];
  }

  const results: OrderSearchResult[] = [];
  const queryLower = query.toLowerCase().trim();

  for (const order of orders) {
    let bestScore = 0;
    let matchedField: string | null = null;

    // Search across specified fields
    for (const field of searchFields) {
      let value: string;
      let fieldScore = 0;

      if (field === 'id') {
        value = order.id.toString();
        const valueLower = value.toLowerCase();

        // Special handling for order IDs
        if (valueLower === queryLower) {
          fieldScore = 1.0;
        } else if (valueLower.includes(queryLower)) {
          fieldScore = Math.min(0.95, 0.7 + (queryLower.length / value.length) * 0.25);
        } else if (queryLower.includes(valueLower)) {
          fieldScore = 0.85;
        } else {
          fieldScore = getSimilarityScore(query, value, fuzzyThreshold);
        }
      } else if (field.startsWith('billing.')) {
        const billingField = field.split('.')[1] as keyof typeof order.billing;
        value = order.billing?.[billingField] || '';

        if (value) {
          if (billingField === 'email') {
            const valueLower = value.toLowerCase();

            if (valueLower === queryLower) {
              fieldScore = 1.0;
            } else if (valueLower.includes(queryLower)) {
              fieldScore = 0.9;
            } else if (queryLower.includes(valueLower)) {
              fieldScore = 0.85;
            } else {
              fieldScore = getSimilarityScore(query, value, fuzzyThreshold);
            }
          } else {
            fieldScore = getSimilarityScore(query, value, fuzzyThreshold);
          }
        }
      } else {
        value = String((order as unknown as Record<string, unknown>)[field] ?? '');
        if (value) {
          fieldScore = getSimilarityScore(query, value, fuzzyThreshold);
        }
      }

      if (fieldScore > bestScore) {
        bestScore = fieldScore;
        matchedField = field;
      }
    }

    if (bestScore >= minScore) {
      results.push({
        ...order,
        _searchScore: bestScore,
        _matchedField: matchedField,
      } as OrderSearchResult);
    }
  }

  return results.sort((a, b) => b._searchScore - a._searchScore);
}

/**
 * Apply advanced filters to orders
 */
export function applyOrderFilters(
  orders: WooCommerceOrder[],
  filters: Partial<OrderFilters>
): WooCommerceOrder[] {
  return orders.filter((order) => {
    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (order.status !== filters.status) return false;
    }

    // Total amount range filter
    const hasTotalMin = filters.totalMin !== undefined && filters.totalMin !== '';
    const hasTotalMax = filters.totalMax !== undefined && filters.totalMax !== '';
    if (hasTotalMin || hasTotalMax) {
      const total = parseFloat(order.total) || 0;
      if (hasTotalMin && total < parseFloat(filters.totalMin || '0')) return false;
      if (hasTotalMax && total > parseFloat(filters.totalMax || '0')) return false;
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const orderDate = new Date(order.date_created);
      if (filters.dateFrom && orderDate < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && orderDate > new Date(filters.dateTo)) return false;
    }

    // Payment method filter
    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      if (order.payment_method !== filters.paymentMethod) return false;
    }

    return true;
  });
}
