import { chromium, test, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

// Packaged-style build (electron-builder --dir): file:// load, production CSP, real fuses.
// Override with STOREOS_APP_BIN. The fuses disable --inspect, so Playwright's _electron
// launcher cannot attach; we use Chromium's --remote-debugging-port + connectOverCDP instead.
const ROOT = path.resolve(import.meta.dirname, '..');
const APP_NAME = 'StoreOS - Built for WooCommerce';
export const APP_BIN =
  process.env.STOREOS_APP_BIN ??
  path.join(ROOT, `release/mac-arm64/${APP_NAME}.app/Contents/MacOS/${APP_NAME}`);

export const ARTIFACTS = path.join(import.meta.dirname, 'artifacts');

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });

// Every launched app is tracked and force-killed after each test (even when it failed).
const running = new Set<ChildProcess>();
test.afterEach(() => {
  for (const p of running) p.kill('SIGKILL');
  running.clear();
});

export const newProfile = () => fs.mkdtempSync(path.join(os.tmpdir(), 'storeos-e2e-'));

export interface RunningApp {
  page: Page;
  browser: Browser;
  proc: ChildProcess;
  consoleErrors: string[];
  close: () => Promise<void>;
}

/** Launch the packaged app on a given userData dir (reuse the dir to simulate a restart). */
export async function launchApp(userData: string): Promise<RunningApp> {
  if (!fs.existsSync(APP_BIN)) {
    throw new Error(`App binary not found: ${APP_BIN} (run pnpm run e2e:build)`);
  }
  const port = await freePort();
  const proc = spawn(
    APP_BIN,
    [`--user-data-dir=${userData}`, `--remote-debugging-port=${port}`, '--use-mock-keychain'],
    {
      stdio: 'ignore',
    }
  );
  running.add(proc);
  let browser: Browser | undefined;
  for (let i = 0; i < 60 && !browser; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!browser) {
    proc.kill();
    throw new Error('Could not attach to app over CDP');
  }
  const ctx = browser.contexts()[0]!;
  const page = ctx.pages()[0] ?? (await ctx.waitForEvent('page'));
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleErrors.push(`[${m.type()}] ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));
  await page.waitForLoadState('domcontentloaded');
  return {
    page,
    browser,
    proc,
    consoleErrors,
    close: async () => {
      await browser.close().catch(() => {});
      proc.kill('SIGTERM');
      await new Promise((r) => (proc.exitCode !== null ? r(null) : proc.once('exit', r)));
    },
  };
}

/** Write a store config straight into localStorage (legacy plaintext shape) and reload. */
export async function seedStore(page: Page, url: string, ck: string, cs: string) {
  await page.evaluate(
    ([u, k, s]) => {
      localStorage.setItem(
        'woocommerce-stores',
        JSON.stringify({
          state: {
            stores: [
              {
                id: 'store-e2e',
                name: 'E2E Store',
                url: u,
                consumerKey: k,
                consumerSecret: s,
                createdAt: new Date().toISOString(),
                loadingSettings: {},
              },
            ],
            currentStoreId: 'store-e2e',
          },
          version: 0,
        })
      );
    },
    [url, ck, cs]
  );
  await page.reload();
}
