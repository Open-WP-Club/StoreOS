const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  onClearCache: (callback) => {
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('clear-cache');
    ipcRenderer.on('clear-cache', callback);
  },
  removeClearCacheListener: (callback) => {
    ipcRenderer.removeListener('clear-cache', callback);
  },
  // Desktop notifications
  showNotification: (payload) => {
    ipcRenderer.send('show-notification', payload);
  },
  onNotificationClicked: (callback) => {
    ipcRenderer.removeAllListeners('notification-clicked');
    ipcRenderer.on('notification-clicked', (_event, data) => callback(data));
  },
  removeNotificationClickedListener: () => {
    ipcRenderer.removeAllListeners('notification-clicked');
  },
});
