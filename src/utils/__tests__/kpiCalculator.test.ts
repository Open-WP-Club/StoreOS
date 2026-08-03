import {
  filterOrdersByPeriod,
  buildKPIValue,
  calculateRevenueKPIs,
  calculateCustomerKPIs,
  calculateOperationsKPIs,
  calculateInventoryKPIs,
  calculateConcentrationKPIs,
  calculateAllKPIs,
} from '../kpiCalculator';
import { createMockOrder, createMockProduct, createMockLineItem } from '../../__test_utils__/mockFactories';
import type { WooCommerceOrder, WooCommerceProduct } from '../../types';

// ============================================
// Helpers
// ============================================

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // Add a small buffer to avoid boundary issues in time-sensitive comparisons
  d.setHours(d.getHours(), d.getMinutes(), d.getSeconds() + 1);
  return d.toISOString();
}

function createOrderInPeriod(daysBack: number, overrides: Partial<WooCommerceOrder> = {}): WooCommerceOrder {
  return createMockOrder({
    date_created: daysAgo(daysBack),
    ...overrides,
  });
}

// ============================================
// filterOrdersByPeriod
// ============================================

describe('filterOrdersByPeriod', () => {
  it('splits orders into current and previous period', () => {
    const orders = [
      createOrderInPeriod(3),   // current (last 7 days)
      createOrderInPeriod(5),   // current
      createOrderInPeriod(10),  // previous (7-14 days ago)
      createOrderInPeriod(12),  // previous
      createOrderInPeriod(20),  // neither (too old)
    ];

    const result = filterOrdersByPeriod(orders, 7);
    expect(result.current).toHaveLength(2);
    expect(result.previous).toHaveLength(2);
  });

  it('returns empty arrays for empty input', () => {
    const result = filterOrdersByPeriod([], 30);
    expect(result.current).toHaveLength(0);
    expect(result.previous).toHaveLength(0);
  });

  it('handles single-day period', () => {
    // days=1 means currentStart = 1 day ago, so both today and yesterday are >= currentStart
    const orders = [
      createOrderInPeriod(0),   // today = current (>= 1 day ago)
      createOrderInPeriod(1),   // yesterday = current (>= 1 day ago)
      createOrderInPeriod(2),   // 2 days ago = previous
      createOrderInPeriod(3),   // too old
    ];

    const result = filterOrdersByPeriod(orders, 1);
    expect(result.current).toHaveLength(2);
    expect(result.previous).toHaveLength(1);
  });

  it('all orders in current period', () => {
    const orders = [
      createOrderInPeriod(1),
      createOrderInPeriod(2),
    ];

    const result = filterOrdersByPeriod(orders, 30);
    expect(result.current).toHaveLength(2);
    expect(result.previous).toHaveLength(0);
  });
});

// ============================================
// buildKPIValue
// ============================================

describe('buildKPIValue', () => {
  it('calculates positive change correctly', () => {
    const result = buildKPIValue(120, 100);
    expect(result.current).toBe(120);
    expect(result.previous).toBe(100);
    expect(result.changePercent).toBe(20);
    expect(result.direction).toBe('up');
  });

  it('calculates negative change correctly', () => {
    const result = buildKPIValue(80, 100);
    expect(result.changePercent).toBe(-20);
    expect(result.direction).toBe('down');
  });

  it('returns flat for negligible change (within 0.5%)', () => {
    const result = buildKPIValue(100.4, 100);
    expect(result.direction).toBe('flat');
  });

  it('handles previous = 0 with current > 0', () => {
    const result = buildKPIValue(50, 0);
    expect(result.changePercent).toBe(100);
    expect(result.direction).toBe('up');
  });

  it('handles both zero', () => {
    const result = buildKPIValue(0, 0);
    expect(result.changePercent).toBe(0);
    expect(result.direction).toBe('flat');
  });

  it('rounds to 1 decimal place', () => {
    const result = buildKPIValue(100, 33);
    // (100-33)/33 * 100 = 203.0303...
    expect(result.changePercent).toBe(203);
  });

  it('handles large numbers', () => {
    const result = buildKPIValue(1000000, 500000);
    expect(result.changePercent).toBe(100);
    expect(result.direction).toBe('up');
  });
});

// ============================================
// calculateRevenueKPIs
// ============================================

