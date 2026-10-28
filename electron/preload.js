const { contextBridge, ipcRenderer } = require('electron');

// Subscribe to a main->renderer channel and return an unsubscribe function that
// removes only this subscription (never other listeners).
function subscribe(channel, callback) {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// Expose a minimal, explicit API - never the raw ipcRenderer.
contextBridge.exposeInMainWorld('electronAPI', {
  onClearCache: (callback) => subscribe('clear-cache', () => callback()),
  showNotification: (payload) => {
    ipcRenderer.send('show-notification', payload);
  },
  onNotificationClicked: (callback) => subscribe('notification-clicked', callback),
  openWpAdmin: (url) => ipcRenderer.invoke('open-wp-admin', url),
  // OS-keychain backed encryption (returns null when unavailable)
  secureStorage: {
    encrypt: (text) => ipcRenderer.sendSync('secure-storage:encrypt', text),
    decrypt: (b64) => ipcRenderer.sendSync('secure-storage:decrypt', b64),
  },
});
