import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  // Main process configuration
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.js'),
        },
      },
    },
  },

  // Preload scripts configuration
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      // Output as CommonJS for sandbox compatibility
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.js'),
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },

  // Renderer process configuration (React app)
  renderer: {
    root: '.',
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', { target: '19' }]],
        },
      }),
      // Node.js polyfills for packages like @woocommerce/woocommerce-rest-api.
      // The package accesses these globals when creating authenticated requests.
      nodePolyfills({
        include: ['stream', 'crypto', 'util'],
        globals: { Buffer: true, global: true, process: true },
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
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
    build: {
      outDir: 'dist',
      minify: 'esbuild',
      target: 'esnext',
      // Remove console.log and debugger in production
      esbuild: {
        drop: ['console', 'debugger'],
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
        output: {
          // Improved chunk naming for lazy-loaded routes
          chunkFileNames: (chunkInfo) => {
            if (chunkInfo.name?.includes('Analytics')) {
              return 'assets/analytics-[hash].js';
            }
            return 'assets/[name]-[hash].js';
          },
          manualChunks: (id) => {
            // React core - stable, cache long-term
            if (
              id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router')
            ) {
              return 'react-vendor';
            }

            // The WooCommerce client needs a Node stream shim. Keep it in a
            // separately cacheable chunk instead of the application entry.
            if (id.includes('node_modules/stream-browserify')) {
              return 'stream-polyfill';
            }

            // PDF export dependencies are large and shared by several pages.
            // Keep jsPDF and its compression/image dependencies cacheable.
            if (
              id.includes('node_modules/jspdf') ||
              id.includes('node_modules/jspdf-autotable') ||
              id.includes('node_modules/pako') ||
              id.includes('node_modules/fflate') ||
              id.includes('node_modules/fast-png') ||
              id.includes('node_modules/iobuffer')
            ) {
              return 'pdf-vendor';
            }

            // Chart.js - only loaded with analytics pages
            if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
              return 'chart-vendor';
            }

            // NOTE: lucide-react is NOT in manualChunks to allow proper tree-shaking
            // Each icon is only ~300 bytes, and tree-shaking will include only used icons

            // State management
            if (id.includes('node_modules/zustand')) {
              return 'state-vendor';
            }

            // WooCommerce API (includes axios internally)
            if (id.includes('node_modules/@woocommerce') || id.includes('node_modules/axios')) {
              return 'woocommerce-vendor';
            }
          },
        },
      },
      cssCodeSplit: true,
      sourcemap: false,
      chunkSizeWarningLimit: 500,
    },
  },
});
