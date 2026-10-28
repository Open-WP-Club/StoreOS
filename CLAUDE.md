# CLAUDE.md - AI Assistant Guide for StoreOS - Built for WooCommerce

## Project Overview

StoreOS - Built for WooCommerce is an Electron-based desktop application for managing multiple WooCommerce stores. Built with React + TypeScript, it provides a streamlined interface for managing orders, products, inventory, coupons, taxes, customers, and an in-house POS across multiple WooCommerce installations.

**Key Features:**
- Multi-store management from a single interface
- Advanced order management with search and filtering
- Product CRUD operations with bulk editing, variations, attributes, categories
- Real-time inventory tracking
- Point of Sale (POS) mode with cart, checkout, daily reports
- Comprehensive analytics dashboard (sales, orders, products, customers, financial, geographic, KPIs)
- Coupons, tax rates, product reviews, activity log, store health
- Smart caching system with IndexedDB persistence
- Progressive data loading for large datasets
- Offline mutation queue (actions replay when connection returns)
- Global search across multiple data types

## Technology Stack

### Core Technologies
- **Electron 44.x** - Desktop application framework
- **React 19.x** - UI library with hooks (React Compiler enabled via `babel-plugin-react-compiler`)
- **TypeScript 6.x** - Strict mode (see `tsconfig.json` gotchas below)
- **electron-vite 6.x (beta)** - Build tool/dev server for main, preload, and renderer processes
- **Zustand 5.x** - Lightweight state management with persistence, split into domain stores
- **Tailwind CSS 4.x** - Utility-first styling framework
- **React Router 7.x** - Client-side routing

### Key Dependencies
- **@woocommerce/woocommerce-rest-api** - Official WooCommerce REST API wrapper
- **Axios** - HTTP client for API requests
- **Chart.js** / **react-chartjs-2** - Data visualization
- **Lucide React** - Icon library
- **jsPDF** / **jspdf-autotable** - PDF export
- **DOMPurify** - HTML sanitization (ships its own TS types — do not add `@types/dompurify`)
- **immer** - Immutable state updates
- **IndexedDB** - Browser-based persistent storage

### Development & Testing Tools
- **Vitest 4.x** - Test runner (`jsdom` environment), **not Jest** — 97 test files, ~1,777 tests
- **@testing-library/react** + **jest-dom** matchers + **user-event**
- **ESLint 9.x** - Flat config (`eslint.config.js`, not `.eslintrc.json`), includes `eslint-plugin-react-compiler`
- **Prettier** - Code formatting
- **typescript-eslint 8.x** - blocks bumping `typescript` past `<6.1.0` (peer dep constraint); separately, `eslint-plugin-react`'s peer range (`^9.7`) blocks bumping `eslint` past 9.x — check before upgrading either

## Codebase Structure

