import type { StateStorage } from 'zustand/middleware';

const PREFIX = 'enc:v1:';

/**
 * localStorage-backed Zustand storage that encrypts values with the OS keychain
 * (Electron safeStorage, exposed via preload). Synchronous, so persist hydration
 * stays synchronous and decrypted secrets live only in memory.
 *
 * - Legacy plaintext values are read as-is and transparently re-written encrypted.
 * - Without Electron (browser/tests) or when the keychain is unavailable it falls
 *   back to plaintext, same as before.
 */
export function createSecureStorage(): StateStorage {
  const api = (): NonNullable<Window['electronAPI']>['secureStorage'] | undefined =>
    typeof window === 'undefined' ? undefined : window.electronAPI?.secureStorage;

  const write = (name: string, value: string): void => {
    const encrypted = api()?.encrypt(value);
    localStorage.setItem(name, encrypted ? PREFIX + encrypted : value);
  };

  return {
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      if (raw === null) return null;
      if (raw.startsWith(PREFIX)) {
        // null => keychain unavailable/changed; treat as no data rather than leak garbage
        return api()?.decrypt(raw.slice(PREFIX.length)) ?? null;
      }
      // Legacy plaintext: migrate now.
      if (api()) write(name, raw);
      return raw;
    },
    setItem: write,
    removeItem: (name) => localStorage.removeItem(name),
  };
}
