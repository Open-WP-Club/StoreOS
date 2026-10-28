import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import packageJson from './package.json' with { type: 'json' };

const projectRoot = import.meta.dirname;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, './src'),
      '@components': resolve(projectRoot, './src/components'),
      '@pages': resolve(projectRoot, './src/pages'),
      '@stores': resolve(projectRoot, './src/stores'),
      '@hooks': resolve(projectRoot, './src/hooks'),
      '@utils': resolve(projectRoot, './src/utils'),
      '@services': resolve(projectRoot, './src/services'),
      '@constants': resolve(projectRoot, './src/constants'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,

    // Performance
    pool: 'forks',
    maxWorkers: '50%',
    clearMocks: true,

    // Inline deps that don't support ESM natively
    server: {
      deps: {
        inline: [/lucide-react/, /@woocommerce/],
      },
    },

    // File patterns
    include: ['**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)', '**/*.(test|spec).(js|jsx|ts|tsx)'],
    exclude: ['**/node_modules/**', '**/.claude/**', 'dist/**', 'dist-electron/**', 'release/**'],

    // Module mocking
    alias: {
      'chart.js': resolve(projectRoot, '__mocks__/chartjs.js'),
      'react-chartjs-2': resolve(projectRoot, '__mocks__/react-chartjs-2.js'),
    },

    // Coverage
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.tsx', 'src/main.jsx', 'src/**/*.test.{js,jsx,ts,tsx}', 'src/**/__tests__/**', 'src/**/*.d.ts'],
      thresholds: {
        branches: 25,
        functions: 30,
        lines: 35,
        statements: 35,
      },
    },

    // Timeout
    testTimeout: 10000,
  },
});
