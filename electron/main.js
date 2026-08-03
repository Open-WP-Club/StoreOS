import { app, BrowserWindow, Menu, ipcMain, Notification } from 'electron';
import path from 'path';

// electron-vite provides these environment variables
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

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
      webviewTag: true, // Allow webview for WP Admin integration
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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Security: Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for React dev
          "style-src 'self' 'unsafe-inline'",
          "connect-src 'self' https://* http://localhost:*",
          "img-src 'self' data: https://*",
          "frame-src https://* http://*", // Allow WP Admin in webview
        ].join('; '),
      },
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Show native desktop notification
ipcMain.on('show-notification', (_event, { title, body, route }) => {
  if (!Notification.isSupported()) return;

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

app.whenReady().then(createWindow);

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
