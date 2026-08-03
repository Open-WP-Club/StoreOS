import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@stores': resolve(__dirname, './src/stores'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@utils': resolve(__dirname, './src/utils'),
      '@services': resolve(__dirname, './src/services'),
      '@constants': resolve(__dirname, './src/constants'),
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
    exclude: ['node_modules', 'dist', 'dist-electron'],

    // Module mocking
    alias: {
      'chart.js': resolve(__dirname, '__mocks__/chartjs.js'),
      'react-chartjs-2': resolve(__dirname, '__mocks__/react-chartjs-2.js'),
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
