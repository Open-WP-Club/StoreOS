import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchApp, newProfile, seedStore } from './app';
import { CK, CS, startMockWoo } from './mockWoo';

const goto = (page: Page, route: string) =>
  page.evaluate((r) => {
    location.hash = `#/${r}`;
  }, route);

const storedPresets = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('woocommerce-search');
    return (JSON.parse(raw ?? '{}').state?.savedFilterPresets ?? []) as { name: string }[];
  });

/** Orders page: search for Buyer5 and save it as a view called `name` through the Presets UI. */
async function saveOrdersView(page: Page, name: string) {
  await goto(page, 'orders');
  const search = page.getByPlaceholder(/Search by order ID/);
  await search.fill('Buyer5');
  await page.getByRole('button', { name: /Presets/ }).click();
  await page.getByRole('button', { name: 'Save Current Filters' }).click();
  await page.getByLabel('Preset Name').fill(name);
  await page.getByRole('button', { name: 'Save Preset' }).click();
  await expect.poll(() => storedPresets(page).then((p) => p.map((x) => x.name))).toContain(name);
}

test('saved view: save from Orders, survives an app restart, re-applies the search', async () => {
  const mock = await startMockWoo({ orders: 30, products: 5, customers: 5 });
  const profile = newProfile();
  let app = await launchApp(profile);
  await seedStore(app.page, mock.url, CK, CS);
  await expect(async () => {
    expect(mock.log.some((l) => l.endsWith('/orders'))).toBe(true);
  }).toPass({ timeout: 30_000 });
  await saveOrdersView(app.page, 'My buyer view');
  await app.close();

  app = await launchApp(profile);
  await goto(app.page, 'orders');
  const search = app.page.getByPlaceholder(/Search by order ID/);
  await expect(search).toHaveValue('');
  await app.page.getByRole('button', { name: /Presets/ }).click();
  await app.page.getByRole('button', { name: /^My buyer view/ }).click();
  await expect(search).toHaveValue('Buyer5');
  await app.close();
  await mock.close();
});

test('backup: Create Backup -> wipe the view -> Restore from Backup brings it back (encrypted creds)', async () => {
  const mock = await startMockWoo({ orders: 30, products: 5, customers: 5 });
  const app = await launchApp(newProfile());
  const { page } = app;
  await seedStore(page, mock.url, CK, CS);
  await saveOrdersView(page, 'Backed-up view');

  await goto(page, 'settings');
  // The real code path runs; only the final <a download> sink is captured because a native
  // save dialog cannot be driven over CDP.
  await page.evaluate(() => {
    const w = window as unknown as { __backup?: Promise<string> };
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob) w.__backup = obj.text();
      return orig(obj);
    };
  });
  await page.locator('#settings-backup-passphrase').fill('e2e-passphrase');
  await page.getByRole('button', { name: /^(Create Backup|Създай Backup)$/ }).click();
  await expect
    .poll(() => page.evaluate(() => !!(window as unknown as { __backup?: unknown }).__backup))
    .toBe(true);
  const json = await page.evaluate(
    () => (window as unknown as { __backup: Promise<string> }).__backup
  );
  expect(json).not.toContain(CK);
  expect(json).not.toContain(CS);
  expect(JSON.parse(json).data.encryptedCredentials).toBeTruthy();
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'storeos-bk-')), 'backup.json');
  fs.writeFileSync(file, json);

  // Wipe the saved view, then restore from the file through the hidden file input.
  await page.evaluate(() => {
    localStorage.removeItem('woocommerce-search');
  });
  await page.reload();
  await goto(page, 'settings');
  expect(await storedPresets(page)).toEqual([]);
  await page.locator('input[type=file]').setInputFiles(file);
  await page.locator('#settings-restore-passphrase').fill('e2e-passphrase');
  await page.getByRole('button', { name: /^(Confirm|Потвърди)$/ }).click();
  await expect
    .poll(() => storedPresets(page).then((p) => p.map((x) => x.name)), { timeout: 15_000 })
    .toContain('Backed-up view');
  expect(mock.denied()).toBe(0);
  await app.close();
  await mock.close();
});

test('scheduled reports: settings persist across restart; enabling is blocked without a folder', async () => {
  // Generating a report file is NOT covered: the output folder can only be set through a native
  // folder dialog (reports:choose-dir), which cannot be driven over CDP, and reports:save refuses
  // any folder the main process did not get from that dialog.
  const mock = await startMockWoo({ orders: 5, products: 5, customers: 5 });
  const profile = newProfile();
  let app = await launchApp(profile);
  // Settings sections (other than Stores) only render once a store exists.
  await seedStore(app.page, mock.url, CK, CS);
  await goto(app.page, 'settings');
  const enable = app.page.getByLabel(/Enable scheduled reports|Включи планирани отчети/);
  await expect(enable).toBeDisabled();
  await expect(app.page.getByText(/No folder selected|Не е избрана папка/).first()).toBeVisible();

  await app.page.locator('#sr-type').selectOption('sales-summary');
  await app.page.locator('#sr-format').selectOption('pdf');
  await app.page.locator('#sr-freq').selectOption('weekly');
  await app.page.locator('#sr-day').selectOption('3');
  await app.page.locator('#sr-time').fill('07:45');
  await expect
    .poll(() =>
      app.page.evaluate(() => JSON.parse(localStorage.getItem('scheduled-reports') ?? '{}').state)
    )
    .toMatchObject({
      reportType: 'sales-summary',
      format: 'pdf',
      frequency: 'weekly',
      weekday: 3,
      time: '07:45',
      enabled: false,
    });
  await app.close();

  app = await launchApp(profile);
  await goto(app.page, 'settings');
  await expect(app.page.locator('#sr-type')).toHaveValue('sales-summary');
  await expect(app.page.locator('#sr-freq')).toHaveValue('weekly');
  await expect(app.page.locator('#sr-day')).toHaveValue('3');
  await expect(app.page.locator('#sr-time')).toHaveValue('07:45');
  await app.close();
  await mock.close();
});
