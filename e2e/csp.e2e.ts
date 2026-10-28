import { test, expect } from '@playwright/test';
import { launchApp, newProfile, seedStore } from './app';
import { startMockWoo, CK, CS } from './mockWoo';

// 5. Production CSP on the packaged file:// load: policy is enforced (inline/eval blocked),
// nothing the app itself needs is blocked, and WooCommerce requests still go through.
test('production CSP: enforced, no violations, WooCommerce requests work', async () => {
  const mock = await startMockWoo();
  const app = await launchApp(newProfile());
  const { page } = app;
  expect(page.url().startsWith('file://')).toBe(true);

  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  console.log('CSP:', csp);
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/);
  expect(csp).toContain("frame-src 'none'");

  await seedStore(page, mock.url, CK, CS);
  await expect.poll(() => mock.log.length, { timeout: 30_000 }).toBeGreaterThan(0);
  for (const r of [
    '',
    'orders',
    'products',
    'customers',
    'inventory',
    'coupons',
    'settings',
    'analytics',
    'store-health',
  ]) {
    await page.evaluate((x) => {
      location.hash = `#/${x}`;
    }, r);
    await page.waitForTimeout(800);
  }
  console.log('WC requests seen:', [...new Set(mock.log)]);
  expect(mock.log.some((l) => l.endsWith('/system_status') || l.endsWith('/orders'))).toBe(true);
  expect(mock.denied()).toBe(0);
  const own = app.consoleErrors.filter((e) => /content security policy|refused to/i.test(e));
  console.log(
    'violations from normal use:',
    own.length,
    'all console errors/warnings:',
    app.consoleErrors.length
  );
  expect(own).toEqual([]);
  expect(app.consoleErrors).toEqual([]);

  // Negative control: an injected inline script is blocked (CDP-evaluated eval is exempt from CSP, so not tested).
  const blocked = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      violations.push(e.violatedDirective)
    );
    const s = document.createElement('script');
    s.textContent = 'window.__inlineRan = true';
    document.head.appendChild(s);
    await new Promise((r) => setTimeout(r, 300));
    return {
      inlineRan: !!(window as unknown as { __inlineRan?: boolean }).__inlineRan,
      violations,
    };
  });
  console.log('negative control', JSON.stringify(blocked));
  expect(blocked.inlineRan).toBe(false);
  expect(blocked.violations.length).toBeGreaterThan(0);

  await app.close();
  await mock.close();
});
