import { test, expect } from '@playwright/test';
import { launchApp, newProfile, seedStore, setOffline } from './app';
import { startMockWoo, CK, CS } from './mockWoo';

// Offline POS sale then sync, and an offline-created product placeholder then sync.
// "Offline" = the window `offline` event (drives useOffline); the mock stays reachable, so any
// order/product that reaches it before we go back online is a bug.

test('POS sale made offline is queued, then synced exactly once', async () => {
  const mock = await startMockWoo({ orders: 3, products: 5, customers: 3 });
  const app = await launchApp(newProfile());
  const { page } = app;
  await seedStore(page, mock.url, CK, CS);
  await page.evaluate(() => {
    location.hash = '#/pos';
  });
  await page.getByText('Product 1', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Плащане' }).click();
  await page.getByRole('button', { name: 'Карта' }).click();

  await setOffline(page, true);
  const finish = page.getByRole('button', { name: 'Завърши' });
  // Regression: the offline badge must not sit on top of the checkout button.
  await expect
    .poll(() =>
      finish.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })
    )
    .toBe(true);
  await finish.click();
  await expect(page.getByText(/Офлайн: продажбата е запазена/)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(3000);
  expect(mock.created.orders).toHaveLength(0);

  await setOffline(page, false);
  await expect.poll(() => mock.created.orders.length, { timeout: 30_000 }).toBe(1);
  const sale = mock.created.orders[0];
  expect(JSON.stringify(sale.meta_data)).toContain('_storeos_client_id');
  await page.waitForTimeout(6000);
  expect(mock.created.orders).toHaveLength(1); // replay is idempotent, no duplicate
  await app.close();
  await mock.close();
});

test('product cloned offline shows a pending placeholder and is created on reconnect', async () => {
  const mock = await startMockWoo({ orders: 3, products: 5, customers: 3 });
  const app = await launchApp(newProfile());
  const { page } = app;
  await seedStore(page, mock.url, CK, CS);
  await page.evaluate(() => {
    location.hash = '#/products';
  });
  await expect(page.getByText('Product 1').first()).toBeVisible({ timeout: 30_000 });
  page.on('dialog', (d) => void d.accept());

  await setOffline(page, true);
  await page.getByRole('button', { name: 'Clone' }).first().click();
  await expect(page.getByText('Pending sync').first()).toBeVisible({ timeout: 10_000 });
  expect(mock.created.products).toHaveLength(0);

  await setOffline(page, false);
  await expect.poll(() => mock.created.products.length, { timeout: 30_000 }).toBe(1);
  expect(mock.created.products[0].name).toContain('(Copy)');
  await expect(page.getByText('Pending sync')).toHaveCount(0, { timeout: 30_000 });
  await app.close();
  await mock.close();
});
