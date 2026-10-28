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
      /** OS-keychain encryption via Electron safeStorage; both return null when unavailable. */
      secureStorage: {
        encrypt: (text: string) => string | null;
        decrypt: (b64: string) => string | null;
      };
    };
  }
}
