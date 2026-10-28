import { defineConfig } from '@playwright/test';

// Optional e2e suite (pnpm run test:e2e). Files are *.e2e.ts so vitest never picks them up.
export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: '*.e2e.ts',
  timeout: 180_000,
  workers: 1,
  reporter: [['list']],
});
