import { app, BrowserWindow, Menu, ipcMain, Notification, safeStorage, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { sanitizeNotificationPayload } from './ipcValidation';

// electron-vite provides these environment variables
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

const DEV_ORIGIN = 'http://localhost:5173';

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function openExternalHttps(value) {
  const u = parseUrl(value);
  if (u && u.protocol === 'https:') shell.openExternal(u.href);
}

// Is this URL one of the app's own pages (dev server or packaged file://)?
function isAppUrl(value) {
  const u = parseUrl(value);
  if (!u) return false;
  return isDev ? u.origin === DEV_ORIGIN : u.protocol === 'file:';
}

// Only accept IPC from the main window's own webContents.
function isTrustedSender(event) {
  return !!mainWindow && event.sender === mainWindow.webContents;
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear Cache',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('clear-cache');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  // Add macOS-specific menu items
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Clear Cache',
          accelerator: 'Cmd+Shift+Delete',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('clear-cache');
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  // Resolve preload path
  // After electron-vite build, main is at dist-electron/main/index.js
  // and preload is at dist-electron/preload/index.js (CommonJS for sandbox)
  const preloadPath = path.join(__dirname, '../preload/index.js');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // Enhanced security
      webviewTag: false, // WP Admin opens in a dedicated, isolated window (see open-wp-admin)
      preload: preloadPath,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  // Create menu
  createMenu();

  // Load content based on environment
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // CSP is delivered via <meta> in index.html (works for file:// too).

  // Never let the app window navigate away or spawn windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttps(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternalHttps(url);
    }
  });
  // No <webview> is used; refuse any attempt to attach one.
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Show native desktop notification
ipcMain.on('show-notification', (event, payload) => {
  if (!isTrustedSender(event) || !Notification.isSupported()) return;
  const clean = sanitizeNotificationPayload(payload);
  if (!clean) return;
  const { title, body, route } = clean;

  const notification = new Notification({ title, body });
  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      if (route) {
        mainWindow.webContents.send('notification-clicked', { route });
      }
    }
  });
  notification.show();
});

// IPC: credential encryption via OS keychain (safeStorage). Sync so the
// renderer's synchronous Zustand persist storage keeps working; payloads are tiny.
function encryptionUsable() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  // Linux without a keyring falls back to a hardcoded key - not real protection.
  return !(
    process.platform === 'linux' &&
    safeStorage.getSelectedStorageBackend?.() === 'basic_text'
  );
}

ipcMain.on('secure-storage:encrypt', (event, text) => {
  event.returnValue =
    isTrustedSender(event) && typeof text === 'string' && encryptionUsable()
      ? safeStorage.encryptString(text).toString('base64')
      : null;
});

ipcMain.on('secure-storage:decrypt', (event, b64) => {
  try {
    event.returnValue =
      isTrustedSender(event) && typeof b64 === 'string' && encryptionUsable()
        ? safeStorage.decryptString(Buffer.from(b64, 'base64'))
        : null;
  } catch {
    event.returnValue = null;
  }
});

// IPC: open WP Admin in an isolated window (own session partition, locked to the store origin).
let wpAdminWindow = null;
ipcMain.handle('open-wp-admin', (event, rawUrl) => {
  if (!isTrustedSender(event) || typeof rawUrl !== 'string') return false;
  const target = parseUrl(rawUrl);
  const isLocal = target && target.protocol === 'http:' && target.hostname === 'localhost';
  if (!target || (target.protocol !== 'https:' && !isLocal)) return false;

  if (wpAdminWindow && !wpAdminWindow.isDestroyed()) wpAdminWindow.close();
  wpAdminWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    parent: mainWindow ?? undefined,
    title: 'WP Admin',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      partition: 'persist:wpadmin', // cookies isolated from the app session
    },
  });
  const wc = wpAdminWindow.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (parseUrl(url)?.origin === target.origin) {
      wc.loadURL(url);
    } else {
      openExternalHttps(url);
    }
    return { action: 'deny' };
  });
  const guard = (e, url) => {
    if (parseUrl(url)?.origin !== target.origin) {
      e.preventDefault();
      openExternalHttps(url);
    }
  };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', guard);
  wc.on('will-attach-webview', (e) => e.preventDefault());
  wpAdminWindow.loadURL(target.href);
  return true;
});

app.whenReady().then(() => {
  createWindow();
  if (!isDev) {
    // Checks GitHub releases (see package.json "build.publish"), downloads in the
    // background, and shows a native notification when ready to install on quit.
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