describe('calculateRevenueKPIs', () => {
  it('calculates total revenue and AOV', () => {
    const periodOrders = {
      current: [
        createMockOrder({ status: 'processing', total: '100.00' }),
        createMockOrder({ status: 'completed', total: '200.00' }),
      ],
      previous: [
        createMockOrder({ status: 'processing', total: '150.00' }),
      ],
    };

    const result = calculateRevenueKPIs(periodOrders);

    expect(result.totalRevenue.current).toBe(300);
    expect(result.totalRevenue.previous).toBe(150);
    expect(result.averageOrderValue.current).toBe(150); // 300/2
    expect(result.averageOrderValue.previous).toBe(150); // 150/1
    expect(result.revenueGrowthRate).toBe(100); // (300-150)/150 * 100
  });

  it('excludes refunded/failed/cancelled orders from revenue', () => {
    const periodOrders = {
      current: [
        createMockOrder({ status: 'processing', total: '100.00' }),
        createMockOrder({ status: 'refunded', total: '50.00' }),
        createMockOrder({ status: 'failed', total: '30.00' }),
        createMockOrder({ status: 'cancelled', total: '20.00' }),
        createMockOrder({ status: 'trash', total: '10.00' }),
        createMockOrder({ status: 'checkout-draft', total: '5.00' }),
      ],
      previous: [],
    };

    const result = calculateRevenueKPIs(periodOrders);
    expect(result.totalRevenue.current).toBe(100);
    expect(result.revenueGrowthRate).toBe(100); // previous = 0, current > 0
  });

  it('handles empty periods', () => {
    const periodOrders = { current: [], previous: [] };
    const result = calculateRevenueKPIs(periodOrders);

    expect(result.totalRevenue.current).toBe(0);
    expect(result.averageOrderValue.current).toBe(0);
    expect(result.revenueGrowthRate).toBe(0);
  });
});

// ============================================
// calculateCustomerKPIs
// ============================================

describe('calculateCustomerKPIs', () => {
  it('calculates repeat purchase rate', () => {
    const periodOrders = {
      current: [
        createMockOrder({ customer_id: 1, total: '50.00', status: 'processing' }),
        createMockOrder({ customer_id: 1, total: '75.00', status: 'processing' }),
        createMockOrder({ customer_id: 2, total: '30.00', status: 'processing' }),
      ],
      previous: [],
    };

    const result = calculateCustomerKPIs(periodOrders);
    // customer 1 has 2 orders, customer 2 has 1 → 50% repeat rate
    expect(result.repeatPurchaseRate.current).toBe(50);
  });

  it('identifies customers by email when customer_id is 0', () => {
    const periodOrders = {
      current: [
        createMockOrder({
          customer_id: 0,
          billing: { first_name: 'A', last_name: 'B', company: '', address_1: '', address_2: '', city: '', state: '', postcode: '', country: '', email: 'repeat@test.com', phone: '' },
          status: 'processing',
          total: '50.00',
        }),
        createMockOrder({
          customer_id: 0,
          billing: { first_name: 'A', last_name: 'B', company: '', address_1: '', address_2: '', city: '', state: '', postcode: '', country: '', email: 'repeat@test.com', phone: '' },
          status: 'processing',
          total: '30.00',
        }),
      ],
      previous: [],
    };

    const result = calculateCustomerKPIs(periodOrders);
    expect(result.repeatPurchaseRate.current).toBe(100); // 1 customer with 2 orders
  });

  it('calculates average items per order', () => {
    const periodOrders = {
      current: [
        createMockOrder({
          status: 'processing',
          line_items: [
            createMockLineItem({ quantity: 3 }),
            createMockLineItem({ quantity: 2 }),
          ],
        }),
        createMockOrder({
          status: 'processing',
          line_items: [createMockLineItem({ quantity: 1 })],
        }),
      ],
      previous: [],
    };

    const result = calculateCustomerKPIs(periodOrders);
    // (3+2+1) / 2 orders = 3
    expect(result.avgItemsPerOrder.current).toBe(3);
  });

  it('calculates CLV correctly', () => {
    const periodOrders = {
      current: [
        createMockOrder({ customer_id: 1, total: '100.00', status: 'processing' }),
        createMockOrder({ customer_id: 1, total: '50.00', status: 'processing' }),
        createMockOrder({ customer_id: 2, total: '200.00', status: 'processing' }),
      ],
      previous: [],
    };

    const result = calculateCustomerKPIs(periodOrders);
    // Customer 1: 150, Customer 2: 200 → avg = 175
    expect(result.customerLifetimeValue.current).toBe(175);
  });

  it('handles empty orders', () => {
    const periodOrders = { current: [], previous: [] };
    const result = calculateCustomerKPIs(periodOrders);

    expect(result.repeatPurchaseRate.current).toBe(0);
    expect(result.avgItemsPerOrder.current).toBe(0);
    expect(result.customerLifetimeValue.current).toBe(0);
  });
});

// ============================================
// calculateOperationsKPIs
// ============================================

