import {
  searchProducts,
  searchOrders,
  searchCustomers,
  universalSearch,
  generateAutocompleteSuggestions,
  applyProductFilters,
  applyOrderFilters,
  highlightMatch,
} from '../searchService';

describe('searchService - edge cases', () => {
  // ============================================
  // searchCustomers (completely untested)
  // ============================================

  describe('searchCustomers', () => {
    const customers = [
      { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com', username: 'johnd' },
      { id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', username: 'janes' },
      { id: 3, first_name: 'Bob', last_name: 'Johnson', email: 'bob@test.org', username: 'bobj' },
    ];

    it('should return all customers when query is empty', () => {
      expect(searchCustomers(customers, '')).toEqual(customers);
      expect(searchCustomers(customers, '   ')).toEqual(customers);
    });

    it('should find customer by exact ID', () => {
      const results = searchCustomers(customers, '1');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(1);
      expect(results[0]._searchScore).toBe(1.0);
    });

    it('should find customer by partial ID', () => {
      const results = searchCustomers(customers, '2');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((c) => c.id === 2)).toBe(true);
    });

    it('should find customer by exact email', () => {
      const results = searchCustomers(customers, 'john@example.com');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].email).toBe('john@example.com');
      expect(results[0]._searchScore).toBe(1.0);
    });

    it('should find customer by partial email', () => {
      const results = searchCustomers(customers, 'jane@');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].email).toContain('jane@');
    });

    it('should find customer by first name', () => {
      const results = searchCustomers(customers, 'John');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].first_name).toBe('John');
    });

    it('should find customer by last name', () => {
      const results = searchCustomers(customers, 'Smith');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].last_name).toBe('Smith');
    });

    it('should find customer by full name', () => {
      const results = searchCustomers(customers, 'John Doe');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]._matchedField).toBe('full_name');
    });

    it('should find customer by username', () => {
      const results = searchCustomers(customers, 'johnd');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].username).toBe('johnd');
    });

    it('should return results sorted by score', () => {
      const results = searchCustomers(customers, 'example');
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]._searchScore).toBeGreaterThanOrEqual(results[i + 1]._searchScore);
      }
    });

    it('should handle customers with missing fields', () => {
      const incomplete = [
        { id: 10, first_name: '', last_name: '', email: '', username: '' },
      ];
      const results = searchCustomers(incomplete, 'test');
      // ID '10' won't match 'test', but fuzzy matching may find something
      expect(Array.isArray(results)).toBe(true);
    });

    it('should support custom search fields', () => {
      const results = searchCustomers(customers, 'johnd', {
        searchFields: ['username'],
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]._matchedField).toBe('username');
    });

    it('should handle email where query contains the value', () => {
      const results = searchCustomers(customers, 'fulladdress-john@example.com');
      // Query contains the email, so should match with 0.85 score
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // universalSearch (completely untested)
  // ============================================

  describe('universalSearch', () => {
    const products = [
      { id: 1, name: 'Blue Widget', sku: 'BW-001', price: '10.00' },
    ];

    const orders = [
      { id: 101, number: 101, total: '50.00', billing: { first_name: 'John', last_name: 'Doe', email: 'john@test.com' } },
    ];

    const customers = [
      { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@test.com', username: 'johnd' },
    ];

    it('should return empty results for empty query', () => {
      const results = universalSearch('', products, orders, customers);
      expect(results.products).toEqual([]);
      expect(results.orders).toEqual([]);
      expect(results.customers).toEqual([]);
    });

    it('should return empty results for whitespace query', () => {
      const results = universalSearch('   ', products, orders, customers);
      expect(results.products).toEqual([]);
      expect(results.orders).toEqual([]);
      expect(results.customers).toEqual([]);
    });

    it('should search across all types', () => {
      const results = universalSearch('John', products, orders, customers);
      // Should find in orders (billing name) and customers (first_name)
      expect(results.orders.length).toBeGreaterThan(0);
      expect(results.customers.length).toBeGreaterThan(0);
    });

    it('should search products by name', () => {
      const results = universalSearch('Blue Widget', products, orders, customers);
      expect(results.products.length).toBeGreaterThan(0);
      expect(results.products[0].type).toBe('product');
      expect(results.products[0].title).toBe('Blue Widget');
    });

    it('should respect maxPerType limit', () => {
      const manyProducts = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `Widget ${i + 1}`,
        sku: `W-${i + 1}`,
        price: '10.00',
      }));

      const results = universalSearch('Widget', manyProducts, [], [], 3);
      expect(results.products.length).toBeLessThanOrEqual(3);
    });

    it('should format product subtitle with SKU when available', () => {
      const results = universalSearch('Blue Widget', products, [], []);
      expect(results.products[0].subtitle).toBe('SKU: BW-001');
    });

    it('should format product subtitle with price when no SKU', () => {
      const noSkuProducts = [{ id: 1, name: 'Widget', sku: '', price: '10.00' }];
      const results = universalSearch('Widget', noSkuProducts, [], []);
      expect(results.products[0].subtitle).toBe('$10.00');
    });

    it('should format order results with number', () => {
      const results = universalSearch('101', [], orders, []);
      expect(results.orders.length).toBeGreaterThan(0);
      expect(results.orders[0].title).toBe('#101');
    });

    it('should format customer title with full name', () => {
      const results = universalSearch('John', [], [], customers);
      expect(results.customers.length).toBeGreaterThan(0);
      expect(results.customers[0].title).toBe('John Doe');
    });

    it('should handle customer with no name, fallback to username', () => {
      const noNameCustomers = [
        { id: 1, first_name: '', last_name: '', email: 'test@test.com', username: 'testuser' },
      ];
      const results = universalSearch('test', [], [], noNameCustomers);
      if (results.customers.length > 0) {
        expect(results.customers[0].title).toBe('testuser');
      }
    });
  });

  // ============================================
  // generateAutocompleteSuggestions - customers type
  // ============================================

  describe('generateAutocompleteSuggestions - customers', () => {
    const customers = [
      { first_name: 'John', last_name: 'Doe', email: 'john@example.com', username: 'johnd' },
      { first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', username: 'janes' },
    ];

    it('should generate customer name suggestions', () => {
      const suggestions = generateAutocompleteSuggestions('John', customers, 'customers');
      expect(suggestions).toContain('John Doe');
    });

    it('should generate customer email suggestions', () => {
      const suggestions = generateAutocompleteSuggestions('john@', customers, 'customers');
      expect(suggestions).toContain('john@example.com');
    });

    it('should generate customer username suggestions', () => {
      const suggestions = generateAutocompleteSuggestions('johnd', customers, 'customers');
      expect(suggestions).toContain('johnd');
    });

    it('should respect maxSuggestions limit', () => {
      const suggestions = generateAutocompleteSuggestions('j', customers, 'customers', 1);
      expect(suggestions.length).toBeLessThanOrEqual(1);
    });
  });

  // ============================================
  // searchProducts - additional edge cases
  // ============================================

  describe('searchProducts - edge cases', () => {
    it('should search in description field when specified (strip HTML)', () => {
      const products = [
        { id: 1, name: 'Widget', sku: '', description: '<p>Amazing <strong>blue</strong> widget</p>' },
      ];
      const results = searchProducts(products, 'blue', { searchFields: ['description'] });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle products with null name and sku', () => {
      const products = [
        { id: 1, name: null, sku: null, price: '10.00' },
      ];
      const results = searchProducts(products, 'test');
      // Should not crash, may return 0 results
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty for very short query with high fuzzy threshold', () => {
      const products = [
        { id: 1, name: 'A very long product name', sku: 'XY', price: '10.00' },
      ];
      // Single char query shouldn't trigger fuzzy matching
      const results = searchProducts(products, 'Z', { minScore: 0.5 });
      expect(results.length).toBe(0);
    });

    it('should handle product with long text (>100 chars) - no fuzzy matching', () => {
      const longName = 'A'.repeat(150);
      const products = [{ id: 1, name: longName, sku: '', price: '10.00' }];
      // Fuzzy matching is skipped for text > 100 chars
      const results = searchProducts(products, 'BBBB', { minScore: 0.1 });
      expect(results.length).toBe(0);
    });

    it('should handle custom field access', () => {
      const products = [
        { id: 1, name: 'Widget', sku: '', price: '10.00', custom_field: 'special_value' },
      ];
      const results = searchProducts(products, 'special_value', {
        searchFields: ['custom_field'],
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // searchOrders - additional edge cases
  // ============================================

  describe('searchOrders - edge cases', () => {
    it('should handle order where query contains the ID', () => {
      const orders = [{ id: 5, billing: { first_name: 'A', last_name: 'B', email: '' } }];
      const results = searchOrders(orders, '12345');
      // queryLower.includes(valueLower) path - score should be 0.85
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]._searchScore).toBe(0.85);
    });

    it('should handle orders with missing billing data', () => {
      const orders = [{ id: 100, billing: {} }];
      const results = searchOrders(orders, 'test');
      // Should not crash
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle custom search field on order', () => {
      const orders = [
        { id: 1, billing: { first_name: 'A', last_name: 'B', email: '' }, payment_method: 'stripe' },
      ];
      const results = searchOrders(orders, 'stripe', {
        searchFields: ['payment_method'],
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // applyProductFilters - edge cases
  // ============================================

  describe('applyProductFilters - edge cases', () => {
    it('should handle "all" stockStatus filter', () => {
      const products = [
        { id: 1, stock_status: 'instock', price: '10', stock_quantity: 5, status: 'publish' },
        { id: 2, stock_status: 'outofstock', price: '20', stock_quantity: 0, status: 'draft' },
      ];
      const results = applyProductFilters(products, { stockStatus: 'all' });
      expect(results.length).toBe(2);
    });

    it('should handle NaN price values', () => {
      const products = [
        { id: 1, stock_status: 'instock', price: 'invalid', stock_quantity: 5, status: 'publish' },
      ];
      // Product with NaN price should get price=0 fallback
      const results = applyProductFilters(products, { priceMin: 1 });
      expect(results.length).toBe(0);
    });

    it('should handle null stock_quantity', () => {
      const products = [
        { id: 1, stock_status: 'instock', price: '10', stock_quantity: null, status: 'publish' },
      ];
      // Null stock_quantity should be treated as 0
      const results = applyProductFilters(products, { stockMin: 1 });
      expect(results.length).toBe(0);
    });

    it('should filter by category', () => {
      const products = [
        { id: 1, stock_status: 'instock', price: '10', stock_quantity: 5, status: 'publish', categories: [{ id: 15, name: 'Clothing' }] },
        { id: 2, stock_status: 'instock', price: '20', stock_quantity: 3, status: 'publish', categories: [{ id: 20, name: 'Electronics' }] },
      ];
      const results = applyProductFilters(products, { category: '15' });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(1);
    });

    it('should pass "all" category filter', () => {
      const products = [
        { id: 1, stock_status: 'instock', price: '10', stock_quantity: 5, status: 'publish', categories: [{ id: 15 }] },
      ];
      const results = applyProductFilters(products, { category: 'all' });
      expect(results.length).toBe(1);
    });

    it('should handle string price filter values from forms', () => {
      const products = [
        { id: 1, stock_status: 'instock', price: '25.00', stock_quantity: 5, status: 'publish' },
        { id: 2, stock_status: 'instock', price: '75.00', stock_quantity: 5, status: 'publish' },
      ];
      const results = applyProductFilters(products, { priceMin: '50', priceMax: '100' });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(2);
    });

    it('should handle "all" status filter', () => {
      const products = [
        { id: 1, stock_status: 'instock', price: '10', stock_quantity: 5, status: 'publish' },
        { id: 2, stock_status: 'instock', price: '20', stock_quantity: 5, status: 'draft' },
      ];
      const results = applyProductFilters(products, { status: 'all' });
      expect(results.length).toBe(2);
    });

    it('should handle undefined filter values', () => {
      const products = [
        { id: 1, stock_status: 'instock', price: '10', stock_quantity: 5, status: 'publish' },
      ];
      const results = applyProductFilters(products, { priceMin: undefined, priceMax: undefined });
      expect(results.length).toBe(1);
    });
  });

  // ============================================
  // applyOrderFilters - edge cases
  // ============================================

  describe('applyOrderFilters - edge cases', () => {
    it('should handle "all" status filter', () => {
      const orders = [
        { id: 1, status: 'processing', total: '50', date_created: '2025-01-10', payment_method: 'stripe' },
        { id: 2, status: 'completed', total: '100', date_created: '2025-01-15', payment_method: 'paypal' },
      ];
      const results = applyOrderFilters(orders, { status: 'all' });
      expect(results.length).toBe(2);
    });

    it('should handle "all" payment method filter', () => {
      const orders = [
        { id: 1, status: 'processing', total: '50', date_created: '2025-01-10', payment_method: 'stripe' },
      ];
      const results = applyOrderFilters(orders, { paymentMethod: 'all' });
      expect(results.length).toBe(1);
    });

    it('should handle only dateFrom filter', () => {
      const orders = [
        { id: 1, status: 'processing', total: '50', date_created: '2025-01-10', payment_method: 'stripe' },
        { id: 2, status: 'processing', total: '100', date_created: '2025-02-15', payment_method: 'stripe' },
      ];
      const results = applyOrderFilters(orders, { dateFrom: '2025-02-01' });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(2);
    });

    it('should handle only dateTo filter', () => {
      const orders = [
        { id: 1, status: 'processing', total: '50', date_created: '2025-01-10', payment_method: 'stripe' },
        { id: 2, status: 'processing', total: '100', date_created: '2025-02-15', payment_method: 'stripe' },
      ];
      const results = applyOrderFilters(orders, { dateTo: '2025-01-31' });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(1);
    });

    it('should handle only totalMin filter', () => {
      const orders = [
        { id: 1, status: 'processing', total: '25', date_created: '2025-01-10', payment_method: 'stripe' },
        { id: 2, status: 'processing', total: '100', date_created: '2025-01-10', payment_method: 'stripe' },
      ];
      const results = applyOrderFilters(orders, { totalMin: '50' });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(2);
    });

    it('should handle NaN total in orders', () => {
      const orders = [
        { id: 1, status: 'processing', total: 'invalid', date_created: '2025-01-10', payment_method: 'stripe' },
      ];
      // Invalid total should become 0
      const results = applyOrderFilters(orders, { totalMin: '1' });
      expect(results.length).toBe(0);
    });
  });

  // ============================================
  // highlightMatch - edge cases
  // ============================================

  describe('highlightMatch - edge cases', () => {
    it('should highlight multiple occurrences', () => {
      const result = highlightMatch('Blue Blue Blue', 'Blue');
      const markCount = (result.match(/<mark/g) || []).length;
      expect(markCount).toBe(3);
    });

    it('should handle undefined text', () => {
      expect(highlightMatch(undefined, 'test')).toBeUndefined();
    });

    it('should return text unchanged when no match found', () => {
      const result = highlightMatch('Hello World', 'xyz');
      expect(result).toBe('Hello World');
    });
  });
});