```
StoreOS/
├── electron/
│   ├── main.js               # Electron main process entry point
│   └── preload.js            # Preload script (contextBridge API)
├── src/
│   ├── components/           # ~50 reusable React components (.tsx), incl. subfolders:
│   │   ├── analytics/        # AnalyticsRevenueCards, AnalyticsTopProducts
│   │   ├── dashboard/        # DashboardTodayPerformance, DashboardTopProducts, DashboardWeeklyStats
│   │   ├── settings/         # SettingsLanguage, SettingsPrinter, SettingsNotifications, SettingsSecurity, SettingsBackup
│   │   ├── DataManager.tsx   # Headless global data-fetch manager (mounted once at App root)
│   │   ├── Layout.tsx        # Main layout with navigation + ErrorBoundary per route
│   │   ├── QuickSwitcher.tsx / CommandPalette.tsx  # Keyboard-driven navigation
│   │   ├── POSCart.tsx, POSProductGrid.tsx, POSDailyReportModal.tsx, ...  # POS mode
│   │   └── __tests__/        # Component tests
│   ├── pages/                 # 25 route-level page components (.tsx)
│   │   ├── Dashboard.tsx, OrdersPage.tsx, ProductsPage.tsx, InventoryPage.tsx, POSPage.tsx
│   │   ├── CouponsPage.tsx, TaxPage.tsx, ReviewsPage.tsx, CustomersPage.tsx
│   │   ├── AttributesPage.tsx, CategoriesPage.tsx, ActivityLogPage.tsx, StoreHealthPage.tsx
│   │   ├── AnalyticsPage.tsx, SalesAnalyticsPage.tsx, OrderAnalyticsPage.tsx,
│   │   │   ProductAnalyticsPage.tsx, CustomerAnalyticsPage.tsx, FinancialAnalyticsPage.tsx,
│   │   │   GeographicAnalyticsPage.tsx, KPIDashboardPage.tsx
│   │   └── SetupPage.tsx, MultiStoreView.tsx, OrderDetailPage.tsx, ProductEditPage.tsx
│   ├── services/woocommerce/  # WooCommerceService — split by resource (see Service Layer below)
│   │   ├── base.ts, orders.ts, products.ts, customers.ts, coupons.ts, tax-reviews.ts, index.ts
│   ├── stores/                 # Zustand — split into 9 domain stores (see State Management below)
│   │   ├── storeConfigStore.ts, themeStore.ts, settingsStore.ts, searchStore.ts, cacheStore.ts,
│   │   │   appSettingsStore.ts, offlineStore.ts, notificationStore.ts, activityLogStore.ts, posStore.ts
│   │   ├── storeUtils.ts     # Shared helpers: prependAndTrim<T>(), nowMs(), nowISO()
│   │   └── index.ts          # Barrel export + convenience hooks
│   ├── hooks/                 # useProgressiveLoading, useOfflineMutation, useCouponForm, usePOS*, ...
│   ├── contexts/ToastContext.tsx
│   ├── utils/
│   │   ├── indexedDBCache.ts, csvExport.ts, pdfExport.ts, currency.ts, dateTime.ts, i18n.ts
│   │   ├── kpiCalculator.ts, memoryMonitor.ts, backup.ts, startupMetrics.ts
│   │   └── search/            # searchService.ts re-exports from here: fuzzy, orders, products, customers, utils
│   ├── types/                  # Domain-split TS types (11 files): orders, products, customers, coupons, tax,
│   │   │                        cache, activity, analytics, offline, store, ui, common, api, global.d.ts
│   │   └── index.ts            # Barrel re-export
│   ├── constants/config.js    # TIME, CACHE_EXPIRY, INVENTORY, PAGINATION, SEARCH, API, UI thresholds
│   ├── App.tsx, main.tsx, index.css
│   └── __test_utils__/        # Shared test fixtures/mock factories
├── electron.vite.config.ts    # Main/preload/renderer build config + path aliases + manualChunks
├── vitest.config.ts / vitest.setup.ts
├── eslint.config.js           # Flat config
├── tsconfig.json              # Strict TS incl. noUncheckedIndexedAccess (see gotcha below)
└── package.json
```

**Path aliases** (defined in both `tsconfig.json` and `electron.vite.config.ts`/`vitest.config.ts` — keep them in sync if you add one):
`@/*`, `@components/*`, `@pages/*`, `@stores/*`, `@hooks/*`, `@utils/*`, `@services/*`, `@constants/*`

## Key Architectural Patterns

### 1. State Management Architecture

Zustand state is **split into 9 domain stores** (not one monolithic store). Each has its own file in `src/stores/` and is exported from `src/stores/index.ts`:

| Store | Responsibility |
|---|---|
| `useStoreConfig` | Configured WooCommerce stores, `currentStoreId`, add/update/remove/select |
| `useTheme` | `light`/`dark` theme |
| `useSettings` | Auto-refresh config, dynamic `refreshOrders`/`refreshProducts`/`refreshAll` callbacks |
| `useSearch` | Recent searches, saved filter presets |
| `useCache` | In-memory + IndexedDB cache for products/orders/customers/coupons |
| `useAppSettings` | Low-stock threshold, order-split-days, and other configurable business thresholds |
| `useOffline` | Offline mutation queue (see `useOfflineMutation` hook) |
| `useNotifications` | Notification center, sound/confetti toggles, order-celebration overlay |
| `useActivityLog` | User activity log |
| `posStore` (separate module) | POS cart/checkout state — imported directly, not via `src/stores` barrel |

