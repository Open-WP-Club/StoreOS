/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import 'fake-indexeddb/auto';
import { it } from 'vitest';
import {
  searchProducts,
  searchOrders,
  searchCustomers,
  universalSearch,
  applyProductFilters,
  applyOrderFilters,
} from '../src/utils/search';
import { sortItems, PRODUCT_SORT, ORDER_SORT, CUSTOMER_SORT } from '../src/utils/listView';
import { saveCollection, getCollection } from '../src/utils/indexedDBCache';
import { calculateAllKPIs } from '../src/utils/kpiCalculator';
import { convertToCSV } from '../src/utils/csvExport';
import { buildReorderReport } from '../src/utils/reorderReport';

const N_P = 10_000;
const N_O = 10_000;
const N_C = 5_000;
const words = ['Blue', 'Red', 'Shirt', 'Mug', 'Lamp', 'Chair', 'Cable', 'Bottle', 'Hat', 'Socks'];
const day = 86_400_000;

const products: any[] = Array.from({ length: N_P }, (_, i) => ({
  id: i + 1,
  name: `${words[i % 10]} ${words[(i * 7) % 10]} ${i}`,
  sku: `SKU-${i}`,
  price: String((i % 500) + 0.99),
  status: 'publish',
  stock_status: i % 9 === 0 ? 'outofstock' : 'instock',
  manage_stock: true,
  stock_quantity: i % 40,
  categories: [{ id: i % 20, name: 'c' }],
  meta_data: [{ key: i % 3 ? 'supplier' : 'x', value: `Sup${i % 15}` }],
}));
const orders: any[] = Array.from({ length: N_O }, (_, i) => ({
  id: 1000 + i,
  number: String(1000 + i),
  status: ['completed', 'processing', 'refunded', 'on-hold'][i % 4],
  total: String((i % 300) + 10),
  date_created: new Date(Date.now() - (i % 120) * day).toISOString(),
  date_completed: new Date(Date.now() - (i % 120) * day + day).toISOString(),
  customer_id: i % 5000,
  payment_method: i % 2 ? 'stripe' : 'cod',
  billing: {
    first_name: `Name${i % 800}`,
    last_name: `Last${i % 300}`,
    email: `u${i % 5000}@x.com`,
  },
  line_items: [
    {
      product_id: (i % N_P) + 1,
      variation_id: 0,
      quantity: (i % 3) + 1,
      total: '20',
      name: `P${i % N_P}`,
    },
    {
      product_id: ((i * 3) % N_P) + 1,
      variation_id: 0,
      quantity: 1,
      total: '5',
      name: `P${(i * 3) % N_P}`,
    },
  ],
}));
const customers: any[] = Array.from({ length: N_C }, (_, i) => ({
  id: i + 1,
  first_name: `Name${i % 800}`,
  last_name: `Last${i % 300}`,
  email: `u${i}@x.com`,
  username: `user${i}`,
  orders_count: i % 20,
  total_spent: String(i % 900),
  date_created: new Date(Date.now() - i * day).toISOString(),
}));

const results: [string, number][] = [];
async function t(name: string, fn: () => unknown, reps = 3): Promise<void> {
  let best = Infinity;
  for (let r = 0; r < reps; r++) {
    const s = performance.now();
    await fn();
    best = Math.min(best, performance.now() - s);
  }
  results.push([name, best]);
}

it('perf', async () => {
  await t('search products "shrt" (fuzzy)', () => searchProducts(products, 'shrt'));
  await t('search products "Blue" (substring)', () => searchProducts(products, 'Blue'));
  await t('search orders "name12"', () => searchOrders(orders, 'name12'));
  await t('search customers "name12"', () => searchCustomers(customers, 'name12'));
  await t('universalSearch "blue"', () => universalSearch('blue', products, orders, customers));
  await t('filter products', () =>
    applyProductFilters(products, { stockStatus: 'instock', priceMin: 10, category: '3' })
  );
  await t('filter orders', () =>
    applyOrderFilters(orders, { status: 'completed', totalMin: '50' })
  );
  await t('sort products by name', () =>
    sortItems(products, { key: 'name', dir: 'asc' }, PRODUCT_SORT)
  );
  await t('sort orders by date', () => sortItems(orders, { key: 'date', dir: 'desc' }, ORDER_SORT));
  await t('sort customers by name', () =>
    sortItems(customers, { key: 'name', dir: 'asc' }, CUSTOMER_SORT)
  );
  await t('IDB save products', () => saveCollection('products', 's1', products), 1);
  await t('IDB save orders', () => saveCollection('orders', 's1', orders), 1);
  await t('IDB load products', () => getCollection('products', 's1', 1e12), 1);
  await t('IDB load orders', () => getCollection('orders', 's1', 1e12), 1);
  await t('KPIs (30d)', () => calculateAllKPIs(orders, products, 30));
  await t('CSV orders', () =>
    convertToCSV(orders, [
      { key: 'id' },
      { key: 'status' },
      { key: 'total' },
      { key: 'billing.email' },
      { key: 'billing.first_name' },
      { key: 'date_created' },
    ])
  );
  await t('reorder report', () => buildReorderReport(products, orders, { lowStockThreshold: 5 }));
  console.table(results.map(([name, ms]) => ({ name, ms: Math.round(ms * 10) / 10 })));
});
