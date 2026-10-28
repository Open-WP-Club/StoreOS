/**
 * Backup & Restore utilities
 *
 * Creates and restores backups of all application state:
 * - Store configurations (API credentials are EXCLUDED unless a passphrase is given;
 *   then they are AES-GCM encrypted with a PBKDF2-derived key)
 * - App settings (language, printer, PIN)
 * - Settings (auto-refresh, notifications)
 * - Theme preferences
 * - Search history and filter presets
 * - Offline pending operations
 * - Optionally: cached products for the active store
 */

import useStoreConfig from '../stores/storeConfigStore';
import useAppSettings from '../stores/appSettingsStore';
import useSettings from '../stores/settingsStore';
import useTheme from '../stores/themeStore';
import useSearch from '../stores/searchStore';
import useOffline from '../stores/offlineStore';
import useCache from '../stores/cacheStore';

// ============================================
// Types
// ============================================

export interface BackupData {
  version: string;
  appName: string;
  createdAt: string;
  storesCount: number;
  includesProducts: boolean;
  data: {
    storeConfig?: { stores: unknown[]; currentStoreId: string | null };
    appSettings?: {
      language: string;
      defaultPrinter: string | null;
      pinEnabled: boolean;
      pinCode: string | null;
      pinTimeout: number;
      lastActivity: number | null;
    };
    settings?: {
      autoRefresh: boolean;
      autoRefreshInterval: number;
      notifyNewOrders: boolean;
      notifyLowStock: boolean;
      lowStockThreshold: number;
      orderSplitDays: number;
    };
    theme?: { theme: string };
    search?: {
      recentSearches: unknown[];
      savedFilterPresets: unknown[];
      maxRecentSearches: number;
    };
    offline?: {
      pendingOperations: unknown[];
      lastSyncAttempt: number | null;
    };
    products?: Record<string, unknown[]>;
    /** AES-GCM encrypted `{[storeId]: {consumerKey, consumerSecret}}` (present only with passphrase). */
    encryptedCredentials?: { salt: string; iv: string; ct: string; iterations: number };
  };
}

type Credentials = Record<string, { consumerKey: string; consumerSecret: string }>;
const PBKDF2_ITERATIONS = 250_000;
const b64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u));
const unb64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Add passphrase-encrypted store credentials (taken from live state) to a backup. */
export async function encryptCredentials(
  backup: BackupData,
  passphrase: string
): Promise<BackupData> {
  if (!passphrase) throw new Error('Passphrase required');
  const creds: Credentials = {};
  for (const st of useStoreConfig.getState().stores) {
    creds[st.id] = { consumerKey: st.consumerKey, consumerSecret: st.consumerSecret };
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(creds)))
  );
  return {
    ...backup,
    data: {
      ...backup.data,
      encryptedCredentials: { salt: b64(salt), iv: b64(iv), ct: b64(ct), iterations: PBKDF2_ITERATIONS },
    },
  };
}

/** Decrypt credentials and merge them back into the backup's stores. Throws on wrong passphrase. */
export async function decryptCredentials(
  backup: BackupData,
  passphrase: string
): Promise<BackupData> {
  const enc = backup.data.encryptedCredentials;
  if (!enc || !backup.data.storeConfig) return backup;
  let creds: Credentials;
  try {
    const key = await deriveKey(passphrase, unb64(enc.salt), enc.iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(enc.iv) }, key, unb64(enc.ct));
    creds = JSON.parse(new TextDecoder().decode(plain)) as Credentials;
  } catch {
    throw new Error('Wrong passphrase or corrupted backup');
  }
  const stores = (backup.data.storeConfig.stores as Array<{ id: string }>).map((st) => ({
    ...st,
    ...(creds[st.id] ?? {}),
  }));
  return { ...backup, data: { ...backup.data, storeConfig: { ...backup.data.storeConfig, stores } } };
}

export interface RestoreResult {
  success: boolean;
  restored: string[];
  failed: string[];
  errors: string[];
}

// ============================================
// Backup Creation
// ============================================

/**
 * Create a backup of all application state
 */
export function createBackup(options: { includeProducts: boolean }): BackupData {
  const storeConfigState = useStoreConfig.getState();
  const appSettingsState = useAppSettings.getState();
  const settingsState = useSettings.getState();
  const themeState = useTheme.getState();
  const searchState = useSearch.getState();
  const offlineState = useOffline.getState();

  const backup: BackupData = {
    version: '1.0',
    appName: 'StoreOS - Built for WooCommerce',
    createdAt: new Date().toISOString(),
    storesCount: storeConfigState.stores.length,
    includesProducts: options.includeProducts,
    data: {
      storeConfig: {
        // Credentials are never written in plaintext (see encryptCredentials)
        stores: storeConfigState.stores.map((st) => ({
          ...st,
          consumerKey: '',
          consumerSecret: '',
        })),
        currentStoreId: storeConfigState.currentStoreId,
      },
      appSettings: {
        language: appSettingsState.language,
        defaultPrinter: appSettingsState.defaultPrinter,
        pinEnabled: appSettingsState.pinEnabled,
        pinCode: appSettingsState.pinCode,
        pinTimeout: appSettingsState.pinTimeout,
        lastActivity: appSettingsState.lastActivity,
      },
      settings: {
        autoRefresh: settingsState.autoRefresh,
        autoRefreshInterval: settingsState.autoRefreshInterval,
        notifyNewOrders: settingsState.notifyNewOrders,
        notifyLowStock: settingsState.notifyLowStock,
        lowStockThreshold: settingsState.lowStockThreshold,
        orderSplitDays: settingsState.orderSplitDays,
      },
      theme: {
        theme: themeState.theme,
      },
      search: {
        recentSearches: searchState.recentSearches,
        savedFilterPresets: searchState.savedFilterPresets,
        maxRecentSearches: searchState.maxRecentSearches,
      },
      offline: {
        pendingOperations: offlineState.pendingOperations,
        lastSyncAttempt: offlineState.lastSyncAttempt,
      },
    },
  };

  // Optionally include cached products for the active store
  if (options.includeProducts) {
    const cacheState = useCache.getState();
    const currentStoreId = storeConfigState.currentStoreId;
    if (currentStoreId && cacheState.cache.products.data) {
      backup.data.products = {
        [currentStoreId]: cacheState.cache.products.data,
      };
    }
  }

  return backup;
}