Always use the individual hooks (the old combined `useStore()` shim was removed).

```typescript
// Preferred (current) pattern
import { useCache, useStoreConfig } from '../stores';

const currentStore = useStoreConfig((state) => state.getCurrentStore());
const orders = useCache((state) => state.cache.orders?.data);
```

#### Persistence Strategy
- **localStorage**: Store configurations, theme, searches, filter presets, settings (via Zustand `persist`)
- **IndexedDB**: Large datasets (products, orders, customers, coupons) for offline capability and performance

### 2. Data Caching Strategy

Cache expiry times live in `src/constants/config.js` (`CACHE_EXPIRY`) — this is the source of truth, not hardcoded numbers scattered in components:

```javascript
PRODUCTS_RECENT: 30 min   PRODUCTS_OLD: 7 days   (modified < / >= 7 days ago)
ORDERS_RECENT: 15 min     ORDERS_COMPLETED: 180 days
CUSTOMERS: 1 hour         COUPONS: 2 hours       DEFAULT: 30 min
```

#### Cache Tiers
1. **In-Memory Cache (`useCache` store)**: Fastest access, cleared on reload
2. **IndexedDB Cache**: Persistent, survives reloads (`src/utils/indexedDBCache.ts`)
3. **API Fetch**: Last resort when cache is invalid/expired

Orders and products are each split into recent/old buckets so hot data stays fresh (short TTL) while historical data is cached aggressively (long TTL), dramatically cutting API calls. See `src/stores/cacheStore.ts` for the actual freshness-check logic per resource.

### 3. DataManager — Global Headless Fetcher

`DataManager` (`src/components/DataManager.tsx`) is **not** a per-page wrapper anymore. It's a headless component (`function DataManager(): null`) mounted **once at the App root** that never unmounts. It owns all background fetching/refresh/notification logic centrally, so navigating between pages doesn't interrupt or restart loads.

Pages do **not** pass `dataType`/`onDataLoaded` props to it. Instead, pages read data directly from the relevant store and trigger fetches themselves:

```typescript
// Actual current pattern (e.g. OrdersPage.tsx)
import { useStoreConfig, useCache, useSettings } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';

const currentStore = useStoreConfig((state) => state.getCurrentStore)();
const ordersFromCache = useCache((state) => state.cache.orders?.data ?? EMPTY_ORDERS);
```

### 4. Progressive Loading Pattern

```typescript
// src/hooks/useProgressiveLoading.ts
const { data, loading, progress, hasMore } = useProgressiveLoading({
  dataType: 'products',
  batchSize: 50,
  batchDelay: 500,
});
```

Benefits: immediate first-batch UI feedback, no UI freeze on large datasets, cancellable loads, progress indication.

### 5. Service Layer Pattern

`WooCommerceService` (`src/services/woocommerce/index.ts`) is composed via **class inheritance across resource-specific modules** — the public import path is unchanged (`import WooCommerceService from '../services/woocommerce'`), but the implementation is split:

```
base.ts        — constructor, API client init, shared helpers
orders.ts      — orders + order notes
products.ts    — products, batch ops, inventory, variations, categories, attributes
customers.ts   — customers
coupons.ts     — coupons
tax-reviews.ts — tax rates/classes + product reviews
```

```typescript
const service = new WooCommerceService(store); // store: { url, consumerKey, consumerSecret }

// All methods return { success, data, error } (ApiResponse<T> discriminated union)
const result = await service.getOrders({ status: 'processing' });
if (result.success) {
  // result.data is typed
} else {
  // result.error is typed
}
```

**Key Methods:** `getAllOrders()` / `getAllProducts()` (auto-pagination), `getProductsSince(lastSync)` (delta sync), `batchUpdateProducts()`, progressive loading via `onBatchLoaded` callback.

## API Integration Patterns

