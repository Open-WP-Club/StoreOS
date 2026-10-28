import { test, expect } from '@playwright/test';
import { launchApp, newProfile, ARTIFACTS } from './app';

// Packaged app loads from file://; in-app routing must survive a reload (View > Reload,
// "clear cache" actions and ErrorBoundary all call location.reload()).
test('reload after in-app navigation keeps the app rendered', async () => {
  const app = await launchApp(newProfile());
  const { page } = app;
  await expect(page.locator('#root > *').first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => new URL(page.url()).hash, { timeout: 10_000 }).toBe('#/setup');
  console.log('url before reload:', page.url());
  await page.evaluate(() => location.reload());
  await page.waitForTimeout(2500);
  console.log('url after reload:', page.url());
  await page.screenshot({ path: `${ARTIFACTS}/reload-after-navigation.png` });
  await expect(page.locator('#root > *').first()).toBeVisible({ timeout: 10_000 });
  await app.close();
});
