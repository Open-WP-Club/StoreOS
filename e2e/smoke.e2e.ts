import { test } from '@playwright/test';
import { launchApp, newProfile, seedStore, ARTIFACTS } from './app';
import { startMockWoo, CK, CS } from './mockWoo';

test('smoke', async () => {
  const mock = await startMockWoo();
  const app = await launchApp(newProfile());
  await seedStore(app.page, mock.url, CK, CS);
  await app.page.waitForTimeout(4000);
  await app.page.screenshot({ path: `${ARTIFACTS}/smoke.png` });
  console.log(mock.log.slice(0, 10), app.consoleErrors, app.page.url());
  await app.close();
  await mock.close();
});
