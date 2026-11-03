# TODO

Всичко останало от партиди 1–6 е слято в main. Остава:

- [ ] Ръчен тест в стартирано приложение: POS офлайн, планирани отчети и backup, печат на бележка (80mm/чекмедже/лого), refund, импорт, tracking, копиране между магазини, webhooks, нови офлайн опашки
- [ ] Офлайн: update/delete на нещо, създадено офлайн, е невъзможно до синхрон (трябват оптимистични placeholder-и в кеша); VariationsTab „Generate all“ иска връзка
- [ ] Копиране между магазини: връзки към продукти, създавани в същото копиране, не се мапват; `related_ids` е read-only в API
- [ ] QuickSwitcher и CommandPalette не са на `Modal` (top-aligned layout)
- [ ] Помощни функции, ползвани само от тестове (`dateTime`, `i18n`, `currency`, `batchResult`, `indexedDBCache`, `search/utils`); `deferredInit.ts` е маркиран unused, но има тестове
- [ ] Saved views: sort и колони — първо трябва списъците Orders/Products да имат сортиране и избор на колони
