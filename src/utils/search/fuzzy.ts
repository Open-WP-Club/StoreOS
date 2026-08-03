/**
 * Internal fuzzy matching helpers — NOT exported from the barrel.
 * Used only by other search modules.
 */

import type { WooCommerceProduct, WooCommerceOrder, WooCommerceCustomer, ProductFilters, OrderFilters } from '../../types';

// ============================================
// Types (shared across search modules)
// ============================================

export interface SearchOptions {
  fuzzyThreshold?: number;
  searchFields?: string[];
  minScore?: number;
}

export interface SearchResult extends Record<string, unknown> {
  _searchScore: number;
  _matchedField: string | null;
}

export type ProductSearchResult = WooCommerceProduct & SearchResult;
export type OrderSearchResult = WooCommerceOrder & SearchResult;
export type CustomerSearchResult = WooCommerceCustomer & SearchResult;

// Re-export types needed by other modules
export type { WooCommerceProduct, WooCommerceOrder, WooCommerceCustomer, ProductFilters, OrderFilters };

// ============================================
// Internal fuzzy helpers
// ============================================

/**
 * Calculate bounded Levenshtein distance between two strings
 * OPTIMIZED: Uses single-row DP and early termination
 * Returns Infinity if distance exceeds maxDistance (for performance)
 */
export function boundedLevenshteinDistance(str1: string, str2: string, maxDistance: number): number {
  let s1 = str1;
  let s2 = str2;

  // Quick length-based rejection
  if (Math.abs(s1.length - s2.length) > maxDistance) return Infinity;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  // Ensure s1 is the shorter string for optimization
  if (s1.length > s2.length) {
    [s1, s2] = [s2, s1];
  }

  const m = s1.length;
  const n = s2.length;

  // Use single row instead of full matrix - O(n) space instead of O(n*m)
  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    let minInRow = i; // Track minimum in current row for early termination

    for (let j = 1; j <= n; j++) {
      if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
        currRow[j] = prevRow[j - 1];
      } else {
        currRow[j] = 1 + Math.min(
          prevRow[j - 1], // substitution
          currRow[j - 1], // insertion
          prevRow[j]      // deletion
        );
      }
      minInRow = Math.min(minInRow, currRow[j]);
    }

    // Early termination: if minimum in row exceeds maxDistance, we can stop
    if (minInRow > maxDistance) {
      return Infinity;
    }

    // Swap rows
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[n];
}

/**
 * Calculate similarity score (0-1) between query and text
 * OPTIMIZED: Quick checks before expensive fuzzy matching
 * Higher score = better match
 */
export function getSimilarityScore(query: string, text: string, fuzzyThreshold: number = 0.7): number {
  if (!text || text.length === 0) return 0;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest score
  if (textLower === queryLower) return 1.0;

  // Starts with query gets high score
  if (textLower.startsWith(queryLower)) return 0.9;

  // Contains query gets good score
  if (textLower.includes(queryLower)) return 0.8;

  // Skip fuzzy matching for very long strings (performance)
  if (textLower.length > 100) return 0;

  // Calculate maximum allowed distance based on threshold
  const maxLen = Math.max(queryLower.length, textLower.length);
  const maxAllowedDistance = Math.floor(maxLen * (1 - fuzzyThreshold));

  // Skip if query is too short for meaningful fuzzy matching
  if (queryLower.length < 2) return 0;

  // Bounded Levenshtein with early termination
  const distance = boundedLevenshteinDistance(queryLower, textLower, maxAllowedDistance);

  if (distance === Infinity) return 0;

  const similarity = 1 - distance / maxLen;

  // Only return fuzzy matches above threshold
  return similarity >= fuzzyThreshold ? similarity * 0.7 : 0;
}
