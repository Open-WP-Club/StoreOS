export interface UpdateState {
  status:
    | 'disabled'
    | 'idle'
    | 'checking'
    | 'available'
    | 'up-to-date'
    | 'downloading'
    | 'downloaded'
    | 'error';
  currentVersion: string;
  version?: string;
  percent?: number;
  error?: string;
}

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
      /** System printer names (empty when unavailable). */
      getPrinters: () => Promise<string[]>;
      /** 80mm receipt print; openDrawer sends ESC/POS kick (needs a named printer; untested on hardware). */
      receipt: {
        print: (payload: {
          html: string;
          printer: string | null;
          openDrawer: boolean;
        }) => Promise<{ success: boolean; error?: string }>;
      };
      /** Bulgarian fiscal device (Datecs FP over serial); untested on hardware. */
      fiscal: {
        sale: (
          payload: unknown
        ) => Promise<{ success: boolean; error?: string; ambiguous?: boolean }>;
        report: (payload: unknown) => Promise<{ success: boolean; error?: string }>;
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
      /** Auto-update via GitHub Releases; nothing downloads/installs without an explicit call. */
      updater: {
        getState: () => Promise<UpdateState | null>;
        check: () => Promise<void>;
        download: () => Promise<void>;
        install: () => Promise<void>;
        /** Returns an unsubscribe function. */
        onStatus: (callback: (state: UpdateState) => void) => () => void;
      };
      /** OS-keychain encryption via Electron safeStorage; both return null when unavailable. */
      secureStorage: {
        encrypt: (text: string) => string | null;
        decrypt: (b64: string) => string | null;
      };
    };
  }
}
