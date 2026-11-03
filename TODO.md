# TODO

- [ ] Ръчен тест по `docs/MANUAL_TEST.md` (печат/чекмедже/лого, планирани отчети и backup, webhooks, tracking, сортиране/запазени изгледи, POS отстъпки/разделено плащане, баркод скенер и броене, конфликти при синхрон, профил на клиент, обновяване). Автоматизирани са само 5 e2e сценария (`e2e/offlineSync.e2e.ts`, `e2e/ordersProducts.e2e.ts`)
- [ ] Възможен бъг: офлайн значката (`OfflineIndicator`, долу вдясно) покрива бутона „Завърши“ в POS и прихваща клика
- [ ] Автообновяване: на macOS работи само с подписани и нотаризирани билдове; кодът в главния процес няма тестове
- [ ] Достъпност: икони-бутони в POS/OfflineIndicator без проверка за `aria-label`, ConfirmDialog/CouponFormModal/BulkEditModal без focus trap — виж `docs/PERFORMANCE_A11Y.md`
- [ ] POS: лимитът на отстъпка (50%) е константа; скенерът не намира вариации (не са в кеша)
- [ ] Конфликти: tax classes нямат update в WooCommerce REST API (само list/create/delete), затова няма какво да се проверява; `batch_variations` е умишлено само API (няма UI повикващ — „Generate all“ работи само онлайн). Batch create се пази от дубликати по SKU/код, не по конфликт
- [ ] Клиенти: тагове/бележки не се синхронизират към WooCommerce; дубликатите се сравняват само по точно име
- [ ] Плейсхолдъри: ревюта нямат (няма офлайн create_review — ревюта не се създават от приложението). Поръчките (POS продажби) и `update_stock` на плейсхолдър са готови
- [ ] VariationsTab „Generate all“ иска връзка; `related_ids` е read-only в API