### Standard API Call Pattern

```typescript
const currentStore = useStoreConfig((state) => state.getCurrentStore());
const service = new WooCommerceService(currentStore);

const result = await service.getOrders({ status: 'processing' });
if (result.success) {
  setOrders(result.data);
} else {
  showToast(result.error, 'error');
}
```

### Offline Mutation Pattern

Mutations (status updates, stock updates, coupon create/update/delete) go through `useOfflineMutation` so they queue automatically when offline and replay on reconnect:

```typescript
import { useOfflineMutation } from '../hooks/useOfflineMutation';

const { mutate } = useOfflineMutation();
await mutate({
  type: 'updateOrderStatus',
  execute: () => service.updateOrder(orderId, { status: newStatus }),
  // ...
});
```

### Delta Sync Pattern (Products Only)

```typescript
const lastSync = cache.products.lastSync; // ISO8601 timestamp
if (lastSync) {
  const result = await service.getProductsSince(lastSync, { per_page: 50 });
  // merge with existing cache
}
```

## Development Workflows

### Development Mode

```bash
pnpm run dev   # electron-vite dev — starts Vite + Electron with hot-reload, opens DevTools
```

### Building

```bash
pnpm run build            # electron-vite build (renderer + main + preload only)
pnpm run build:electron   # build + electron-builder → distributable in dist-electron/ + release/
```

### Testing

```bash
pnpm run test             # vitest run — full suite (97 files, ~1,777 tests)
pnpm run test:watch       # vitest (watch mode)
pnpm run test:coverage    # vitest run --coverage (v8 provider)
```

Coverage thresholds (see `vitest.config.ts`): branches 25%, functions 30%, lines 35%, statements 35%.

### Code Quality

```bash
pnpm run lint             # eslint src electron --ext .js,.jsx,.ts,.tsx
pnpm run lint:fix
pnpm run format           # prettier --write
pnpm run format:check
pnpm run typecheck        # tsc --noEmit
pnpm run typecheck:watch
```

## Code Conventions

### ESLint Configuration

Flat config (`eslint.config.js`), ESLint 9.x — **not** `.eslintrc.json`. Includes `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `typescript-eslint`, and `eslint-plugin-react-compiler` (warns when React Compiler has to skip optimizing a component due to disabled React rules).

**Do not bump `eslint` past `9.x` or `typescript` past `6.0.x`** — `typescript-eslint@8.65.0`'s peer range is `typescript: '>=4.8.4 <6.1.0'`; a TS7 or ESLint 10 bump breaks lint parsing until `typescript-eslint` ships v9.

### TypeScript Gotchas

`tsconfig.json` has `"noUncheckedIndexedAccess": true` — any array/object index access (`arr[i]`, `obj[key]`) is typed as possibly `undefined`, even when you "know" it's safe. Expect to add explicit checks or non-null assertions at index-access sites; this is the #1 source of new type errors when writing tests against array data.

### Prettier Configuration

```json
{ "semi": true, "singleQuote": true, "tabWidth": 2, "trailingComma": "es5", "printWidth": 100, "arrowParens": "always", "endOfLine": "lf" }
```

### Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `OrdersPage.tsx`)
- Utilities/services: `camelCase.ts`
- Hooks: `use*.ts` prefix
- Tests: colocated in `__tests__/` next to the code, `*.test.ts(x)`

**Components:** `PascalCase` names, `camelCase` props, `handle*` event handlers, `is*`/`has*`/`should*` boolean props.

**Variables:** `camelCase`; `UPPER_SNAKE_CASE` for constants (see `src/constants/config.js`).

### Import Order Convention

```typescript
// 1. External dependencies
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Internal utilities/services/stores
import WooCommerceService from '../services/woocommerce';
import { useCache, useStoreConfig } from '../stores';

// 3. Components
import Layout from '../components/Layout';

