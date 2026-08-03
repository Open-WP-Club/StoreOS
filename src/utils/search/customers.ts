import type { WooCommerceCustomer } from '../../types';
import { getSimilarityScore, type SearchOptions, type CustomerSearchResult } from './fuzzy';

/**
 * Search customers with fuzzy matching
 */
export function searchCustomers(
  customers: WooCommerceCustomer[],
  query: string,
  options: SearchOptions = {}
): CustomerSearchResult[] {
  const {
    fuzzyThreshold = 0.5,
    searchFields = ['id', 'email', 'first_name', 'last_name', 'username'],
    minScore = 0.2,
  } = options;

  if (!query || query.trim() === '') {
    return customers as CustomerSearchResult[];
  }

  const results: CustomerSearchResult[] = [];
  const queryLower = query.toLowerCase().trim();

  for (const customer of customers) {
    let bestScore = 0;
    let matchedField: string | null = null;

    for (const field of searchFields) {
      let value: string;
      let fieldScore = 0;

      if (field === 'id') {
        value = customer.id.toString();
        const valueLower = value.toLowerCase();

        if (valueLower === queryLower) {
          fieldScore = 1.0;
        } else if (valueLower.includes(queryLower)) {
          fieldScore = 0.9;
        } else {
          fieldScore = getSimilarityScore(query, value, fuzzyThreshold);
        }
      } else if (field === 'email') {
        value = customer.email || '';
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
      } else if (field === 'first_name' || field === 'last_name' || field === 'username') {
        value = (customer[field] as string) || '';
        if (value) {
          fieldScore = getSimilarityScore(query, value, fuzzyThreshold);
        }
      } else {
        value = String((customer as unknown as Record<string, unknown>)[field] ?? '');
        if (value) {
          fieldScore = getSimilarityScore(query, value, fuzzyThreshold);
        }
      }

      if (fieldScore > bestScore) {
        bestScore = fieldScore;
        matchedField = field;
      }
    }

    // Also search full name
    const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    if (fullName) {
      const fullNameScore = getSimilarityScore(query, fullName, fuzzyThreshold);
      if (fullNameScore > bestScore) {
        bestScore = fullNameScore;
        matchedField = 'full_name';
      }
    }

    if (bestScore >= minScore) {
      results.push({
        ...customer,
        _searchScore: bestScore,
        _matchedField: matchedField,
      } as CustomerSearchResult);
    }
  }

  return results.sort((a, b) => b._searchScore - a._searchScore);
}
