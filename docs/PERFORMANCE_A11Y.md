# Performance and accessibility audit

## Performance

Benchmark: `node_modules/.bin/vitest run -c scripts/vitest.bench.config.ts --disableConsoleIntercept`
(`scripts/perf-bench.ts`; not part of `pnpm test`). Dataset: 10,000 products, 10,000 orders,
5,000 customers; best of 3 (IndexedDB: single run, fake-indexeddb, so real Chromium differs).

| Operation                           | Before (ms) | After (ms) |
| ----------------------------------- | ----------- | ---------- |
| search products (fuzzy / substring) | 2.7 / 3.1   | same       |
| search orders / customers           | 19.9 / 12.2 | same       |
| universalSearch                     | 18.1        | same       |
| filter products / orders            | 0.8 / 0.1   | same       |
| sort products by name               | 3.7         | 2.4        |
| sort orders by date                 | 21.6        | 4.2        |
| sort customers by name              | 2.9         | 1.1        |
| IDB save products / orders          | 239 / 245   | same       |
| IDB load products / orders          | 70 / 74     | same       |
| KPIs (30d window, all groups)       | 11.2        | same       |
| CSV export (orders, 6 cols)         | 8.0         | same       |
| reorder report                      | 4.5         | same       |

### Findings and fixes

- `sortItems` (utils/listView.ts) called the getter (Date.parse, toLowerCase, template strings)
  about 2 x n log n times. Now decorate-sort-undecorate: once per item. Regression test asserts
  one getter call per item and stability.
- Bulk handlers in `OrdersPage` and `useProductActions` used `array.includes(id)` inside
  `map`/`filter` over the full list (O(n x k)). Replaced with `Set` lookups.
- Everything else measured is under 25 ms at 10k items; no further change warranted.

### Remaining

- `ProductsPage`, `InventoryPage`, `CouponsPage` still do `selectedIds.includes(id)` per rendered
  row. Rows are page-bounded (small), so left alone.
- Order/customer search spreads each match (`{...order, _searchScore}`); fine at 10k, would
  matter at 100k+.
- IndexedDB save of 10k records takes about 240 ms in the fake; real IDB in Chromium is chunked
  and yields between chunks, so UI jank is not expected, but it has not been profiled in the
  packaged app.

## Accessibility

`eslint-plugin-jsx-a11y` (recommended set) is enabled and `eslint src electron` is clean.

### Fixed

- Modal: focus moves into the dialog on open (or stays if a child already autofocused), Tab and
  Shift+Tab cycle inside it, focus returns to the previously focused element on close. Tests in
  `components/__tests__/Modal.test.tsx`.
- Global CSS `input:focus { outline: none; ring: ... }` used the invalid property `ring`, so
  inputs without Tailwind ring classes had no focus indicator. Replaced with a real outline.
- `<th>` without `scope`: 90 column headers now have `scope="col"`.
- `prefers-reduced-motion`: global CSS media query shortens animations/transitions; the order
  celebration confetti uses `disableForReducedMotion`.
- Variation expand/collapse icon button now has `aria-label` and `aria-expanded`.

### Verified OK

- Toasts: `role="alert"`/`aria-live="assertive"` for errors, `role="status"`/polite otherwise,
  with a screen-reader type prefix.
- Sortable headers expose `aria-sort` (`ListViewControls`).
- Modal has `role="dialog"`, `aria-modal`, labelled by title/aria-label, Escape closes.

### Remaining issues

- Contrast: `text-gray-400` on white (about 2.5:1) is used widely for secondary text/icons and
  fails WCAG AA (4.5:1) in light mode. Needs a design pass (gray-500 minimum). Not changed
  blanket-wide to avoid a large visual diff.
- Some `<th>` cells that act as row headers should be `scope="row"`; all were set to `col`.
- Icon-only buttons in POS components (Numpad, POSCart, POSProductGrid, POSScratchpad, POS
  modals) and `OfflineIndicator` were flagged by a heuristic scan but not edited (other work in
  progress there); verify they carry `aria-label`.
- Many modals do not use the shared `Modal` and therefore lack the focus trap (e.g.
  ConfirmDialog, CouponFormModal, BulkEditModal); migrate them to `Modal`.
- Page-level `aria-live` region for async list updates (loading/count changes) is not present.
