# TODO

Отложени задачи от прегледа на 2026-11-02 (текущата партида агенти покрива: low-stock известия, отчет за презареждане, POS офлайн продажби, планирани отчети, дедупликация 1-6, тестове за пропуските).

## Функционалности (още не са започнати)
- [ ] Refund в поръчката: частичен, по артикули, с ресток (`orders.ts`, `OrderDetailPage.tsx`, `useOfflineMutation`)
- [ ] Tracking номер + масово „изпратено“ + шаблони за бележки (`OrderNotesSection`, `BulkActionsBar`)
- [ ] Импорт на продукти от CSV с dry-run преглед (`utils/csvImport.ts`, `BulkEditPreview`, `batchErrorIds`)
- [ ] Копиране на продукти/купони между магазини (ремап на категории/атрибути е трудната част)
- [ ] Сравнение на магазините един до друг (`MultiStoreView`, `useKPIs`)
- [ ] POS касова бележка 80mm + отваряне на чекмедже (ESC/POS през IPC)
- [ ] Запазени изгледи (сортиране, колони, филтри) + команда в палитрата
- [ ] UI за webhooks и платежни методи + автоматичен backup по график

## Дублиране (ако не са влезли в текущата партида)
- [ ] Проверка дали ProductsPage/CustomersPage/TaxRatesTab/VariationsTab викат `service.update*` директно, без `useOfflineMutation`
- [ ] Скан за мъртъв код / неизползвани exports (не е правен)

## Тестове
- [ ] Покритие: `POSCart`, `TaxPage`, `TaxRatesTab`, `deferredInit`, `App`, `themeInit` (0%), `useCouponForm`, `BulkEditForm`, `tax-reviews.ts` — виж какво остава след текущата партида
- [ ] Пусни `pnpm run test:coverage` и сравни; преди това няма базова линия след новите 9 теста

## Бъгове намерени от тестовете (не са поправени)
- [ ] `BulkGenerateCouponsModal.handleGenerate` брои `{error}` записите от batch отговора като успешни — ползвай `batchErrorIds`, покажи „X of Y failed“ (тест на клон worktree-agent-a9bc5a7c2ba5a3081 фиксира сегашното поведение; обърни го след поправката)
- [ ] `useCouponForm`: валидацията приема само `[A-Z0-9-]`, `.toUpperCase()` след нея е недостижим; провери дали `CouponFormModal` главни буквите при писане
- [ ] `TaxRatesTab`: Priority `parseInt(value) || 1` — след изчистване „2“ става 12
- [ ] `ReviewsPage` е на ~49% покритие
- [ ] Модали, които не са мигрирани към `Modal`: BulkEditForm/Preview, CouponFormModal, BulkGenerateCouponsModal, ImageLightbox, ProductsPage/CustomersPage/ActivityLogPage (не са разгледани), QuickSwitcher, CommandPalette, KeyboardShortcutsModal, FilterPresetManager, ConfirmDialog
- [ ] Планирани отчети: редовете на отчета се строят отделно от `useReportExport`/`usePOSDailyReport` (дублиране); ръчен тест в стартирано приложение (IPC, диалог за папка)

## Сигурност
- [ ] CSV/formula injection: `escapeCSVValue` в `src/utils/csvExport.ts` не неутрализира низове, започващи с `=`, `+`, `-`, `@`, `\t`, `\r` (потвърдено, няма такава логика). Засяга всички CSV експорти (поръчки, клиенти, reorder report с supplier/name/sku от meta_data). Поправка: за **низови** клетки добави водещ `'` (не пипай числа, за да не се чупят отрицателни стойности) + тест. Прави се на едно място при сливането на `worktree-agent-a56b519100607c6f1` (същият файл).

## Мутации извън `useOfflineMutation` (одит)
- [ ] Подхождат на съществуващи типове: `useProductActions.ts:108,203,234`, `useProductEditForm.ts:194`, `MultiStoreView.tsx:199` (трябва `storeId`); `usePOSCheckout.ts:132` вече е покрит от офлайн POS клона
- [ ] Нужни са нови типове + replay в `OfflineIndicator`: delete/batch на продукти, batch на поръчки/купони, Categories, Tax, Attributes, Reviews, VariationsTab (виж доклада на агента)
- [ ] Мъртъв код от knip (не е трито): `deferredInit.ts` е маркиран unused file, но има тестове — провери; `src/utils/index.ts` barrel, много exports в `constants/config.js`, `stores/index.ts` и `__test_utils__`
- [ ] CLAUDE.md споменава `TaxRatesTab`, а мутациите на данъци са в `TaxPage` — провери
- [ ] Твърдо зададен `'bg-BG'` в `usePOSDailyReport`, `POSRecentTransactionsModal`, `OrderNotesSection`, `POSDailyReportModal` (няма locale helper в i18n)

## Документи и зависимости
- [ ] `docs/TESTING.md`: долните секции (списъци компоненти/утилити, `.jsx` примери) още са по старата структура
- [ ] `docs/SECURITY_RELEASE.md`: ред за `scripts/adhocSign.cjs`
- [ ] `pnpm-workspace.yaml`: остарял `minimumReleaseAgeExclude: electron@43.1.1`
- [ ] Минорни ъпдейти: electron 45.2.1, lucide-react 1.66, react-router-dom 7.18.5, @tanstack/react-virtual, @types/node, fake-indexeddb, globals (eslint остава на 9.x, typescript на 6.0.x)
- [ ] `pnpm run format:check` не е пускан
- [ ] Некомитнати от предишния кръг: промени в CLAUDE.md/README/docs/TESTING.md и 2 нови тест файла (`batchResult`, `useOfflineMutation`)
