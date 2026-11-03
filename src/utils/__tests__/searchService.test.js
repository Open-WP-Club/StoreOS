import {
  searchProducts,
  searchOrders,
  applyProductFilters,
  applyOrderFilters,
} from '../searchService';

describe('searchService', () => {
  describe('searchProducts', () => {
    const products = [
      { id: 1, name: 'Blue T-Shirt', sku: 'TS-001', price: '19.99' },
      { id: 2, name: 'Red Hoodie', sku: 'HD-002', price: '49.99' },
      { id: 3, name: 'Blue Jeans', sku: 'JN-003', price: '59.99' },
    ];

    it('should return all products when query is empty', () => {
      expect(searchProducts(products, '')).toEqual(products);
      expect(searchProducts(products, '   ')).toEqual(products);
    });

    it('should find products by exact name match', () => {
      const results = searchProducts(products, 'Blue T-Shirt');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(1);
      expect(results[0]._searchScore).toBe(1.0);
    });

    it('should find products by partial name match', () => {
      const results = searchProducts(products, 'Blue');
      expect(results.length).toBe(2);
      expect(results.every((p) => p.name.includes('Blue'))).toBe(true);
    });

    it('should find products by SKU', () => {
      const results = searchProducts(products, 'TS-001');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sku).toBe('TS-001');
    });

    it('should find products by ID', () => {
      const results = searchProducts(products, '2');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(2);
    });

    it('should return results sorted by score', () => {
      const results = searchProducts(products, 'Blue');
      // Results should be sorted with highest score first
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]._searchScore).toBeGreaterThanOrEqual(results[i + 1]._searchScore);
      }
    });

    it('should filter by minimum score', () => {
      const results = searchProducts(products, 'xyz', { minScore: 0.5 });
      // Should not match anything with low similarity
      expect(results.length).toBe(0);
    });

    it('should support custom search fields', () => {
      const results = searchProducts(products, 'TS-001', {
        searchFields: ['sku'],
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]._matchedField).toBe('sku');
    });
  });

  describe('searchOrders', () => {
    const orders = [
      {
        id: 101,
        total: '99.99',
        billing: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
      },
      {
        id: 102,
        total: '149.99',
        billing: { first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' },
      },
      {
        id: 103,
        total: '199.99',
        billing: { first_name: 'Bob', last_name: 'Johnson', email: 'bob@example.com' },
      },
    ];

    it('should return all orders when query is empty', () => {
      expect(searchOrders(orders, '')).toEqual(orders);
    });

    it('should find orders by exact ID match', () => {
      const results = searchOrders(orders, '101');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(101);
      expect(results[0]._searchScore).toBe(1.0);
    });

    it('should find orders by partial ID match', () => {
      const results = searchOrders(orders, '10');
      // Should match all orders starting with 10 (101, 102, 103)
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find orders by first name', () => {
      const results = searchOrders(orders, 'John');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].billing.first_name).toBe('John');
    });

    it('should find orders by last name', () => {
      const results = searchOrders(orders, 'Smith');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].billing.last_name).toBe('Smith');
    });

    it('should find orders by email', () => {
      const results = searchOrders(orders, 'john@example.com');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].billing.email).toBe('john@example.com');
      expect(results[0]._searchScore).toBe(1.0);
    });

    it('should find orders by partial email', () => {
      const results = searchOrders(orders, 'jane@');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].billing.email).toContain('jane@');
    });

    it('should return results sorted by score', () => {
      const results = searchOrders(orders, 'example');
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]._searchScore).toBeGreaterThanOrEqual(results[i + 1]._searchScore);
      }
    });
  });

  describe('applyProductFilters', () => {
    const products = [
      { id: 1, stock_status: 'instock', price: '19.99', stock_quantity: 100, status: 'publish' },
      { id: 2, stock_status: 'outofstock', price: '49.99', stock_quantity: 0, status: 'draft' },
      { id: 3, stock_status: 'instock', price: '99.99', stock_quantity: 50, status: 'publish' },
    ];

    it('should filter by stock status', () => {
      const filters = { stockStatus: 'instock' };
      const results = applyProductFilters(products, filters);
      expect(results.length).toBe(2);
      expect(results.every((p) => p.stock_status === 'instock')).toBe(true);
    });

    it('should filter by price range', () => {
      const filters = { priceMin: 20, priceMax: 60 };
      const results = applyProductFilters(products, filters);
      expect(results.length).toBe(1);
      expect(parseFloat(results[0].price)).toBe(49.99);
    });

    it('should filter by stock quantity', () => {
      const filters = { stockMin: 50 };
      const results = applyProductFilters(products, filters);
      expect(results.length).toBe(2);
      expect(results.every((p) => p.stock_quantity >= 50)).toBe(true);
    });

    it('should filter by status', () => {
      const filters = { status: 'publish' };
      const results = applyProductFilters(products, filters);
      expect(results.length).toBe(2);
      expect(results.every((p) => p.status === 'publish')).toBe(true);
    });

    it('should apply multiple filters', () => {
      const filters = { stockStatus: 'instock', priceMin: 50 };
      const results = applyProductFilters(products, filters);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(3);
    });
  });

  describe('applyOrderFilters', () => {
    const orders = [
      {
        id: 101,
        status: 'processing',
        total: '99.99',
        date_created: '2025-01-10',
        payment_method: 'stripe',
      },
      {
        id: 102,
        status: 'completed',
        total: '149.99',
        date_created: '2025-01-15',
        payment_method: 'paypal',
      },
      {
        id: 103,
        status: 'processing',
        total: '199.99',
        date_created: '2025-01-20',
        payment_method: 'stripe',
      },
    ];

    it('should filter by status', () => {
      const filters = { status: 'processing' };
      const results = applyOrderFilters(orders, filters);
      expect(results.length).toBe(2);
      expect(results.every((o) => o.status === 'processing')).toBe(true);
    });

    it('should filter by total amount range', () => {
      const filters = { totalMin: '100', totalMax: '150' };
      const results = applyOrderFilters(orders, filters);
      expect(results.length).toBe(1);
      expect(parseFloat(results[0].total)).toBe(149.99);
    });

    it('should filter by date range', () => {
      const filters = { dateFrom: '2025-01-12', dateTo: '2025-01-18' };
      const results = applyOrderFilters(orders, filters);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(102);
    });

    it('should filter by payment method', () => {
      const filters = { paymentMethod: 'stripe' };
      const results = applyOrderFilters(orders, filters);
      expect(results.length).toBe(2);
      expect(results.every((o) => o.payment_method === 'stripe')).toBe(true);
    });

    it('should handle empty string filters for total', () => {
      const filters = { totalMin: '', totalMax: '' };
      const results = applyOrderFilters(orders, filters);
      expect(results.length).toBe(orders.length);
    });
  });
});