// 4. Types (import type)
import type { Order } from '../types';
```

## Git Workflow

**Reality, not aspiration:** this repo does **not** use feature branches or PRs day-to-day — work is committed directly to `master`. Commit messages are short and often informal (`wip`, `update`, `Update ci.yml`) rather than strictly imperative-mood/descriptive; don't assume every commit follows a strict convention. When asked to create a PR/branch, follow the user's explicit instructions for that session rather than inferring a house style from history.

## Component Patterns

### Page Component Pattern

```typescript
import { useStoreConfig, useCache } from '../stores';
import WooCommerceService from '../services/woocommerce';
import Layout from '../components/Layout';

function MyPage(): React.ReactElement {
  const currentStore = useStoreConfig((state) => state.getCurrentStore());
  const data = useCache((state) => state.cache.products.data ?? []);

  return <Layout>{/* ... */}</Layout>;
}

export default MyPage;
```

`DataManager` doesn't need to be rendered per-page — it's already mounted once in `App.tsx`. New pages just read from the relevant store and, if they need to force a refresh, call the store's fetch/refresh action or `WooCommerceService` directly (see `useProgressiveLoading` / `useOfflineMutation` for the established patterns).

### Search Pattern

```typescript
import { searchOrders, applyOrderFilters } from '../utils/searchService'; // re-exports src/utils/search/*
```

### Toast Notifications

```typescript
import { useToast } from '../hooks/useToast'; // or contexts/ToastContext for the app-wide provider

