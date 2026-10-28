import { test, expect } from '@playwright/test';
import { launchApp, newProfile, seedStore, ARTIFACTS } from './app';
import { startMockWoo, CK, CS } from './mockWoo';

// 3. IndexedDB v3 -> v4 migration of a large legacy whole-array blob, UI responsiveness
// during the upgrade, and per-item writes after a single edit.
const N = Number(process.env.E2E_IDB_ORDERS ?? 20_000);

test(`IndexedDB v3 -> v4 migration (${N} orders)`, async () => {
  const mock = await startMockWoo({ orders: N, products: 50, customers: 50 });
  const app = await launchApp(newProfile());
  const { page } = app;

  // Instrumentation survives reloads: open/upgrade timing, long tasks, rAF gaps, put/delete counts.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const m = {
      upgrade: null as null | { oldVersion: number; newVersion: number; ms: number },
      openMs: 0,
      longTasks: [] as number[],
      maxFrameGap: 0,
      puts: {} as Record<string, number>,
      deletes: {} as Record<string, number>,
    };
    w.__m = m;
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name: string, version?: number) => {
      const t0 = performance.now();
      const req = open(name, version);
      if (name === 'woocommerce-cache') {
        let upT = 0;
        req.addEventListener('upgradeneeded', (e) => {
          upT = performance.now();
          m.upgrade = { oldVersion: e.oldVersion, newVersion: e.newVersion ?? 0, ms: 0 };
        });
        req.addEventListener('success', () => {
          m.openMs = performance.now() - t0;
          if (m.upgrade && upT) m.upgrade.ms = performance.now() - upT;
        });
      }
      return req;
    };
    const wrap = (k: 'put' | 'delete', into: Record<string, number>) => {
      const orig = IDBObjectStore.prototype[k] as (...a: unknown[]) => IDBRequest;
      IDBObjectStore.prototype[k] = function (this: IDBObjectStore, ...a: unknown[]) {
        into[this.name] = (into[this.name] ?? 0) + 1;
        return orig.apply(this, a);
      } as never;
    };
    wrap('put', m.puts);
    wrap('delete', m.deletes);
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => m.longTasks.push(Math.round(e.duration)))
    ).observe({ entryTypes: ['longtask'] });
    let last = performance.now();
    const tick = (t: number) => {
      m.maxFrameGap = Math.max(m.maxFrameGap, t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.reload();
  await page.waitForTimeout(1500);

  // Replace the app's v4 database with a legacy v3 one holding whole-array blobs.
  const seeded = await page.evaluate(async (n) => {
    await new Promise<void>((res, rej) => {
      const d = indexedDB.deleteDatabase('woocommerce-cache');
      d.onsuccess = () => res();
      d.onerror = () => rej(d.error);
      d.onblocked = () => res();
    });
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open.call(indexedDB, 'woocommerce-cache', 3);
      r.onupgradeneeded = () => {
        for (const s of ['products', 'orders', 'customers', 'coupons', 'offline_queue'])
          r.result.createObjectStore(s);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const orders = Array.from({ length: n }, (_, i) => {
      const id = i + 1;
      return {
        id,
        number: String(id),
        status: ['processing', 'completed', 'on-hold'][id % 3],
        currency: 'USD',
        date_created: new Date(Date.now() - id * 3_600_000).toISOString(),
        date_modified: new Date(Date.now() - id * 3_600_000).toISOString(),
        total: (10 + (id % 90)).toFixed(2),
        billing: { first_name: `Buyer${id}`, last_name: 'Test', email: `buyer${id}@example.test` },
        shipping: {},
        line_items: [
          { id: id * 10, name: `Item ${id}`, product_id: id, quantity: 1, total: '10.00' },
        ],
        payment_method_title: 'Test',
      };
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('orders', 'readwrite');
      tx.objectStore('orders').put(
        { data: orders, timestamp: Date.now(), storeId: 'store-e2e_recent' },
        'store-e2e_orders_recent'
      );
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
    return { version: 3, orders: n };
  }, N);
  console.log('seeded legacy v3 blob', seeded);

  // Reload: the app opens v4 -> upgrade runs against the 20k-order blob.
  await seedStore(page, mock.url, CK, CS);
  await expect
    .poll(
      () => page.evaluate(() => (window as unknown as { __m: { upgrade: unknown } }).__m.upgrade),
      { timeout: 120_000 }
    )
    .not.toBeNull();
  await page.waitForTimeout(8000);
  const m = await page.evaluate(() => (window as unknown as { __m: Record<string, unknown> }).__m);
  console.log('migration metrics', JSON.stringify(m));

  // Result: items split, legacy blob removed, meta present.
  const after = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('woocommerce-cache');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const count = (s: string, q?: IDBKeyRange) =>
      new Promise<number>((res) => {
        const r = db.transaction(s).objectStore(s).count(q);
        r.onsuccess = () => res(r.result);
      });
    const keys = await new Promise<IDBValidKey[]>((res) => {
      const r = db.transaction('orders').objectStore('orders').getAllKeys();
      r.onsuccess = () => res(r.result);
    });
    const out = {
      version: db.version,
      items: await count('orders_items'),
      legacyKeys: keys.map(String),
    };
    db.close();
    return out;
  });
  console.log('after migration', JSON.stringify(after));
  expect((m.upgrade as { oldVersion: number; newVersion: number }).oldVersion).toBe(3);
  expect(after.version).toBe(4);
  expect(after.items).toBe(N);
  expect(after.legacyKeys).not.toContain('store-e2e_orders_recent'); // blob replaced by meta
  await page.screenshot({ path: `${ARTIFACTS}/3-after-migration.png` });

  // Single edit => per-item put (not a 20k rewrite). Reset counters, change one order status.
  await page.evaluate(() => {
    const m = (
      window as unknown as {
        __m: { puts: Record<string, number>; deletes: Record<string, number> };
      }
    ).__m;
    for (const k of Object.keys(m.puts)) delete m.puts[k];
    for (const k of Object.keys(m.deletes)) delete m.deletes[k];
  });
  await page.evaluate(() => {
    location.hash = '#/orders';
  });
  await expect(page.getByText(`of ${N}`).first()).toBeVisible({ timeout: 60_000 });
  const firstStatus = page
    .locator('tbody tr')
    .first()
    .locator('button', { hasText: /processing|completed|on-hold/ })
    .first();
  await firstStatus.click();
  await page.screenshot({ path: `${ARTIFACTS}/3-status-menu.png` });
  const target = (await firstStatus.innerText()).includes('completed') ? 'cancelled' : 'completed';
  await page
    .getByRole('button', { name: new RegExp(`^${target}$`, 'i') })
    .first()
    .click();
  await page.waitForTimeout(4000);
  const ops = await page.evaluate(() => {
    const m = (
      window as unknown as {
        __m: { puts: Record<string, number>; deletes: Record<string, number> };
      }
    ).__m;
    return { puts: m.puts, deletes: m.deletes };
  });
  console.log(
    'ops after single edit',
    JSON.stringify(ops),
    'PUTs to mock:',
    mock.log.filter((l) => l.startsWith('PUT'))
  );
  expect(ops.puts['orders_items'] ?? 0).toBeGreaterThan(0);
  expect(ops.puts['orders_items'] ?? 0).toBeLessThan(10);
  expect(ops.deletes['orders_items'] ?? 0).toBeLessThan(10);

  await app.close();
  await mock.close();
});