// ============================================
// Backup Download
// ============================================

/**
 * Download backup as a JSON file
 */
export function downloadBackup(backup: BackupData, storeName?: string): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');

  const date = new Date().toISOString().split('T')[0];
  const safeName = storeName ? storeName.replace(/[^a-zA-Z0-9а-яА-Я-_]/g, '_') : 'all-stores';
  const filename = `woocommerce-backup-${safeName}-${date}.json`;

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// ============================================
// Backup Reading & Validation
// ============================================

/**
 * Read a backup file and parse its contents
 */
export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validated = validateBackup(parsed);
        resolve(validated);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse backup file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Validate backup data structure
 */
export function validateBackup(data: unknown): BackupData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup: not an object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.appName !== 'StoreOS - Built for WooCommerce') {
    throw new Error('Invalid backup: wrong application');
  }

  if (!obj.version || typeof obj.version !== 'string') {
    throw new Error('Invalid backup: missing version');
  }

  if (!obj.data || typeof obj.data !== 'object') {
    throw new Error('Invalid backup: missing data section');
  }

  return data as BackupData;
}

// ============================================
// Backup Restore
// ============================================

/**
 * Restore application state from a backup
 */
export function restoreBackup(backup: BackupData): RestoreResult {
  const restored: string[] = [];
  const failed: string[] = [];
  const errors: string[] = [];

  const { data } = backup;

  // Restore store configurations
  if (data.storeConfig) {
    try {
      // Backups without credentials must not wipe credentials already on this machine.
      const existing = useStoreConfig.getState().stores;
      const stores = (
        data.storeConfig.stores as ReturnType<typeof useStoreConfig.getState>['stores']
      ).map((st) => {
        const prev = existing.find((e) => e.id === st.id);
        return prev
          ? {
              ...st,
              consumerKey: st.consumerKey || prev.consumerKey,
              consumerSecret: st.consumerSecret || prev.consumerSecret,
            }
          : st;
      });
      useStoreConfig.setState({
        stores,
        currentStoreId: data.storeConfig.currentStoreId,
      });
      restored.push('storeConfig');
    } catch (e) {
      failed.push('storeConfig');
      errors.push(`storeConfig: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Restore app settings
  if (data.appSettings) {
    try {
      useAppSettings.setState({
        language: data.appSettings.language as ReturnType<typeof useAppSettings.getState>['language'],
        defaultPrinter: data.appSettings.defaultPrinter,
        pinEnabled: data.appSettings.pinEnabled,
        pinCode: data.appSettings.pinCode,
        pinTimeout: data.appSettings.pinTimeout,
        lastActivity: data.appSettings.lastActivity,
      });
      restored.push('appSettings');
    } catch (e) {
      failed.push('appSettings');
      errors.push(`appSettings: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Restore settings
  if (data.settings) {
    try {
      useSettings.setState({
        autoRefresh: data.settings.autoRefresh,
        autoRefreshInterval: data.settings.autoRefreshInterval,
        notifyNewOrders: data.settings.notifyNewOrders,
        notifyLowStock: data.settings.notifyLowStock,
        lowStockThreshold: data.settings.lowStockThreshold,
        orderSplitDays: data.settings.orderSplitDays ?? 7,
      });
      restored.push('settings');
    } catch (e) {
      failed.push('settings');
      errors.push(`settings: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Restore theme
  if (data.theme) {
    try {
      useTheme.setState({
        theme: data.theme.theme as ReturnType<typeof useTheme.getState>['theme'],
      });
      restored.push('theme');
    } catch (e) {
      failed.push('theme');
      errors.push(`theme: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Restore search
  if (data.search) {
    try {
      useSearch.setState({
        recentSearches: data.search.recentSearches as ReturnType<typeof useSearch.getState>['recentSearches'],
        savedFilterPresets: data.search.savedFilterPresets as ReturnType<typeof useSearch.getState>['savedFilterPresets'],
        maxRecentSearches: data.search.maxRecentSearches,
      });
      restored.push('search');
    } catch (e) {
      failed.push('search');
      errors.push(`search: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Restore offline
  if (data.offline) {
    try {
      useOffline.setState({
        pendingOperations: data.offline.pendingOperations as ReturnType<typeof useOffline.getState>['pendingOperations'],
        lastSyncAttempt: data.offline.lastSyncAttempt,
      });
      restored.push('offline');
    } catch (e) {
      failed.push('offline');
      errors.push(`offline: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Restore products cache
  if (data.products) {
    try {
      const storeIds = Object.keys(data.products);
      for (const storeId of storeIds) {
        const products = data.products[storeId];
        if (Array.isArray(products)) {
          useCache.getState().setCachedProducts(
            products as ReturnType<typeof useCache.getState>['cache']['products']['data'] & unknown[],
            storeId,
            Date.now()
          );
        }
      }
      restored.push('products');
    } catch (e) {
      failed.push('products');
      errors.push(`products: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return {
    success: failed.length === 0,
    restored,
    failed,
    errors,
  };
}
