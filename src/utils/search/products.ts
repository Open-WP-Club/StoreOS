import type { WooCommerceProduct, ProductFilters } from '../../types';
import { getSimilarityScore, type SearchOptions, type ProductSearchResult } from './fuzzy';

/**
 * Search products with fuzzy matching
 */
export function searchProducts(
  products: WooCommerceProduct[],
  query: string,
  options: SearchOptions = {}
): ProductSearchResult[] {
  const {
    fuzzyThreshold = 0.6,
    searchFields = ['name', 'sku', 'id'],
    minScore = 0.3,
  } = options;

  if (!query || query.trim() === '') {
    return products as ProductSearchResult[];
  }

  const results: ProductSearchResult[] = [];

  for (const product of products) {
    let bestScore = 0;
    let matchedField: string | null = null;

    // Search across specified fields
    for (const field of searchFields) {
      let value: string;

      if (field === 'id') {
        value = product.id.toString();
      } else if (field === 'name') {
        value = product.name || '';
      } else if (field === 'sku') {
        value = product.sku || '';
      } else if (field === 'description') {
        // Strip HTML tags from description
        value = (product.description || '').replace(/<[^>]*>/g, '');
      } else {
        value = String((product as unknown as Record<string, unknown>)[field] ?? '');
      }

      const score = getSimilarityScore(query, value, fuzzyThreshold);

      if (score > bestScore) {
        bestScore = score;
        matchedField = field;
      }
    }

    // Only include results above minimum score
    if (bestScore >= minScore) {
      results.push({
        ...product,
        _searchScore: bestScore,
        _matchedField: matchedField,
      } as ProductSearchResult);
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b._searchScore - a._searchScore);
}

/**
 * Apply advanced filters to products
 * Handles both string and number filter values (from form inputs)
 */
export function applyProductFilters(
  products: WooCommerceProduct[],
  filters: Partial<ProductFilters> & { category?: string; priceMin?: string | number; priceMax?: string | number; stockMin?: string | number; stockMax?: string | number }
): WooCommerceProduct[] {
  return products.filter((product) => {
    // Stock status filter
    if (filters.stockStatus && filters.stockStatus !== 'all') {
      if (product.stock_status !== filters.stockStatus) return false;
    }

    // Price range filter - handle both string and number values
    const priceMinVal = filters.priceMin !== undefined && filters.priceMin !== '' ? parseFloat(String(filters.priceMin)) : null;
    const priceMaxVal = filters.priceMax !== undefined && filters.priceMax !== '' ? parseFloat(String(filters.priceMax)) : null;

    if (priceMinVal !== null || priceMaxVal !== null) {
      const price = parseFloat(product.price) || 0;
      if (priceMinVal !== null && !isNaN(priceMinVal) && price < priceMinVal) return false;
      if (priceMaxVal !== null && !isNaN(priceMaxVal) && price > priceMaxVal) return false;
    }

    // Stock quantity filter - handle both string and number values
    const stockMinVal = filters.stockMin !== undefined && filters.stockMin !== '' ? parseFloat(String(filters.stockMin)) : null;
    const stockMaxVal = filters.stockMax !== undefined && filters.stockMax !== '' ? parseFloat(String(filters.stockMax)) : null;

    if (stockMinVal !== null || stockMaxVal !== null) {
      const stock = product.stock_quantity !== null ? product.stock_quantity : 0;
      if (stockMinVal !== null && !isNaN(stockMinVal) && stock < stockMinVal) return false;
      if (stockMaxVal !== null && !isNaN(stockMaxVal) && stock > stockMaxVal) return false;
    }

    // Product status filter
    if (filters.status && filters.status !== 'all') {
      if (product.status !== filters.status) return false;
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      const hasCategory = product.categories?.some((cat) => cat.id.toString() === filters.category);
      if (!hasCategory) return false;
    }

    return true;
  });
}