describe('calculateOperationsKPIs', () => {
  it('calculates refund rate', () => {
    const periodOrders = {
      current: [
        createMockOrder({ status: 'completed' }),
        createMockOrder({ status: 'refunded' }),
        createMockOrder({ status: 'processing' }),
        createMockOrder({ status: 'refunded' }),
      ],
      previous: [],
    };

    const result = calculateOperationsKPIs(periodOrders);
    expect(result.refundRate.current).toBe(50); // 2/4 = 50%
  });

  it('calculates completion rate', () => {
    const periodOrders = {
      current: [
        createMockOrder({ status: 'completed' }),
        createMockOrder({ status: 'completed' }),
        createMockOrder({ status: 'processing' }),
      ],
      previous: [],
    };

    const result = calculateOperationsKPIs(periodOrders);
    // 2/3 ≈ 66.7%
    expect(result.orderCompletionRate.current).toBeCloseTo(66.67, 0);
  });

  it('calculates average processing time in days', () => {
    const created = new Date('2025-01-01T00:00:00Z');
    const completed = new Date('2025-01-03T00:00:00Z'); // 2 days later

    const periodOrders = {
      current: [
        createMockOrder({
          status: 'completed',
          date_created: created.toISOString(),
          date_completed: completed.toISOString(),
        }),
      ],
      previous: [],
    };

    const result = calculateOperationsKPIs(periodOrders);
    expect(result.avgProcessingTimeDays.current).toBe(2);
  });

  it('handles no completed orders for processing time', () => {
    const periodOrders = {
      current: [
        createMockOrder({ status: 'processing' }),
      ],
      previous: [],
    };

    const result = calculateOperationsKPIs(periodOrders);
    expect(result.avgProcessingTimeDays.current).toBe(0);
  });

  it('handles empty orders', () => {
    const periodOrders = { current: [], previous: [] };
    const result = calculateOperationsKPIs(periodOrders);

    expect(result.refundRate.current).toBe(0);
    expect(result.orderCompletionRate.current).toBe(0);
    expect(result.avgProcessingTimeDays.current).toBe(0);
  });
});

// ============================================
// calculateInventoryKPIs
// ============================================

describe('calculateInventoryKPIs', () => {
  it('calculates stock turnover rate', () => {
    const periodOrders = {
      current: [
        createMockOrder({
          status: 'processing',
          line_items: [createMockLineItem({ quantity: 10 })],
        }),
      ],
      previous: [
        createMockOrder({
          status: 'processing',
          line_items: [createMockLineItem({ quantity: 5 })],
        }),
      ],
    };
    const products = [
      createMockProduct({ stock_quantity: 100 }),
    ];

    const result = calculateInventoryKPIs(periodOrders, products);
    // current: 10/100 = 0.1, previous: 5/100 = 0.05
    expect(result.stockTurnoverRate.current).toBe(0.1);
    expect(result.stockTurnoverRate.previous).toBe(0.05);
  });

  it('avoids division by zero when no stock', () => {
    const periodOrders = {
      current: [
        createMockOrder({
          status: 'processing',
          line_items: [createMockLineItem({ quantity: 5 })],
        }),
      ],
      previous: [],
    };
    const products: WooCommerceProduct[] = [];

    const result = calculateInventoryKPIs(periodOrders, products);
    // avgStock fallback = 1, so turnover = 5/1 = 5
    expect(result.stockTurnoverRate.current).toBe(5);
  });

  it('calculates inventory value', () => {
    const products = [
      createMockProduct({ stock_quantity: 10, price: '25.00' }),
      createMockProduct({ stock_quantity: 5, price: '50.00' }),
    ];

    const result = calculateInventoryKPIs({ current: [], previous: [] }, products);
    // 10*25 + 5*50 = 250 + 250 = 500
    expect(result.inventoryValue.current).toBe(500);
  });

  it('counts low stock items', () => {
    const products = [
      createMockProduct({ stock_quantity: 3, stock_status: 'instock' }),
      createMockProduct({ stock_quantity: 5, stock_status: 'instock' }),
      createMockProduct({ stock_quantity: 50, stock_status: 'instock' }),
      createMockProduct({ stock_quantity: 0, stock_status: 'outofstock' }),
      createMockProduct({ stock_quantity: null, stock_status: 'outofstock' }),
    ];

    const result = calculateInventoryKPIs({ current: [], previous: [] }, products);
    // Low stock: qty 3 (1-5), qty 5 (1-5) = 2; Out of stock: 2 → total = 4
    expect(result.lowStockCount.current).toBe(4);
  });

  it('handles products with null stock quantity', () => {
    const products = [
      createMockProduct({ stock_quantity: null, price: '10.00' }),
    ];

    const result = calculateInventoryKPIs({ current: [], previous: [] }, products);
    expect(result.inventoryValue.current).toBe(0); // null * 10 = 0
  });
});

// ============================================
// calculateConcentrationKPIs
// ============================================

