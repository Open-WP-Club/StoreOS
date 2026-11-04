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
  reports: {
    getDir: () => ipcRenderer.invoke('reports:get-dir'),
    chooseDir: () => ipcRenderer.invoke('reports:choose-dir'),
    save: (filename, data) => ipcRenderer.invoke('reports:save', filename, data),
  },
  getPrinters: () => ipcRenderer.invoke('receipt:get-printers'),
  receipt: {
    print: (payload) => ipcRenderer.invoke('receipt:print', payload),
  },
  fiscal: {
    sale: (payload) => ipcRenderer.invoke('fiscal:sale', payload),
    report: (payload) => ipcRenderer.invoke('fiscal:report', payload),
  },
  backups: {
    getDir: () => ipcRenderer.invoke('backups:get-dir'),
    chooseDir: () => ipcRenderer.invoke('backups:choose-dir'),
    save: (filename, data, keep) => ipcRenderer.invoke('backups:save', filename, data, keep),
    readLatest: () => ipcRenderer.invoke('backups:read-latest'),
  },
  updater: {
    getState: () => ipcRenderer.invoke('updater:get-state'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback) => subscribe('updater:status', callback),
  },
  // OS-keychain backed encryption (returns null when unavailable)
  secureStorage: {
    encrypt: (text) => ipcRenderer.sendSync('secure-storage:encrypt', text),
    decrypt: (b64) => ipcRenderer.sendSync('secure-storage:decrypt', b64),
  },
});
