import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  Notification,
  safeStorage,
  shell,
  dialog,
} from 'electron';
import fs from 'fs';
import { resolveReportPath } from './reportFiles';
import { resolveBackupPath, listBackupNames, selectPrune } from './backupFiles';
import electronUpdater from 'electron-updater';
import path from 'path';
import { sanitizeNotificationPayload } from './ipcValidation';

// electron-updater is CommonJS: named imports fail in the packaged ESM bundle.
const { autoUpdater } = electronUpdater;

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
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
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
        { role: 'selectAll' },
      ],
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
        { role: 'togglefullscreen' },
      ],
    },
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
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
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
    process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text'
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

// IPC: scheduled-report output. The folder is only ever set by the user via a native dialog and
// persisted here in the main process; the renderer never supplies a path, only a filename.
const reportDirFile = () => path.join(app.getPath('userData'), 'report-dir.json');
function getReportDir() {
  try {
    const dir = JSON.parse(fs.readFileSync(reportDirFile(), 'utf8')).dir;
    return typeof dir === 'string' && path.isAbsolute(dir) ? dir : null;
  } catch {
    return null;
  }
}
ipcMain.handle('reports:get-dir', (event) => (isTrustedSender(event) ? getReportDir() : null));
ipcMain.handle('reports:choose-dir', async (event) => {
  if (!isTrustedSender(event)) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return getReportDir();
  fs.writeFileSync(reportDirFile(), JSON.stringify({ dir: res.filePaths[0] }));
  return res.filePaths[0];
});
ipcMain.handle('reports:save', async (event, filename, data) => {
  if (!isTrustedSender(event)) return { success: false, error: 'untrusted' };
  const dir = getReportDir();
  const target = dir && resolveReportPath(dir, filename);
  const isBytes = data instanceof Uint8Array || data instanceof ArrayBuffer;
  if (!target || !(typeof data === 'string' || isBytes)) {
    return { success: false, error: 'invalid target' };
  }
  try {
    await fs.promises.writeFile(target, data instanceof ArrayBuffer ? Buffer.from(data) : data);
    return { success: true, path: target };
  } catch (e) {
    return { success: false, error: String(e && e.message) };
  }
});

// IPC: automatic backups. Separate folder from reports (own persisted setting); same rules: the
// folder comes only from a native dialog, the renderer supplies just a strictly patterned filename.
const backupDirFile = () => path.join(app.getPath('userData'), 'backup-dir.json');
function getBackupDir() {
  try {
    const dir = JSON.parse(fs.readFileSync(backupDirFile(), 'utf8')).dir;
    return typeof dir === 'string' && path.isAbsolute(dir) ? dir : null;
  } catch {
    return null;
  }
}
ipcMain.handle('backups:get-dir', (event) => (isTrustedSender(event) ? getBackupDir() : null));
ipcMain.handle('backups:choose-dir', async (event) => {
  if (!isTrustedSender(event)) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return getBackupDir();
  fs.writeFileSync(backupDirFile(), JSON.stringify({ dir: res.filePaths[0] }));
  return res.filePaths[0];
});
ipcMain.handle('backups:save', async (event, filename, data, keep) => {
  if (!isTrustedSender(event)) return { success: false, error: 'untrusted' };
  const dir = getBackupDir();
  const target = dir && resolveBackupPath(dir, filename);
  if (!target || typeof data !== 'string') return { success: false, error: 'invalid target' };
  try {
    await fs.promises.writeFile(target, data, { mode: 0o600 });
    // Prune only after a successful write, so a failed run never deletes the last good backup.
    const names = await fs.promises.readdir(dir);
    for (const n of selectPrune(names, keep)) {
      const p = resolveBackupPath(dir, n);
      if (p) await fs.promises.unlink(p).catch(() => {});
    }
    return { success: true, path: target };
  } catch (e) {
    return { success: false, error: String(e && e.message) };
  }
});
ipcMain.handle('backups:read-latest', async (event) => {
  if (!isTrustedSender(event)) return { success: false, error: 'untrusted' };
  const dir = getBackupDir();
  if (!dir) return { success: false, error: 'no folder' };
  try {
    const name = listBackupNames(await fs.promises.readdir(dir)).pop();
    const target = name && resolveBackupPath(dir, name);
    if (!target) return { success: false, error: 'no backups found' };
    return { success: true, name, data: await fs.promises.readFile(target, 'utf8') };
  } catch (e) {
    return { success: false, error: String(e && e.message) };
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
