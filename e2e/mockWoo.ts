import http from 'node:http';
import type { AddressInfo } from 'node:net';

export const CK = 'ck_test_e2e';
export const CS = 'cs_test_e2e';

/** Loosely typed API payload; the specs only read a few well-known keys. */
export interface Item {
  id?: number;
  sku?: string;
  slug?: string;
  name?: string;
  [key: string]: unknown;
}

export interface MockWoo {
  url: string;
  /** Requests seen, e.g. "GET /wp-json/wc/v3/orders". */
  log: string[];
  /** Mutating requests with parsed JSON bodies. */
  calls: Array<{ method: string; path: string; body: Item }>;
  /** Items created through the API (orders, products, categories) and refunds. */
  created: {
    orders: Item[];
    products: Item[];
    categories: Item[];
    refunds: Item[];
  };
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
  const calls: MockWoo['calls'] = [];
  const created: MockWoo['created'] = { orders: [], products: [], categories: [], refunds: [] };
  let nextId = 9000;
  let denied = 0;

  /** Page through `list` = generated items + API-created extras (only built when extras exist). */
  const pageOf = (name: string, extras: Item[], u: URL, res: http.ServerResponse) => {
    const perPage = Math.min(Number(u.searchParams.get('per_page') ?? 10), 100);
    const page = Number(u.searchParams.get('page') ?? 1);
    let all: Item[] = [];
    const n = total[name] ?? 0;
    for (let id = 1; id <= n; id++) all.push((makers[name] as (i: number) => Item)(id));
    all = all.concat(extras);
    const sku = u.searchParams.get('sku');
    if (sku) all = all.filter((p) => p.sku === sku);
    res.setHeader('x-wp-total', String(all.length));
    res.setHeader('x-wp-totalpages', String(Math.max(1, Math.ceil(all.length / perPage))));
    res.end(JSON.stringify(all.slice((page - 1) * perPage, page * perPage)));
  };

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => handle(req, res, body));
  });

  const handle = (req: http.IncomingMessage, res: http.ServerResponse, rawBody: string) => {
    const u = new URL(req.url ?? '/', 'http://x');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Expose-Headers', 'x-wp-total, x-wp-totalpages');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    log.push(`${req.method} ${u.pathname}`);

    if (!u.pathname.startsWith('/wp-json/')) {
      res.setHeader('content-type', 'text/html');
      return void res.end('<title>Mock WP Admin</title><h1>Mock WP Admin</h1>');
    }

    // Public, credential-less endpoints (the store-logo lookup reads the site root + media).
    if (u.pathname === '/wp-json/' || u.pathname.startsWith('/wp-json/wp/v2/')) {
      res.setHeader('content-type', 'application/json');
      return void res.end('{"name":"E2E Store"}');
    }

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
    const json = (v: unknown) => void res.end(JSON.stringify(v));
    const body = rawBody ? JSON.parse(rawBody) : undefined;
    if (req.method !== 'GET') calls.push({ method: req.method ?? '', path: u.pathname, body });
    const rest = u.pathname.replace('/wp-json/wc/v3/', '');
    const mk = (extra: object): Item => ({
      id: nextId++,
      date_modified: new Date().toISOString(),
      ...extra,
    });

    if (rest === 'products/attributes') return json([]);
    if (rest === 'products/categories') {
      const all = created.categories;
      res.setHeader('x-wp-total', String(all.length));
      res.setHeader('x-wp-totalpages', '1');
      return json(all);
    }
    if (rest === 'products/categories/batch') {
      const out = (body.create ?? []).map((c: object) => {
        const item = mk({ count: 0, ...c });
        created.categories.push(item);
        return item;
      });
      return json({ create: out, update: [], delete: [] });
    }
    if (rest === 'products/batch') {
      const out = (body.create ?? []).map((c: object) => {
        const item = mk({ ...product(1), name: '', ...c });
        created.products.push(item);
        return item;
      });
      const upd = (body.update ?? []).map((c: { id: number }) => {
        const ex = created.products.find((p) => p.id === c.id);
        return ex ? Object.assign(ex, c) : { ...product(c.id), ...c };
      });
      return json({ create: out, update: upd, delete: [] });
    }
    if (rest === 'products' && req.method === 'POST') {
      const item = mk({ ...product(1), ...body });
      created.products.push(item);
      return json(item);
    }
    if (rest === 'products' && (created.products.length || u.searchParams.has('sku'))) {
      return pageOf('products', created.products, u, res);
    }
    if (rest === 'orders' && req.method === 'POST') {
      const lines = (body.line_items ?? []).map(
        (l: { product_id: number; quantity: number }, i: number) => ({
          id: i + 1,
          name: `Product ${l.product_id}`,
          product_id: l.product_id,
          quantity: l.quantity,
          total: (9.99 * l.quantity).toFixed(2),
        })
      );
      const sum = lines.reduce((a: number, l: { total: string }) => a + Number(l.total), 0);
      const item = mk({
        ...order(1),
        ...body,
        number: String(nextId),
        date_created: new Date().toISOString(),
        line_items: lines,
        total: sum.toFixed(2),
        currency_symbol: '$',
      });
      item.number = String(item.id);
      created.orders.push(item);
      return json(item);
    }
    if (rest === 'orders' && created.orders.length) return pageOf('orders', created.orders, u, res);
    const orderOne = /^orders\/(\d+)(\/refunds)?$/.exec(rest);
    const createdOrder = orderOne && created.orders.find((o) => o.id === Number(orderOne[1]));
    if (orderOne?.[2]) {
      const id = Number(orderOne[1]);
      if (req.method === 'POST') {
        const r = mk({ ...body, order_id: id, total: `-${body.amount}`, amount: body.amount });
        created.refunds.push(r);
        return json(r);
      }
      return json(created.refunds.filter((r) => r.order_id === id));
    }
    if (createdOrder && req.method === 'GET') {
      const refunds = created.refunds.filter((r) => r.order_id === createdOrder.id);
      return json({ ...createdOrder, refunds: refunds.map((r) => ({ id: r.id, total: r.total })) });
    }
    if (rest === 'orders' && req.method === 'POST') return json({});

    const make = makers[name];
    if (!make) return void res.end('[]');
    const one = /^\/wp-json\/wc\/v3\/[a-z_]+\/(\d+)$/.exec(u.pathname)?.[1];
    if (one) {
      // Single-item read / update (PUT merges the JSON body into the generated item).
      const patch = req.method === 'PUT' && body ? body : {};
      const ex = created.products.find((p) => p.id === Number(one));
      return json({ ...((ex ?? make(Number(one))) as object), ...patch });
    }
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
  };

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    log,
    calls,
    created,
    denied: () => denied,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}