const { showToast } = useToast();
showToast('Order updated successfully', 'success');
```

## Common Patterns & Best Practices

1. **Always check for a store before API calls** — `if (!currentStore) return <EmptyState .../>;`
2. **Use individual store hooks with selectors** for fewer re-renders — `useCache(state => state.cache.products.data)`.
3. **Route mutations through `useOfflineMutation`** rather than calling `service.update*` directly, so they survive offline periods.
4. **Progressive loading for 100+ item datasets** — `useProgressiveLoading`.
5. **Error handling** — always branch on `result.success`, show a toast, never let a rejected promise reach the UI unhandled.
6. **Optimistic updates** — update local state immediately, revert on `!result.success`.
7. **Dark mode** — every new component needs `dark:` Tailwind variants.
8. **Memoize expensive derived data** with `useMemo`/`useCallback`; the app also runs React Compiler, which auto-memoizes when ESLint's react-hooks rules are satisfied (see the `react-compiler/react-compiler` lint warning if it can't).

## Troubleshooting Guide

#### Orders/Products Not Loading
1. Check browser/DevTools console for errors.
2. Verify store is configured: `useStoreConfig.getState().getCurrentStore()`.
3. Check cache state: `useCache.getState().cache`.
4. Clear cache via the "Quick Sync" button or `useCache.getState().clearCache()`.
5. Verify API credentials.

#### Cache Not Updating After Changes
Call `useCache.getState().clearCacheForType('products')` after a mutation if you're not already going through `useOfflineMutation` (which handles this).

#### IndexedDB Corruption
DevTools → Application → IndexedDB → delete the `woocommerce-cache` database → refresh.

#### Infinite Update Loops
Usually a Zustand selector called during render that creates a new object/array each time. Use `useShallow` (re-exported from `src/stores`) for array/object selectors, or move the update into `useEffect`.

#### Search Not Working
Verify field names match the data shape (e.g. `billing.email`, not `email`) and that `src/utils/search/*` has a handler for the data type in question.

## Testing Guidelines

The project has a full **Vitest** suite (97 files, ~1,777 tests) — this is not a "manual testing only" project. Key points:

- `clearMocks: true` in `vitest.config.ts` — mock implementations reset between tests automatically.
- Set up mocks in `beforeEach()`, not inside `vi.mock()` factories.
- `jsdom` test environment; Chart.js and `react-chartjs-2` are aliased to hand-written mocks in `__mocks__/`.
- Shared fixtures/mock factories live in `src/__test_utils__/`.
- Run `pnpm run typecheck` separately from tests — Vitest does not type-check by default, so a passing test suite doesn't guarantee no type errors (test files currently have some pre-existing `noUncheckedIndexedAccess`-driven errors; check before assuming a clean baseline).

### Before Committing
1. Run `pnpm run test`, `pnpm run lint`, `pnpm run typecheck`.
2. Check UI in both light and dark mode.
3. Test edge cases: empty data, large datasets, API errors, offline.
4. Test with multiple configured stores if the change touches store selection.

## Security Considerations

- Store credentials (WooCommerce consumer key/secret) are persisted via Zustand `persist` to localStorage — never log them, never commit real ones to fixtures/scratch files (a real key pair leaked into `temp.txt` git history once — always use fake `cs_test`/`ck_test`-style values in tests and scratch files).
- All API communication uses HTTPS; the WooCommerce REST API (not admin passwords) is the auth mechanism.
- Sanitize any HTML rendered from API/user data with DOMPurify (see `VisualEditor.tsx`) — React escapes text content by default but `dangerouslySetInnerHTML` needs it.

## Extension Points

### Adding New WooCommerce Resource Support
1. Add methods to the relevant module in `src/services/woocommerce/` (or a new module, wired into the inheritance chain in `index.ts`).
2. Add types in `src/types/` (new domain file or extend an existing one), re-exported from `src/types/index.ts`.
3. Add a cache slot in `useCache` (`src/stores/cacheStore.ts`) and an expiry entry in `CACHE_EXPIRY` (`src/constants/config.js`).
4. Add an IndexedDB object store in `src/utils/indexedDBCache.ts` if it needs offline persistence.

### Adding New Pages
1. Create the page component in `src/pages/`.
2. Add the route in `src/App.tsx`.
3. Add a navigation link in `src/components/Layout.tsx`.
4. Add a corresponding test in `src/pages/__tests__/`.

## Resources & Documentation

- [WooCommerce REST API Docs](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [electron-vite Documentation](https://electron-vite.org/)
- [React Documentation](https://react.dev/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Vitest Documentation](https://vitest.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Quick Reference Commands

```bash
pnpm run dev              # Dev server + Electron (hot-reload, DevTools)
pnpm run build             # Build renderer + main + preload
pnpm run build:electron    # Build + package with electron-builder
pnpm run test               # Run full Vitest suite
pnpm run test:coverage      # Run with coverage report
pnpm run lint / lint:fix
pnpm run format / format:check
pnpm run typecheck / typecheck:watch
pnpm run restart            # Custom restart script (restart-app.js)
```

## Key Files to Know

- **`src/stores/index.ts`** — barrel export + convenience hooks; start here to see all state
- **`src/stores/cacheStore.ts`** — cache freshness/expiry logic per resource
- **`src/services/woocommerce/index.ts`** — entry point into the split service layer
- **`src/components/DataManager.tsx`** — global headless data-fetch manager (mounted once in `App.tsx`)
- **`src/components/Layout.tsx`** — main layout, navigation, per-route ErrorBoundary
- **`src/constants/config.js`** — all magic numbers (cache TTLs, thresholds, delays)
- **`electron/main.js`** / **`electron/preload.js`** — Electron process code
- **`electron.vite.config.ts`** — build config, path aliases, chunk splitting

## AI Assistant Guidelines

1. Check whether an existing individual store hook or `WooCommerceService` method already covers what you're about to write before adding new state or API logic.
2. Use Zustand selectors (`useCache(state => ...)`), not the whole store, to avoid unnecessary re-renders.
3. Follow the existing caching strategy (`CACHE_EXPIRY` constants) — don't hardcode new TTLs inline.
4. Remember `noUncheckedIndexedAccess` — index access needs guards.
5. Run `pnpm run test`, `lint`, and `typecheck` before considering a change done.
6. Check both light and dark mode for UI changes.
7. This repo commits directly to `master` by default — don't assume a branch/PR workflow unless told to use one for the session.
8. Never put real API credentials in test fixtures, scratch files, or commits — use obviously-fake values.
9. Consider performance — this is a data-heavy application (order/product lists can be 1000+ items).

---

This documentation is maintained by AI assistants working on the StoreOS - Built for WooCommerce project. Keep it updated as the codebase evolves — press `#` mid-session to have Claude fold a learning in directly.
