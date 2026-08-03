/**
 * Internationalization (i18n) System
 *
 * Easy to extend with new languages:
 * 1. Add new language code to SUPPORTED_LANGUAGES
 * 2. Add language info to LANGUAGE_INFO
 * 3. Create translation file in /locales/{lang}.ts
 * 4. Import and add to translations object
 *
 * Translation files follow the same structure as the base (bg) language.
 * Missing translations will fallback to Bulgarian, then to the key itself.
 */

// ============================================
// Supported Languages Configuration
// ============================================

export const SUPPORTED_LANGUAGES = ['bg', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Language metadata for UI display
export interface LanguageInfo {
  code: Language;
  name: string; // Native name
  englishName: string;
  flag: string; // Emoji flag
  rtl?: boolean; // Right-to-left language
}

export const LANGUAGE_INFO: Record<Language, LanguageInfo> = {
  bg: {
    code: 'bg',
    name: 'Български',
    englishName: 'Bulgarian',
    flag: '🇧🇬',
  },
  en: {
    code: 'en',
    name: 'English',
    englishName: 'English',
    flag: '🇬🇧',
  },
  // Add new languages here:
  // de: { code: 'de', name: 'Deutsch', englishName: 'German', flag: '🇩🇪' },
  // es: { code: 'es', name: 'Español', englishName: 'Spanish', flag: '🇪🇸' },
  // fr: { code: 'fr', name: 'Français', englishName: 'French', flag: '🇫🇷' },
  // etc.
};

// ============================================
// Translation Type Definition
// ============================================

// Base translation keys - all languages must implement these
export interface TranslationStrings {
  // Common
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  close: string;
  confirm: string;
  loading: string;
  search: string;
  all: string;
  yes: string;
  no: string;
  back: string;
  next: string;
  clear: string;
  export: string;
  import: string;
  refresh: string;
  settings: string;
  error: string;
  success: string;
  warning: string;

  // Navigation
  dashboard: string;
  orders: string;
  products: string;
  inventory: string;
  analytics: string;
  pos: string;
  stores: string;
  multiStore: string;

  // Settings Page
  settingsTitle: string;
  languageLabel: string;
  printerLabel: string;
  printerNone: string;
  printerSelect: string;
  securitySection: string;
  pinLockLabel: string;
  pinLockDescription: string;
  pinTimeoutLabel: string;
  pinSetup: string;
  pinChange: string;
  pinRemove: string;
  pinCurrent: string;
  pinNew: string;
  pinConfirm: string;
  pinMismatch: string;
  pinTooShort: string;
  pinSuccess: string;
  pinRemoved: string;
  pinIncorrect: string;

  // PIN Lock Screen
  pinLockTitle: string;
  pinEnterCode: string;
  pinUnlock: string;

  // Loading Screen
  loadingApp: string;
  loadingStores: string;
  loadingData: string;

  // POS
  cart: string;
  cartEmpty: string;
  addProducts: string;
  subtotal: string;
  discount: string;
  total: string;
  payment: string;
  cash: string;
  card: string;
  other: string;
  amountTendered: string;
  change: string;
  completeOrder: string;
  orderSuccess: string;
  orderError: string;
  customer: string;
  addCustomer: string;
  orderNote: string;
  scratchpad: string;
  scratchpadPlaceholder: string;
  autoSaved: string;
  dailyReport: string;
  recentTransactions: string;
  keyboardShortcuts: string;
  searchProduct: string;
  allCategories: string;
  items: string;
  item: string;

  // Orders
  order: string;
  orderDetails: string;
  orderStatus: string;
  orderDate: string;
  orderTotal: string;
  orderItems: string;
  orderNotes: string;
  addNote: string;
  customerNote: string;
  privateNote: string;

  // Status
  pending: string;
  processing: string;
  onHold: string;
  completed: string;
  cancelled: string;
  refunded: string;
  failed: string;

  // Products
  product: string;
  productName: string;
  sku: string;
  price: string;
  stock: string;
  inStock: string;
  outOfStock: string;
  lowStock: string;

  // Backup & Restore
  backupRestore: string;
  backupRestoreDescription: string;
  createBackup: string;
  createBackupDescription: string;
  includeProducts: string;
  includeProductsDescription: string;
  restoreFromBackup: string;
  restoreFromBackupDescription: string;
  backupWarningCredentials: string;
  backupSuccess: string;
  restoreSuccess: string;
  restoreError: string;
  restoreConfirmTitle: string;
  restoreConfirmMessage: string;
  restorePartialSuccess: string;
  invalidBackupFile: string;
}

export type TranslationKey = keyof TranslationStrings;

// ============================================
// Translations
// ============================================

const translations: Record<Language, TranslationStrings> = {
  // Bulgarian (Base Language)
  bg: {
    // Common
    save: 'Запази',
    cancel: 'Отказ',
    delete: 'Изтрий',
    edit: 'Редактирай',
    close: 'Затвори',
    confirm: 'Потвърди',
    loading: 'Зареждане...',
    search: 'Търси',
    all: 'Всички',
    yes: 'Да',
    no: 'Не',
    back: 'Назад',
    next: 'Напред',
    clear: 'Изчисти',
    export: 'Експорт',
    import: 'Импорт',
    refresh: 'Обнови',
    settings: 'Настройки',
    error: 'Грешка',
    success: 'Успех',
    warning: 'Внимание',

    // Navigation
    dashboard: 'Табло',
    orders: 'Поръчки',
    products: 'Продукти',
    inventory: 'Наличност',
    analytics: 'Аналитика',
    pos: 'POS',
    stores: 'Магазини',
    multiStore: 'Мулти-магазин',

    // Settings Page
    settingsTitle: 'Настройки на приложението',
    languageLabel: 'Език',
    printerLabel: 'Принтер по подразбиране',
    printerNone: 'Не е избран',
    printerSelect: 'Избери принтер',
    securitySection: 'Сигурност',
    pinLockLabel: 'PIN заключване',
    pinLockDescription: 'Заключване на приложението след период на неактивност',
    pinTimeoutLabel: 'Заключване след (минути)',
    pinSetup: 'Настрой PIN',
    pinChange: 'Смени PIN',
    pinRemove: 'Премахни PIN',
    pinCurrent: 'Текущ PIN',
    pinNew: 'Нов PIN',
    pinConfirm: 'Потвърди PIN',
    pinMismatch: 'PIN кодовете не съвпадат',
    pinTooShort: 'PIN трябва да е поне 4 цифри',
    pinSuccess: 'PIN е настроен успешно',
    pinRemoved: 'PIN е премахнат',
    pinIncorrect: 'Грешен PIN код',

    // PIN Lock Screen
    pinLockTitle: 'Заключено',
    pinEnterCode: 'Въведи PIN код',
    pinUnlock: 'Отключи',

    // Loading Screen
    loadingApp: 'Зареждане на приложението...',
    loadingStores: 'Зареждане на магазини...',
    loadingData: 'Зареждане на данни...',

    // POS
    cart: 'Кошница',
    cartEmpty: 'Кошницата е празна',
    addProducts: 'Добавете продукти от ляво',
    subtotal: 'Междинна сума',
    discount: 'Отстъпка',
    total: 'Общо',
    payment: 'Плащане',
    cash: 'Каса',
    card: 'Карта',
    other: 'Друго',
    amountTendered: 'Платена сума',
    change: 'Ресто',
    completeOrder: 'Завърши поръчка',
    orderSuccess: 'Поръчката е създадена успешно!',
    orderError: 'Грешка при създаване на поръчка',
    customer: 'Клиент',
    addCustomer: 'Добави клиент',
    orderNote: 'Бележка за поръчката...',
    scratchpad: 'Бележник',
    scratchpadPlaceholder: 'Запиши си нещо...',
    autoSaved: 'Запазва се автоматично',
    dailyReport: 'Дневен отчет',
    recentTransactions: 'Последни транзакции',
    keyboardShortcuts: 'Клавиатурни shortcuts',
    searchProduct: 'Търси продукт...',
    allCategories: 'Всички категории',
    items: 'артикула',
    item: 'артикул',

    // Orders
    order: 'Поръчка',
    orderDetails: 'Детайли на поръчка',
    orderStatus: 'Статус',
    orderDate: 'Дата',
    orderTotal: 'Обща сума',
    orderItems: 'Артикули',
    orderNotes: 'Бележки',
    addNote: 'Добави бележка',
    customerNote: 'Бележка от клиент',
    privateNote: 'Вътрешна бележка',

    // Status
    pending: 'Изчакваща',
    processing: 'Обработва се',
    onHold: 'На изчакване',
    completed: 'Завършена',
    cancelled: 'Отказана',
    refunded: 'Възстановена',
    failed: 'Неуспешна',

    // Products
    product: 'Продукт',
    productName: 'Име на продукт',
    sku: 'SKU',
    price: 'Цена',
    stock: 'Наличност',
    inStock: 'В наличност',
    outOfStock: 'Изчерпан',
    lowStock: 'Малко наличност',

    // Backup & Restore
    backupRestore: 'Backup и възстановяване',
    backupRestoreDescription: 'Създай или възстанови backup на конфигурации и настройки',
    createBackup: 'Създай Backup',
    createBackupDescription: 'Запази всички настройки и конфигурации във файл',
    includeProducts: 'Включи продукти',
    includeProductsDescription: 'Включи кеширани продукти в backup файла',
    restoreFromBackup: 'Възстанови от Backup',
    restoreFromBackupDescription: 'Зареди настройки от backup файл',
    backupWarningCredentials: 'Backup файлът съдържа API ключове. Пазете го на сигурно място.',
    backupSuccess: 'Backup файлът е създаден успешно',
    restoreSuccess: 'Настройките са възстановени успешно. Приложението ще се презареди.',
    restoreError: 'Грешка при възстановяване на backup',
    restoreConfirmTitle: 'Потвърди възстановяване',
    restoreConfirmMessage: 'Това ще замени текущите настройки с тези от backup файла. Продължи?',
    restorePartialSuccess: 'Частично възстановяване: някои секции не бяха възстановени',
    invalidBackupFile: 'Невалиден backup файл',
  },

  // English
  en: {
    // Common
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    confirm: 'Confirm',
    loading: 'Loading...',
    search: 'Search',
    all: 'All',
    yes: 'Yes',
    no: 'No',
    back: 'Back',
    next: 'Next',
    clear: 'Clear',
    export: 'Export',
    import: 'Import',
    refresh: 'Refresh',
    settings: 'Settings',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',

    // Navigation
    dashboard: 'Dashboard',
    orders: 'Orders',
    products: 'Products',
    inventory: 'Inventory',
    analytics: 'Analytics',
    pos: 'POS',
    stores: 'Stores',
    multiStore: 'Multi-Store',

    // Settings Page
    settingsTitle: 'App Settings',
    languageLabel: 'Language',
    printerLabel: 'Default Printer',
    printerNone: 'Not selected',
    printerSelect: 'Select printer',
    securitySection: 'Security',
    pinLockLabel: 'PIN Lock',
    pinLockDescription: 'Lock app after period of inactivity',
    pinTimeoutLabel: 'Lock after (minutes)',
    pinSetup: 'Set up PIN',
    pinChange: 'Change PIN',
    pinRemove: 'Remove PIN',
    pinCurrent: 'Current PIN',
    pinNew: 'New PIN',
    pinConfirm: 'Confirm PIN',
    pinMismatch: 'PIN codes do not match',
    pinTooShort: 'PIN must be at least 4 digits',
    pinSuccess: 'PIN set successfully',
    pinRemoved: 'PIN removed',
    pinIncorrect: 'Incorrect PIN code',

    // PIN Lock Screen
    pinLockTitle: 'Locked',
    pinEnterCode: 'Enter PIN code',
    pinUnlock: 'Unlock',

    // Loading Screen
    loadingApp: 'Loading application...',
    loadingStores: 'Loading stores...',
    loadingData: 'Loading data...',

    // POS
    cart: 'Cart',
    cartEmpty: 'Cart is empty',
    addProducts: 'Add products from the left',
    subtotal: 'Subtotal',
    discount: 'Discount',
    total: 'Total',
    payment: 'Payment',
    cash: 'Cash',
    card: 'Card',
    other: 'Other',
    amountTendered: 'Amount Tendered',
    change: 'Change',
    completeOrder: 'Complete Order',
    orderSuccess: 'Order created successfully!',
    orderError: 'Error creating order',
    customer: 'Customer',
    addCustomer: 'Add customer',
    orderNote: 'Order note...',
    scratchpad: 'Scratchpad',
    scratchpadPlaceholder: 'Write something...',
    autoSaved: 'Auto-saved',
    dailyReport: 'Daily Report',
    recentTransactions: 'Recent Transactions',
    keyboardShortcuts: 'Keyboard Shortcuts',
    searchProduct: 'Search product...',
    allCategories: 'All categories',
    items: 'items',
    item: 'item',

    // Orders
    order: 'Order',
    orderDetails: 'Order Details',
    orderStatus: 'Status',
    orderDate: 'Date',
    orderTotal: 'Total',
    orderItems: 'Items',
    orderNotes: 'Notes',
    addNote: 'Add note',
    customerNote: 'Customer note',
    privateNote: 'Private note',

    // Status
    pending: 'Pending',
    processing: 'Processing',
    onHold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    failed: 'Failed',

    // Products
    product: 'Product',
    productName: 'Product Name',
    sku: 'SKU',
    price: 'Price',
    stock: 'Stock',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    lowStock: 'Low Stock',

    // Backup & Restore
    backupRestore: 'Backup & Restore',
    backupRestoreDescription: 'Create or restore a backup of configurations and settings',
    createBackup: 'Create Backup',
    createBackupDescription: 'Save all settings and configurations to a file',
    includeProducts: 'Include products',
    includeProductsDescription: 'Include cached products in the backup file',
    restoreFromBackup: 'Restore from Backup',
    restoreFromBackupDescription: 'Load settings from a backup file',
    backupWarningCredentials: 'The backup file contains API keys. Keep it in a safe place.',
    backupSuccess: 'Backup file created successfully',
    restoreSuccess: 'Settings restored successfully. The app will reload.',
    restoreError: 'Error restoring backup',
    restoreConfirmTitle: 'Confirm Restore',
    restoreConfirmMessage: 'This will replace current settings with those from the backup file. Continue?',
    restorePartialSuccess: 'Partial restore: some sections were not restored',
    invalidBackupFile: 'Invalid backup file',
  },

  // Add new languages here following the same structure
};

// ============================================
// Translation Functions
// ============================================

/**
 * Get translated string for a key
 * @param key - Translation key
 * @param language - Target language code
 * @returns Translated string or key if not found
 */
export function t(key: TranslationKey, language: Language): string {
  // Try requested language first
  if (translations[language]?.[key]) {
    return translations[language][key];
  }
  // Fallback to Bulgarian
  if (translations.bg[key]) {
    return translations.bg[key];
  }
  // Last resort: return the key itself
  return key;
}

/**
 * Get all supported languages
 * @returns Array of language info objects
 */
export function getSupportedLanguages(): LanguageInfo[] {
  return SUPPORTED_LANGUAGES.map((code) => LANGUAGE_INFO[code]);
}

/**
 * Check if a language is supported
 * @param code - Language code to check
 * @returns boolean
 */
export function isLanguageSupported(code: string): code is Language {
  return SUPPORTED_LANGUAGES.includes(code as Language);
}

/**
 * Get language info by code
 * @param code - Language code
 * @returns LanguageInfo or undefined
 */
export function getLanguageInfo(code: Language): LanguageInfo {
  return LANGUAGE_INFO[code];
}

// Export translations for direct access if needed
export { translations };
