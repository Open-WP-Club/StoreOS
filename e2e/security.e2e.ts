import { test, expect } from '@playwright/test';
import { launchApp, newProfile, seedStore, ARTIFACTS } from './app';
import { startMockWoo, CK, CS } from './mockWoo';

// 1. safeStorage: credentials encrypted at rest, survive restart, legacy plaintext migrated.
test('safeStorage encrypts credentials, survives restart, migrates plaintext', async () => {
  const mock = await startMockWoo();
  const profile = newProfile();
  let app = await launchApp(profile);

  expect(await app.page.evaluate(() => typeof window.electronAPI?.secureStorage?.encrypt)).toBe(
    'function'
  );
  await seedStore(app.page, mock.url, CK, CS); // legacy plaintext shape + reload
  await expect.poll(() => mock.log.length, { timeout: 30_000 }).toBeGreaterThan(0);

  const raw = await app.page.evaluate(() => localStorage.getItem('woocommerce-stores'));
  console.log('stored value (truncated):', raw?.slice(0, 60));
  expect(raw).toMatch(/^enc:v1:/); // plaintext legacy value was re-written encrypted
  expect(raw).not.toContain(CK);
  expect(raw).not.toContain(CS);
  expect(mock.denied()).toBe(0);
  await app.page.screenshot({ path: `${ARTIFACTS}/1-safestorage-first-run.png` });
  await app.close();

  // Restart on the same profile: must decrypt and still authenticate.
  mock.log.length = 0;
  app = await launchApp(profile);
  await expect.poll(() => mock.log.length, { timeout: 30_000 }).toBeGreaterThan(0);
  const raw2 = await app.page.evaluate(() => localStorage.getItem('woocommerce-stores'));
  expect(raw2).toMatch(/^enc:v1:/);
  expect(raw2).not.toContain(CK);
  expect(mock.denied()).toBe(0);
  await app.page.screenshot({ path: `${ARTIFACTS}/1-safestorage-after-restart.png` });
  await app.close();
  await mock.close();
});

// 2. WP Admin isolated window; navigation outside the store origin is blocked.
test('WP Admin opens isolated; cross-origin navigation blocked; https-only external', async () => {
  const mock = await startMockWoo();
  const other = mock.url.replace('localhost', '127.0.0.1'); // different origin, same server
  const app = await launchApp(newProfile());
  const { page, browser } = app;

  // Rejected inputs (not https, not localhost / not a string).
  const open = (u: unknown) =>
    page.evaluate((x) => window.electronAPI!.openWpAdmin(x as string), u);
  expect(await open('http://example.com/wp-admin/')).toBe(false);
  expect(await open('file:///etc/passwd')).toBe(false);
  expect(await open('javascript:alert(1)')).toBe(false);
  expect(await open(42)).toBe(false);

  // Accepted: store origin (http://localhost allowed for local dev stores).
  expect(await open(`${mock.url}/wp-admin/`)).toBe(true);
  const admin = await expect
    .poll(
      () =>
        browser
          .contexts()
          .flatMap((c) => c.pages())
          .find((p) => p.url().startsWith(mock.url)),
      {
        timeout: 15_000,
      }
    )
    .toBeTruthy()
    .then(() =>
      browser
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().startsWith(mock.url))!
    );
  // Isolated: own session partition => the app's localStorage/origin is not shared.
  expect(
    await admin.evaluate(() => typeof (window as unknown as { electronAPI?: unknown }).electronAPI)
  ).toBe('undefined');
  await admin.screenshot({ path: `${ARTIFACTS}/2-wpadmin-window.png` });

  // Navigation to another origin is blocked (page stays put).
  const before = admin.url();
  await admin
    .evaluate((u) => {
      location.href = u;
    }, `${other}/wp-admin/`)
    .catch(() => {});
  await admin.waitForTimeout(1500);
  expect(admin.url()).toBe(before);
  // window.open to another origin: denied, no new page.
  const pagesBefore = browser.contexts().flatMap((c) => c.pages()).length;
  await admin
    .evaluate((u) => {
      window.open(u);
    }, `${other}/`)
    .catch(() => {});
  await admin.waitForTimeout(1500);
  expect(browser.contexts().flatMap((c) => c.pages()).length).toBe(pagesBefore);

  // Main window cannot be navigated away from file:// nor spawn windows.
  await page
    .evaluate((u) => {
      location.href = u;
    }, `${mock.url}/wp-admin/`)
    .catch(() => {});
  await page.waitForTimeout(1500);
  expect(page.url().startsWith('file:')).toBe(true);
  await page
    .evaluate((u) => {
      window.open(u);
    }, `${mock.url}/`)
    .catch(() => {});
  await page.waitForTimeout(1500);
  expect(browser.contexts().flatMap((c) => c.pages()).length).toBe(pagesBefore);

  await app.close();
  await mock.close();
});

// 6. PIN lock throttling persists across restart.
test('PIN lockout persists across restart', async () => {
  const profile = newProfile();
  let app = await launchApp(profile);
  // Legacy bare hash of "1234" (the app migrates it on first successful unlock).
  await app.page.evaluate(() => {
    let h = 0;
    for (const c of '1234') {
      h = (h << 5) - h + c.charCodeAt(0);
      h &= h;
    }
    localStorage.setItem(
      'woocommerce-app-settings',
      JSON.stringify({
        state: {
          language: 'en',
          pinEnabled: true,
          pinCode: h.toString(36),
          pinTimeout: 30,
          lastActivity: 1,
          failedPinAttempts: 0,
          pinLockedUntil: null,
        },
        version: 0,
      })
    );
  });
  await app.page.reload();
  await expect(app.page.getByText('Заключено')).toBeVisible({ timeout: 15_000 });
  await app.page.screenshot({ path: `${ARTIFACTS}/6-pin-locked.png` });

  for (let i = 0; i < 5; i++) {
    await enter(app.page, '9999');
    await app.page.waitForTimeout(600);
  }
  await expect(app.page.getByText(/Твърде много опити/)).toBeVisible({ timeout: 5000 });
  const st = () =>
    app.page.evaluate(() => JSON.parse(localStorage.getItem('woocommerce-app-settings')!).state);
  const s1 = await st();
  console.log(
    'after 5 failures:',
    s1.failedPinAttempts,
    'lockedUntil in',
    Math.round((s1.pinLockedUntil - Date.now()) / 1000),
    's'
  );
  expect(s1.failedPinAttempts).toBe(5);
  expect(s1.pinLockedUntil).toBeGreaterThan(Date.now());
  await app.page.screenshot({ path: `${ARTIFACTS}/6-pin-throttled.png` });
  await app.close();

  // Restart: the correct PIN must still be refused while locked out.
  app = await launchApp(profile);
  await expect(app.page.getByText('Заключено')).toBeVisible({ timeout: 15_000 });
  const s2 = await st();
  expect(s2.pinLockedUntil).toBe(s1.pinLockedUntil);
  await enter(app.page, '1234');
  await expect(app.page.getByText(/Твърде много опити|Грешен PIN/)).toBeVisible({ timeout: 5000 });
  await expect(app.page.getByText('Заключено')).toBeVisible(); // still locked despite correct PIN
  await app.page.screenshot({ path: `${ARTIFACTS}/6-pin-after-restart.png` });
  await app.close();
});

async function enter(page: import('@playwright/test').Page, pin: string) {
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
}
