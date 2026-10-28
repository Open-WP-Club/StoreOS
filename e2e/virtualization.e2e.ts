import { test, expect, type Page } from '@playwright/test';
import { launchApp, newProfile, seedStore, ARTIFACTS } from './app';
import { startMockWoo, CK, CS } from './mockWoo';

// 4. List virtualization with 6k rows loaded + 200 rows per page; also 5. production CSP
// (all routes visited under the packaged file:// build; no CSP violations, WC requests work).
const TOTAL = 6000;

const rowInfo = (page: Page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll('tbody tr')];
    const data = rows.filter((r) => r.querySelectorAll('td').length > 2);
    const scroller = [...document.querySelectorAll('div')].find(
      (d) => d.querySelector(':scope > table') && d.scrollHeight > d.clientHeight + 50
    );
    return {
      trInDom: rows.length,
      dataRows: data.length,
      firstRow: data[0]?.textContent?.slice(0, 40) ?? null,
      scrollerFound: !!scroller,
      scrollHeight: scroller?.scrollHeight ?? 0,
      clientHeight: scroller?.clientHeight ?? 0,
    };
  });

test('virtualized lists with 6000 rows', async () => {
  const mock = await startMockWoo({ orders: TOTAL, products: TOTAL, customers: TOTAL });
  const app = await launchApp(newProfile());
  const { page } = app;
  await seedStore(page, mock.url, CK, CS);
  await expect(async () => {
    expect(mock.log.filter((l) => l.endsWith('/orders')).length).toBeGreaterThanOrEqual(
      TOTAL / 100
    );
  }).toPass({ timeout: 120_000 });
  await page.waitForTimeout(5000);

  for (const route of (process.env.ROUTES ?? 'orders,products,inventory,customers').split(',')) {
    await page.evaluate((r) => {
      location.hash = `#/${r}`;
    }, route);
    await expect(page.getByText(`of ${TOTAL}`).first()).toBeVisible({ timeout: 30_000 });
    // Largest page size => 200 rows of data, far above the virtualization threshold.
    await page.locator('select').last().selectOption('200');
    await page.waitForTimeout(1000);

    const before = await rowInfo(page);
    console.log(route, 'initial', JSON.stringify(before));
    expect(before.dataRows).toBeLessThan(120); // 200 per page, only a window rendered
    expect(before.dataRows).toBeGreaterThan(5);
    expect(before.scrollerFound).toBe(true);
    await page.screenshot({ path: `${ARTIFACTS}/4-${route}-top.png` });

    // Scroll to the bottom of the virtual scroller: window moves, DOM stays small.
    const t0 = Date.now();
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('div')].find(
        (d) => d.querySelector(':scope > table') && d.scrollHeight > d.clientHeight + 50
      )!;
      s.scrollTop = s.scrollHeight;
    });
    await page.waitForTimeout(600);
    const after = await rowInfo(page);
    console.log(route, 'after scroll', JSON.stringify(after), `${Date.now() - t0}ms`);
    expect(after.firstRow).not.toBe(before.firstRow);
    expect(after.dataRows).toBeLessThan(120);
    await page.screenshot({ path: `${ARTIFACTS}/4-${route}-bottom.png` });

    // Select-all works on the data array, not the DOM (customers has no checkboxes).
    const header = page.locator('thead input[type=checkbox]').first();
    if (await header.count()) {
      await header.check();
      await page.waitForTimeout(500);
      const text = await page.evaluate(() => document.body.innerText);

      expect(text).toMatch(/\b200 (\S+ )?(selected|поръчки|products)/i);
      expect(await page.locator('tbody input[type=checkbox]:checked').count()).toBeGreaterThan(5);
      await page.screenshot({ path: `${ARTIFACTS}/4-${route}-selected.png` });
      await header.uncheck();
    }
  }

  // 5. Console must be free of CSP violations / errors after visiting every list route.
  const csp = app.consoleErrors.filter((e) => /content security policy|refused to/i.test(e));
  console.log('console errors/warnings:', app.consoleErrors.length, 'csp:', csp.length);
  expect(csp).toEqual([]);
  expect(app.consoleErrors).toEqual([]);
  expect(mock.denied()).toBe(0);
  await app.close();
  await mock.close();
});
