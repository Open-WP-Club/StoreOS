import http from 'node:http';
import type { AddressInfo } from 'node:net';

export const CK = 'ck_test_e2e';
export const CS = 'cs_test_e2e';

export interface MockWoo {
  url: string;
  /** Requests seen, e.g. "GET /wp-json/wc/v3/orders". */
  log: string[];
  /** Number of requests rejected for bad credentials. */
  denied: () => number;
  close: () => Promise<void>;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const order = (id: number) => ({
  id,
  number: String(id),
  status: ['processing', 'completed', 'on-hold'][id % 3],
  currency: 'USD',
  date_created: hoursAgo(id),
  date_modified: hoursAgo(id),
  total: (10 + (id % 90)).toFixed(2),
  billing: { first_name: `Buyer${id}`, last_name: 'Test', email: `buyer${id}@example.test` },
  shipping: {},
  line_items: [{ id: id * 10, name: `Item ${id}`, product_id: id, quantity: 1, total: '10.00' }],
  payment_method_title: 'Test',
});

const product = (id: number) => ({
  id,
  name: `Product ${id}`,
  sku: `SKU-${id}`,
  type: 'simple',
  status: 'publish',
  price: '9.99',
  regular_price: '9.99',
  manage_stock: true,
  stock_quantity: id % 50,
  stock_status: id % 50 ? 'instock' : 'outofstock',
  date_modified: hoursAgo(id),
  categories: [],
  images: [],
});

const customer = (id: number) => ({
  id,
  email: `cust${id}@example.test`,
  first_name: `Cust${id}`,
  last_name: 'Test',
  username: `cust${id}`,
  orders_count: id % 7,
  total_spent: String(id % 500),
  date_created: hoursAgo(id),
  billing: {},
  shipping: {},
});

const makers: Record<string, (id: number) => unknown> = {
  orders: order,
  products: product,
  customers: customer,
};

/** Local fake WooCommerce REST API (wc/v3) with fake ck_test/cs_test credentials. */
export async function startMockWoo(
  counts: { orders?: number; products?: number; customers?: number } = {}
): Promise<MockWoo> {
  const total: Record<string, number> = {
    orders: counts.orders ?? 120,
    products: counts.products ?? 120,
    customers: counts.customers ?? 120,
  };
  const log: string[] = [];
  let denied = 0;

  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Expose-Headers', 'x-wp-total, x-wp-totalpages');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    log.push(`${req.method} ${u.pathname}`);

    // http stores use OAuth1 (Authorization header or query), https use query-string keys.
    const auth = `${req.headers.authorization ?? ''} ${u.search}`;
    if (!auth.includes(CK)) {
      denied++;
      res.writeHead(401, { 'content-type': 'application/json' });
      return void res.end('{"code":"woocommerce_rest_cannot_view"}');
    }
    const name = /^\/wp-json\/wc\/v3\/([a-z_]+)/.exec(u.pathname)?.[1] ?? '';
    res.setHeader('content-type', 'application/json');
    if (name === 'system_status') {
      return void res.end(
        JSON.stringify({
          environment: { wc_version: '9.0.0', wp_version: '6.6', php_version: '8.3' },
          database: {},
          active_plugins: [],
          theme: {},
          settings: { currency: 'USD' },
        })
      );
    }
    const make = makers[name];
    if (!make) return void res.end('[]');
    const perPage = Math.min(Number(u.searchParams.get('per_page') ?? 10), 100);
    const page = Number(u.searchParams.get('page') ?? 1);
    const n = total[name] ?? 0;
    const items = [];
    for (let id = (page - 1) * perPage + 1; id <= Math.min(page * perPage, n); id++) {
      items.push(make(id));
    }
    res.setHeader('x-wp-total', String(n));
    res.setHeader('x-wp-totalpages', String(Math.max(1, Math.ceil(n / perPage))));
    res.end(JSON.stringify(items));
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    log,
    denied: () => denied,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}