describe('calculateConcentrationKPIs', () => {
  it('calculates top 20% revenue share', () => {
    const orders = [
      createMockOrder({
        status: 'processing',
        line_items: [
          createMockLineItem({ product_id: 1, name: 'Big Seller', total: '800.00' }),
        ],
      }),
      createMockOrder({
        status: 'processing',
        line_items: [
          createMockLineItem({ product_id: 2, name: 'Medium', total: '150.00' }),
          createMockLineItem({ product_id: 3, name: 'Small 1', total: '30.00' }),
          createMockLineItem({ product_id: 4, name: 'Small 2', total: '15.00' }),
          createMockLineItem({ product_id: 5, name: 'Tiny', total: '5.00' }),
        ],
      }),
    ];

    const result = calculateConcentrationKPIs(orders);
    // 5 products, top 20% = ceil(5 * 0.2) = 1. Top 1: 800/1000 = 80%
    expect(result.top20RevenueShare).toBe(80);
  });

  it('truncates long product names', () => {
    const orders = [
      createMockOrder({
        status: 'processing',
        line_items: [
          createMockLineItem({
            product_id: 1,
            name: 'This is a very long product name that exceeds 25 chars',
            total: '100.00',
          }),
        ],
      }),
    ];

    const result = calculateConcentrationKPIs(orders);
    // Source truncates to substring(0, 22) + '...' = 25 chars max
    expect(result.paretoProducts[0]!.name).toBe('This is a very long pr...');
    expect(result.paretoProducts[0]!.name.length).toBeLessThanOrEqual(25);
  });

  it('keeps short product names intact', () => {
    const orders = [
      createMockOrder({
        status: 'processing',
        line_items: [createMockLineItem({ product_id: 1, name: 'Short Name', total: '50.00' })],
      }),
    ];

    const result = calculateConcentrationKPIs(orders);
    expect(result.paretoProducts[0]!.name).toBe('Short Name');
  });

  it('aggregates revenue across multiple orders for same product', () => {
    const orders = [
      createMockOrder({
        status: 'processing',
        line_items: [createMockLineItem({ product_id: 1, name: 'Widget', total: '50.00' })],
      }),
      createMockOrder({
        status: 'processing',
        line_items: [createMockLineItem({ product_id: 1, name: 'Widget', total: '75.00' })],
      }),
    ];

    const result = calculateConcentrationKPIs(orders);
    expect(result.paretoProducts).toHaveLength(1);
    expect(result.paretoProducts[0]!.revenue).toBe(125);
  });

  it('excludes non-revenue orders', () => {
    const orders = [
      createMockOrder({
        status: 'refunded',
        line_items: [createMockLineItem({ product_id: 1, name: 'Refunded', total: '100.00' })],
      }),
    ];

    const result = calculateConcentrationKPIs(orders);
    expect(result.paretoProducts).toHaveLength(0);
    expect(result.top20RevenueShare).toBe(0);
  });

  it('returns at most 10 pareto products', () => {
    const lineItems = Array.from({ length: 15 }, (_, i) =>
      createMockLineItem({ product_id: i + 1, name: `Product ${i + 1}`, total: `${(15 - i) * 10}.00` })
    );

    const orders = [
      createMockOrder({
        status: 'processing',
        line_items: lineItems,
      }),
    ];

    const result = calculateConcentrationKPIs(orders);
    expect(result.paretoProducts).toHaveLength(10);
  });

  it('handles empty orders', () => {
    const result = calculateConcentrationKPIs([]);
    expect(result.top20RevenueShare).toBe(0);
    expect(result.paretoProducts).toHaveLength(0);
  });
});

// ============================================
// calculateAllKPIs
// ============================================

describe('calculateAllKPIs', () => {
  it('returns all KPI groups', () => {
    const orders = [
      createOrderInPeriod(3, {
        status: 'completed',
        total: '100.00',
        date_completed: daysAgo(2),
        line_items: [createMockLineItem({ quantity: 2, total: '100.00' })],
      }),
    ];
    const products = [createMockProduct({ stock_quantity: 20, price: '50.00' })];

    const result = calculateAllKPIs(orders, products, 7);

    expect(result).toHaveProperty('revenue');
    expect(result).toHaveProperty('customer');
    expect(result).toHaveProperty('operations');
    expect(result).toHaveProperty('inventory');
    expect(result).toHaveProperty('concentration');

    expect(result.revenue.totalRevenue.current).toBe(100);
    expect(result.operations.orderCompletionRate.current).toBe(100);
  });

  it('handles completely empty data', () => {
    const result = calculateAllKPIs([], [], 30);

    expect(result.revenue.totalRevenue.current).toBe(0);
    expect(result.customer.repeatPurchaseRate.current).toBe(0);
    expect(result.operations.refundRate.current).toBe(0);
    expect(result.concentration.top20RevenueShare).toBe(0);
  });
});
