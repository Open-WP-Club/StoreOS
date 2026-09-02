# TODO

Live roadmap, known issues, and package upgrade blockers. Referenced from `CLAUDE.md`.

## 🔵 Пакети за следене (packages to watch)

- **`typescript-eslint@8.69.0`** pins `typescript` to `>=4.8.4 <6.1.0`. Currently on `typescript@6.0.3` — do **not** bump to TS 6.1+ until `typescript-eslint` ships a release supporting it, or `tsc`/lint parsing breaks.
- **`eslint-plugin-react@7.37.5`** pins `eslint` to `^9.7` — separate blocker from the one above. Do **not** bump `eslint` to 10.x until `eslint-plugin-react` ships a release supporting it (typescript-eslint itself already supports eslint ^10, so this plugin is the actual holdout).
- **`electron-vite@6.0.0-beta.1`** — still beta; watch for a stable 6.0.0 release and re-pin.

## Known issues

- None currently tracked. Add entries here as they're found (bug + repro + owner/date), don't let this file go stale again.

## Roadmap / planned improvements

- [x] Sanitize `ProductsPage.tsx` product-description `dangerouslySetInnerHTML` with DOMPurify (2026-09-02).
- [x] ~~Virtualize large Orders/Products lists~~ — checked 2026-09-02: both pages already client-side paginate (max 200 rows/page via `Pagination.tsx`), so DOM never holds more than that. Not needed.
- [x] Wire up `electron-updater` for in-app auto-update instead of manual reinstall (2026-09-02).
- [x] Bump `electron` 43 → 44 (2026-09-02). Verified: typecheck, lint, `pnpm run build`, and full test suite all pass. Not verified: actual GUI launch (no display in the environment this was done in) — smoke-test the packaged app before shipping a release.
- [x] Removed unused direct `axios` dependency (2026-09-02) — was never imported directly, only pulled in transitively via `@woocommerce/woocommerce-rest-api`.
- [x] Split the largest files (2026-09-02):
  - `BulkEditModal.tsx` (867 → 350 lines) → `BulkEditPreview.tsx` (153), `BulkEditForm.tsx` (527)
  - `TaxPage.tsx` (761 → 348 lines) → `TaxRatesTab.tsx` (345), `TaxClassesTab.tsx` (169)
  - `OrdersPage.tsx` (739 → 533 lines) → `OrdersAdvancedFilters.tsx` (164), `OrdersTable.tsx` (101)
  - `POSPage.tsx` (723 → 405 lines) → `POSShortcutsPanel.tsx`, `POSScratchpad.tsx`, `POSCustomerSearchModal.tsx`, `POSRefundConfirmModal.tsx`, `POSVariantPickerModal.tsx`
  - `cacheStore.ts` (697 → 191 lines) → `cache/productsSlice.ts`, `cache/ordersSlice.ts`, `cache/customersSlice.ts`, `cache/couponsSlice.ts`, `cache/types.ts` (Zustand slices pattern)
  - All pure JSX/logic extraction, no behavior changes. typecheck, lint, full test suite (97 files / 1777 tests), and `pnpm run build` all verified green.
