import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Perf benchmark runner (not part of `pnpm test`):
//   node_modules/.bin/vitest run -c scripts/vitest.bench.config.ts
const root = resolve(import.meta.dirname, '..');

export default defineConfig({
  root,
  resolve: { alias: { '@': resolve(root, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['scripts/perf-bench.ts'],
    testTimeout: 300_000,
    server: { deps: { inline: [/lucide-react/, /@woocommerce/] } },
  },
});
