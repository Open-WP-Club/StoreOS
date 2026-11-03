import { test, expect } from '@playwright/test';
import { launchApp, newProfile, seedStore, seedStores } from './app';
import { startMockWoo, CK, CS } from './mockWoo';

test('partial refund from the order detail page', async () => {
  const mock = await startMockWoo({ orders: 6, products: 3, customers: 3 });
  const app = await launchApp(newProfile());
  const { page } = app;
  await seedStore(page, mock.url, CK, CS);
  await page.evaluate(() => {
    location.hash = '#/orders/4';
  });
  await page.getByRole('button', { name: 'Refund', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Refund order #4/ });
  await dialog.getByLabel('Quantity to refund for Item 4').fill('1');
  await dialog.getByLabel('Refund reason').fill('e2e damaged');
  await dialog.getByRole('button', { name: 'Refund', exact: true }).click();
  await expect(page.getByText('Refund created')).toBeVisible({ timeout: 15_000 });
  const call = mock.calls.find((c) => c.path.endsWith('/orders/4/refunds'));
  expect(call?.body.reason).toBe('e2e damaged');
  expect(Number(call?.body.amount)).toBeGreaterThan(0);
  await app.close();
  await mock.close();
});

test('CSV import: dry-run preview, then apply', async () => {
  const mock = await startMockWoo({ orders: 3, products: 3, customers: 3 });
  const app = await launchApp(newProfile());
  const { page } = app;
  await seedStore(page, mock.url, CK, CS);
  await page.evaluate(() => {
    location.hash = '#/products';
  });
  await expect(page.getByText('Product 1').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /^Export/ }).click();
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const csv = 'sku,name,regular_price\nSKU-1,Product 1,19.99\nNEW-1,Brand New,5.00\n';
  await page
    .getByLabel('CSV file')
    .setInputFiles({ name: 'p.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText(/1 to create, 1 to update/)).toBeVisible();
  expect(mock.calls.filter((c) => c.path.includes('/products'))).toHaveLength(0); // dry run

  await page.getByRole('button', { name: /Import 2 products/ }).click();
  await expect(page.getByText('Imported 2 products')).toBeVisible({ timeout: 15_000 });
  const batch = mock.calls.find((c) => c.path.endsWith('/products/batch'));
  expect(batch?.body.create[0].sku).toBe('NEW-1');
  expect(batch?.body.update[0].id).toBe(1);
  expect(mock.created.products.some((p) => p.sku === 'NEW-1')).toBe(true);
  await app.close();
  await mock.close();
});

test('copy a product to a second store, recreating its category hierarchy', async () => {
  const src = await startMockWoo({ orders: 3, products: 3, customers: 3 });
  const dst = await startMockWoo({ orders: 1, products: 1, customers: 1 });
  // Source has categories Parent > Child and one product in Child; target has neither.
  src.created.categories.push(
    { id: 11, name: 'Parent', slug: 'parent', parent: 0, count: 1 },
    { id: 12, name: 'Child', slug: 'child', parent: 11, count: 1 }
  );
  src.created.products.push({
    id: 501,
    name: 'Catalog Item',
    sku: 'CAT-1',
    type: 'simple',
    status: 'publish',
    price: '7.00',
    regular_price: '7.00',
    categories: [{ id: 12, name: 'Child', slug: 'child' }],
    images: [],
    attributes: [],
    date_modified: new Date().toISOString(),
  });
  const app = await launchApp(newProfile());
  const { page } = app;
  await seedStores(page, [
    { id: 'store-a', name: 'Store A', url: src.url, ck: CK, cs: CS },
    { id: 'store-b', name: 'Store B', url: dst.url, ck: CK, cs: CS },
  ]);
  await page.evaluate(() => {
    location.hash = '#/products';
  });
  const row = page.getByRole('row').filter({ hasText: 'Catalog Item' });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Copy to store' }).click();
  const dialog = page.getByRole('dialog', { name: /Copy products to another store/ });
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog.getByText('1 will be created')).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText(/2 new categories/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 30_000 });

  const parent = dst.created.categories.find((c) => c.slug === 'parent');
  const child = dst.created.categories.find((c) => c.slug === 'child');
  expect(parent).toBeTruthy();
  expect(child?.parent).toBe(parent?.id); // hierarchy remapped to the target's ids
  const copied = dst.created.products.find((p) => p.sku === 'CAT-1');
  expect(copied?.categories?.[0]?.id).toBe(child?.id);
  await app.close();
  await src.close();
  await dst.close();
});
