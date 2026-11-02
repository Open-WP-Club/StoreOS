export {};

declare global {
  interface Window {
    electronAPI?: {
      /** Returns an unsubscribe function. */
      onClearCache: (callback: () => void) => () => void;
      showNotification: (payload: { title: string; body: string; route?: string }) => void;
      /** Returns an unsubscribe function. */
      onNotificationClicked: (callback: (data: { route?: string }) => void) => () => void;
      /** Opens WP Admin in an isolated main-process window. Resolves false if rejected. */
      openWpAdmin: (url: string) => Promise<boolean>;
      /** Scheduled-report output; the folder is chosen natively and held by the main process. */
      reports: {
        getDir: () => Promise<string | null>;
        chooseDir: () => Promise<string | null>;
        save: (
          filename: string,
          data: string | Uint8Array
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
      };
      /** Auto-backup output (separate folder; names are patterned and validated in main). */
      backups: {
        getDir: () => Promise<string | null>;
        chooseDir: () => Promise<string | null>;
        save: (
          filename: string,
          data: string,
          keep: number
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        readLatest: () => Promise<{
          success: boolean;
          name?: string;
          data?: string;
          error?: string;
        }>;
      };
      /** OS-keychain encryption via Electron safeStorage; both return null when unavailable. */
      secureStorage: {
        encrypt: (text: string) => string | null;
        decrypt: (b64: string) => string | null;
      };
    };
  }
}
