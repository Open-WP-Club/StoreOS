# TODO

Отложени задачи от прегледа на 2026-11-02 (партида 1 — low-stock, reorder report, POS офлайн, планирани отчети, дедупликация, тестове — е слята в main; партида 2 — refund, tracking, CSV импорт, saved views, бъг-фиксове, docs — също е слята.

## Функционалности (още не са започнати)
- [x] Refund в поръчката: частичен, по артикули, с ресток (`orders.ts`, `OrderDetailPage.tsx`, `useOfflineMutation`)
- [x] Tracking номер + масово „изпратено“ + шаблони за бележки (`OrderNotesSection`, `BulkActionsBar`)
- [x] Импорт на продукти от CSV с dry-run преглед (`utils/csvImport.ts`, `BulkEditPreview`, `batchErrorIds`)
- [x] Копиране на продукти/купони между магазини (ремап на категории/атрибути е трудната част)
- [x] Сравнение на магазините един до друг (`MultiStoreView`, `useKPIs`)
- [x] POS касова бележка 80mm + отваряне на чекмедже (ESC/POS през IPC)
- [x] Запазени изгледи (сортиране, колони, филтри) + команда в палитрата
- [x] UI за webhooks и платежни методи + автоматичен backup по график

## Дублиране (ако не са влезли в текущата партида)
- [ ] Проверка дали ProductsPage/CustomersPage/TaxRatesTab/VariationsTab викат `service.update*` директно, без `useOfflineMutation`
- [ ] Скан за мъртъв код / неизползвани exports (не е правен)

## Тестове
- [ ] Покритие: `POSCart`, `TaxPage`, `TaxRatesTab`, `deferredInit`, `App`, `themeInit` (0%), `useCouponForm`, `BulkEditForm`, `tax-reviews.ts` — виж какво остава след текущата партида
- [ ] Пусни `pnpm run test:coverage` и сравни; преди това няма базова линия след новите 9 теста

## Бъгове намерени от тестовете (не са поправени)
- [x] `BulkGenerateCouponsModal.handleGenerate` брои `{error}` записите от batch отговора като успешни — ползвай `batchErrorIds`, покажи „X of Y failed“ (тест на клон worktree-agent-a9bc5a7c2ba5a3081 фиксира сегашното поведение; обърни го след поправката)
- [x] `useCouponForm`: валидацията приема само `[A-Z0-9-]`, `.toUpperCase()` след нея е недостижим; провери дали `CouponFormModal` главни буквите при писане
- [x] `TaxRatesTab`: Priority `parseInt(value) || 1` — след изчистване „2“ става 12
- [ ] `ReviewsPage` е на ~49% покритие
- [ ] Модали, които не са мигрирани към `Modal`: BulkEditForm/Preview, CouponFormModal, BulkGenerateCouponsModal, ImageLightbox, ProductsPage/CustomersPage/ActivityLogPage (не са разгледани), QuickSwitcher, CommandPalette, KeyboardShortcutsModal, FilterPresetManager, ConfirmDialog
- [ ] Планирани отчети: редовете на отчета се строят отделно от `useReportExport`/`usePOSDailyReport` (дублиране); ръчен тест в стартирано приложение (IPC, диалог за папка)

## Сигурност
- [x] CSV/formula injection (поправено в main): `escapeCSVValue` в `src/utils/csvExport.ts` не неутрализира низове, започващи с `=`, `+`, `-`, `@`, `\t`, `\r` (потвърдено, няма такава логика). Засяга всички CSV експорти (поръчки, клиенти, reorder report с supplier/name/sku от meta_data). Поправка: за **низови** клетки добави водещ `'` (не пипай числа, за да не се чупят отрицателни стойности) + тест. Прави се на едно място при сливането на `worktree-agent-a56b519100607c6f1` (същият файл).

## Мутации извън `useOfflineMutation` (одит)
- [ ] Подхождат на съществуващи типове: `useProductActions.ts:108,203,234`, `useProductEditForm.ts:194`, `MultiStoreView.tsx:199` (трябва `storeId`); `usePOSCheckout.ts:132` вече е покрит от офлайн POS клона
- [ ] Нужни са нови типове + replay в `OfflineIndicator`: delete/batch на продукти, batch на поръчки/купони, Categories, Tax, Attributes, Reviews, VariationsTab (виж доклада на агента)
- [ ] Мъртъв код от knip (не е трито): `deferredInit.ts` е маркиран unused file, но има тестове — провери; `src/utils/index.ts` barrel, много exports в `constants/config.js`, `stores/index.ts` и `__test_utils__`
- [ ] CLAUDE.md споменава `TaxRatesTab`, а мутациите на данъци са в `TaxPage` — провери
- [ ] Твърдо зададен `'bg-BG'` в `usePOSDailyReport`, `POSRecentTransactionsModal`, `OrderNotesSection`, `POSDailyReportModal` (няма locale helper в i18n)

## Нови от партида 2
- [ ] `pnpm run format:check` пада на ~190 файла (и преди промените) — CI го пуска; пусни `prettier --write` в отделен комит
- [ ] Saved views: няма sort/колони в списъците; Customers пази само търсене и page size; rename ползва `window.prompt`
- [ ] Refund: не минава през useOfflineMutation (двойно възстановяване при replay); `api_refund` е по подразбиране true — добави превключвател
- [ ] CSV импорт и bulk "изпратено" викат batch директно (без офлайн опашка); два модала: `Modal` и `TitledModal` — обедини
- [ ] Ръчен тест в стартирано приложение: POS офлайн, планирани отчети, refund, импорт, tracking

## Документи и зависимости
- [ ] `docs/TESTING.md`: долните секции (списъци компоненти/утилити, `.jsx` примери) още са по старата структура
- [ ] `docs/SECURITY_RELEASE.md`: ред за `scripts/adhocSign.cjs`
- [ ] `pnpm-workspace.yaml`: остарял `minimumReleaseAgeExclude: electron@43.1.1`
- [ ] Минорни ъпдейти: electron 45.2.1, lucide-react 1.66, react-router-dom 7.18.5, @tanstack/react-virtual, @types/node, fake-indexeddb, globals (eslint остава на 9.x, typescript на 6.0.x)
- [ ] `pnpm run format:check` не е пускан
- [ ] Некомитнати от предишния кръг: промени в CLAUDE.md/README/docs/TESTING.md и 2 нови тест файла (`batchResult`, `useOfflineMutation`)

## Остава след партида 3
- [ ] Ръчен тест в стартирано приложение: POS офлайн, планирани отчети и backup, печат на бележка (80mm/чекмедже), refund, импорт, tracking, копиране между магазини, webhooks
- [ ] Офлайн опашка: Categories, Attributes, Tax, Reviews, VariationsTab, `useProductEditForm`, batch delete на поръчки; създаванията (`create_product`, `create_coupon`) не са защитени срещу дубликати при replay
- [ ] Input-ове с `parseInt(v) || default` (SettingsNotifications: low-stock праг и дни) — същият бъг като Priority ("2" става 52)
- [ ] Праг за ниска наличност: `useDashboardStats` брои `<=`, текстът в настройките казва „под“ — изравни
- [ ] Копиране между магазини: без йерархия на категории, без синхрон на вариации при update, related/upsell не се копират; сравнението смесва валути
- [ ] Бележка: VAT 20% е твърдо зададен като включен; без лого
- [ ] ProductsPage inline модал и ImageLightbox не са на `Modal`; ~70 неизползвани exports (knip) са оставени
- [ ] Saved views: sort и колони (няма такива понятия в списъците)
