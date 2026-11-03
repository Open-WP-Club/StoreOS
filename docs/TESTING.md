# Testing Guide for StoreOS - Built for WooCommerce

Tests run on **Vitest 5** (`jsdom` environment) with React Testing Library. This is not Jest: use `vi`, not `jest`.

## Running Tests

```bash
pnpm run test             # full suite (vitest run)
pnpm run test:watch       # watch mode
pnpm run test:coverage    # v8 coverage (text + html + lcov in coverage/)
pnpm exec vitest run src/utils/__tests__/currency.test.js   # one file
pnpm exec vitest run -t "should render"                      # by test name
pnpm run test:e2e         # Playwright against the packaged app (macOS arm64; run `pnpm run e2e:build` first)
```

Vitest does not type-check. Run `pnpm run typecheck` and `pnpm run lint` separately.

Manual checks for features the automated tests cannot cover (printers, OS dialogs, real stores): see [MANUAL_TEST.md](MANUAL_TEST.md).

## Configuration

`vitest.config.ts` + `vitest.setup.ts` (localStorage/IndexedDB/matchMedia style mocks):

- `include`: `**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)` and `**/*.(test|spec).(js|jsx|ts|tsx)`
- `clearMocks: true` (mock calls reset between tests); set implementations in `beforeEach`, not in `vi.mock()` factories
- `chart.js` and `react-chartjs-2` are aliased to `__mocks__/chartjs.js` and `__mocks__/react-chartjs-2.js`
- Path aliases (`@/`, `@components/`, ...) match `tsconfig.json`
- Coverage thresholds: branches 25%, functions 30%, lines 35%, statements 35%
- `testTimeout`: 10s

## Test Structure

Tests are colocated in a `__tests__/` folder next to the code. Files are `.ts`/`.tsx` for new code; some older ones are `.js`/`.jsx`.

```
src/components/__tests__/   components (Toast, Pagination, PinLockScreen, DataManager, Layout, ...)
src/pages/__tests__/        route pages (OrdersPage, ProductsPage, POSPage, *AnalyticsPage, ...)
src/hooks/__tests__/        hooks (useProgressiveLoading, usePOS*, useProduct*, useKPIs, ...)
src/stores/__tests__/       Zustand stores (cacheStore, storeConfigStore, posStore, offlineStore, ...)
src/services/__tests__/     WooCommerceService (woocommerce*.test.*)
src/utils/__tests__/        utilities (currency, dateTime, csvExport, searchService, indexedDBCache, ...)
src/contexts/__tests__/     ToastContext
electron/__tests__/         main-process helpers (ipcValidation, reportFiles)
e2e/                        Playwright specs (*.e2e.ts), not part of `pnpm run test`
```

Shared helpers live in `src/__test_utils__/` (`mockFactories.ts`, `setupStoreMocks.ts`, `renderWithRouter.tsx`). Check there before writing new fixtures.

## Writing Tests

Use fake credentials only (`ck_test` / `cs_test`). Remember `noUncheckedIndexedAccess`: array/object index access in tests needs a guard or `!`.

### Utility

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../currency';

describe('formatCurrency', () => {
  it('formats with the currency symbol', () => {
    expect(formatCurrency(10, '$')).toContain('10');
  });
});
```

### Component

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('handles clicks', async () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);
    await userEvent.setup().click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

For components that use routing, render with `renderWithRouter` from `src/__test_utils__`.

### Hook

```typescript
import { renderHook, act } from '@testing-library/react';
import useMyHook from '../useMyHook';

it('updates state', () => {
  const { result } = renderHook(() => useMyHook());
  act(() => result.current.setValue(2));
  expect(result.current.value).toBe(2);
});
```

### Service

Mock the HTTP layer with `vi.mock`, then assert on the `{ success, data, error }` result. See `src/services/__tests__/woocommerce.test.ts` for the established setup.

### Async, mocks and timers

```typescript
await screen.findByText('Loaded');                                  // or: await waitFor(() => expect(...))
const fn = vi.fn().mockResolvedValue({ success: true, data: [] });
vi.mock('../api', () => ({ fetchData: vi.fn() }));                  // set return values in beforeEach
vi.useFakeTimers(); vi.advanceTimersByTime(1000); vi.useRealTimers();
```

IndexedDB code can use `fake-indexeddb` (see `indexedDBCache.fake.test.ts`).

## Best Practices

1. Test behavior, not implementation; prefer `getByRole` / `getByLabelText` over test ids.
2. Name tests after the expected behavior; keep them independent (AAA).
3. Mock external dependencies (API, timers, Electron `window.electronAPI`); never hit the network.
4. Cover error, empty and offline cases, not just the happy path.
5. Wrap state updates in `act` / use `findBy*` and `waitFor` if you see "not wrapped in act(...)".

## Continuous Integration

- `.github/workflows/ci.yml` (push and PR): lint, format check, tests with coverage, build.
- `.github/workflows/release.yml` (tag `v*`): tests, build for Windows/Linux/macOS, GitHub release with artifacts.

To release: `pnpm version patch|minor|major`, then `git push origin --tags`. See `docs/SECURITY_RELEASE.md` for signing and hardening.

## Resources

- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
