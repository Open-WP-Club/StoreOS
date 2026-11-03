# Manual Test Checklist

Features that unit tests cannot fully prove (OS dialogs, printers, real WooCommerce behaviour). Use a
**staging** WooCommerce store (never production) and a packaged build (`pnpm run build:electron`).
Automated coverage of a few of these flows lives in `e2e/` (offline POS sale, offline product
placeholder, refund, CSV import, cross-store copy) against a mock server; real stores still need this list.

"Go offline" = turn off Wi-Fi (or block the store host). "Online" = restore it and wait about 5 s.

## 1. POS offline sales + sync

1. POS: add 2 products, pay by card, go offline, click the finish button.
   Expect: warning toast "saved, will sync"; cart cleared; recent transactions shows the sale as pending; cached stock decreased.
2. Make a second offline sale. Reload the app while still offline.
   Expect: both sales are still pending (offline indicator shows 2 pending).
3. Go online.
   Expect: indicator syncs; each sale becomes exactly one order in WP admin (completed, with `_storeos_client_id` meta); pending flags clear; stock matches on the store.
4. Retry sync twice (indicator "sync") after success.
   Expect: no duplicate orders.
5. Offline, queue a sale, then discard it from the indicator panel.
   Expect: it disappears from recent transactions and never reaches the store.
6. Known issue to verify: while offline the fixed offline badge may cover the "finish" button; confirm it is still clickable.

## 2. Scheduled reports and auto-backup

1. Settings > Scheduled reports: choose a folder (native dialog), set frequency/time a few minutes ahead, enable.
   Expect: the chosen path is shown; at the scheduled time a file (CSV/PDF per setting) appears in the folder; `lastRun` updates; no duplicate on restart in the same slot.
2. Settings > Backup: enable scheduled backup, set a passphrase, choose a folder, run now.
   Expect: an encrypted backup file is written; restoring it with the right passphrase works, a wrong one fails with an error.
3. Restart the app.
   Expect: the passphrase is gone (memory only); the next backup omits credentials and says so.

## 3. Receipt print (80 mm), logo, cash drawer

1. Settings > Printer: pick the thermal printer, enable auto-print and (optional) cash drawer, set the VAT rate.
2. Finish a cash POS sale.
   Expect: an 80 mm receipt prints with store name, items, discount, total, payment, tendered/change, VAT line, order id; special characters in product names are escaped; store logo prints (or is skipped without error when missing).
3. Drawer enabled + cash sale: drawer opens (ESC/POS via CUPS `lp`, untested on hardware). Card sale: drawer stays shut.
4. Printer off or unplugged.
   Expect: warning toast; the sale itself still completes.

## 4. Refund

1. Order detail > Refund. Refund 1 of 2 units of a line with a reason, restock on.
   Expect: dialog total matches; "Refund created" toast; order shows the refund; WP admin has the refund and stock +1.
2. Refund the remaining amount.
   Expect: Refund button disappears (fully refunded). Over-refunding is blocked by the dialog.
3. Go offline and open Refund.
   Expect: it fails with an error and is never queued.

## 5. CSV import

1. Products > Export > Import CSV with a file mixing existing SKUs, new SKUs, an invalid row, and a row starting with `=`.
2. Map columns, click Preview (dry run).
   Expect: counts create/update/unchanged/invalid correct, changes listed, nothing sent to the store yet.
3. Import.
   Expect: progress bar; "Imported N products"; list refreshes; per-item batch errors are reported as "X of N failed".
4. Offline: import rows with SKUs (queued, replays on reconnect); rows without SKU are refused.

## 6. Tracking + note templates

1. Order detail: add carrier + tracking number.
   Expect: saved on the order, link opens the carrier page; customer note/order note created.
2. Notes > Templates: create, edit, apply a template to an order.
3. Orders: select several processing orders > "Mark shipped".
   Expect: status changes, tracking applied, partial failures reported.

## 7. Cross-store copy (category hierarchy)

Need two configured stores; the target lacks the categories.

1. Source store: category Parent > Child, product in Child (also try a variable product and a coupon).
2. Products: select it > Copy to store > choose target > Preview.
   Expect: "N will be created", new categories listed indented (Parent, then Child), warnings for attributes/variations.
3. Copy.
   Expect: target has Parent and Child with correct parent link; the product is in Child; images/prices intact.
4. Copy again with "Skip" then "Update" on SKU collision.
   Expect: skipped vs updated, no duplicates. Repeat for coupons (category restrictions remapped by slug).

## 8. Webhooks and payment gateways

1. Integrations: create a webhook (topic, https URL, secret); invalid URL/topic is rejected.
2. Edit status (pause/active); delete it. Expect: WP admin matches.
3. Gateways list: enable/disable one; expect the change in WP admin.

## 9. Offline queue and placeholders

For each: go offline, perform the action, check the placeholder, go online, check the result and that nothing is duplicated.

| Item                  | Offline action              | Expect while offline            | Expect after sync                |
| --------------------- | --------------------------- | ------------------------------- | -------------------------------- |
| Product               | Clone a product             | "Pending sync" row, queue count | One new product, badge gone      |
| Product update/delete | Edit price / delete         | Queued                          | Applied on the store             |
| Coupon                | Create / edit / delete      | Pending coupon                  | Exists once (matched by code)    |
| Category              | Create, with a child        | Pending items                   | Created once, parent link intact |
| Attribute + terms     | Create attribute, add terms | Pending                         | Created once                     |
| Tax rate / class      | Create                      | Pending                         | Created once                     |
| Variation             | Add to a variable product   | Pending                         | Created once                     |
| Review                | Approve / spam              | Queued                          | Applied                          |

Also: restart while offline (queue and placeholders survive); discard an op (placeholder vanishes); retry a failing op 3 times (marked failed, can be discarded).

## 10. Sorting, columns, saved views

For Orders, Products and Customers:

1. Click column headers.
   Expect: asc/desc toggles with an indicator; sort is stable across pagination.
2. Columns menu: hide/show columns; click outside or press Escape.
   Expect: menu closes, selection persists after reload.
3. Save a view (filters + sort + columns), reset, re-apply it from the filter bar and the command palette.
   Expect: filters, sort and hidden columns all restored.

## 11. Low-stock notifications

1. Set the low-stock threshold in settings; lower a product's stock to exactly the threshold (rule is `<=`).
   Expect: one notification (sound/toast per settings) when it crosses; none again until it recovers above and crosses again.
2. Out-of-stock and unmanaged-stock products behave sensibly.

## 12. Reorder report

1. Inventory > Reorder report.
   Expect: lists low-stock items with suggested quantities; totals correct.
2. Export it (CSV/PDF).
   Expect: file downloads and opens; formula-like text cells are neutralized in CSV.
