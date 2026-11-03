import { vi } from 'vitest';

// Drives electron/main.js with mocked electron + electron-updater and exercises the updater:* IPC.

const WINDOW_SENDER = { id: 'main-window' };

async function loadMain({ packaged = true, disabled = false } = {}) {
  vi.resetModules();
  if (disabled) process.env.STOREOS_DISABLE_UPDATER = '1';
  else delete process.env.STOREOS_DISABLE_UPDATER;

  const handlers = {};
  const updaterEvents = {};
  const sent = [];
  const autoUpdater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    on: vi.fn((name, cb) => {
      updaterEvents[name] = cb;
    }),
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(() => Promise.resolve()),
    quitAndInstall: vi.fn(),
  };
  class BrowserWindow {
    constructor() {
      // isTrustedSender compares by identity, so expose the very object tests pass as event.sender.
      this.webContents = Object.assign(WINDOW_SENDER, {
        send: (...a) => sent.push(a),
        openDevTools: vi.fn(),
        setWindowOpenHandler: vi.fn(),
        on: vi.fn(),
      });
    }
    loadURL = vi.fn();
    loadFile = vi.fn();
    on = vi.fn();
    isDestroyed = () => false;
  }
  BrowserWindow.getAllWindows = () => [];
  let ready;
  const app = {
    isPackaged: packaged,
    getVersion: () => '1.2.3',
    getPath: () => '/tmp/storeos-test',
    whenReady: () => {
      ready = Promise.resolve();
      return ready;
    },
    on: vi.fn(),
    quit: vi.fn(),
  };
  vi.doMock('electron', () => ({
    app,
    BrowserWindow,
    Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
    ipcMain: {
      handle: (name, fn) => {
        handlers[name] = fn;
      },
      on: vi.fn(),
    },
    Notification: { isSupported: () => false },
    safeStorage: { isEncryptionAvailable: () => false },
    shell: { openExternal: vi.fn() },
    dialog: {},
  }));
  vi.doMock('electron-updater', () => ({ default: { autoUpdater } }));

  await import('../main.js');
  await ready; // createWindow() + first update check run in whenReady().then
  await Promise.resolve();
  return { handlers, updaterEvents, sent, autoUpdater };
}

const trusted = { sender: WINDOW_SENDER };
const untrusted = { sender: { id: 'evil' } };

describe('main.js updater (packaged)', () => {
  it('disables auto download/install and checks once on startup', async () => {
    const { autoUpdater } = await loadMain();
    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('updater:get-state returns state to the main window only', async () => {
    const { handlers } = await loadMain();
    expect(handlers['updater:get-state'](trusted)).toMatchObject({
      status: 'idle',
      currentVersion: '1.2.3',
    });
    expect(handlers['updater:get-state'](untrusted)).toBeNull();
  });

  it('maps autoUpdater events to states and pushes updater:status to the renderer', async () => {
    const { handlers, updaterEvents, sent } = await loadMain();
    updaterEvents['update-available']({ version: '2.0.0' });
    expect(handlers['updater:get-state'](trusted)).toMatchObject({
      status: 'available',
      version: '2.0.0',
    });
    updaterEvents['download-progress']({ percent: 41.6 });
    expect(handlers['updater:get-state'](trusted)).toMatchObject({
      status: 'downloading',
      version: '2.0.0',
      percent: 42,
    });
    updaterEvents['update-downloaded']({ version: '2.0.0' });
    updaterEvents.error(new Error('boom'));
    expect(handlers['updater:get-state'](trusted)).toMatchObject({
      status: 'error',
      error: 'boom',
    });
    expect(sent.at(-1)[0]).toBe('updater:status');
  });

  it('updater:download only runs from "available" for a trusted sender', async () => {
    const { handlers, updaterEvents, autoUpdater } = await loadMain();
    handlers['updater:download'](trusted); // idle: ignored
    updaterEvents['update-available']({ version: '2.0.0' });
    handlers['updater:download'](untrusted);
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    handlers['updater:download'](trusted);
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('updater:install only runs from "downloaded" for a trusted sender', async () => {
    const { handlers, updaterEvents, autoUpdater } = await loadMain();
    updaterEvents['update-available']({ version: '2.0.0' });
    handlers['updater:install'](trusted); // not downloaded yet
    updaterEvents['update-downloaded']({ version: '2.0.0' });
    handlers['updater:install'](untrusted);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    handlers['updater:install'](trusted);
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('updater:check is ignored while checking/downloading and for untrusted senders', async () => {
    const { handlers, updaterEvents, autoUpdater } = await loadMain();
    autoUpdater.checkForUpdates.mockClear();
    updaterEvents['checking-for-update']();
    handlers['updater:check'](trusted);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    updaterEvents['update-not-available']();
    handlers['updater:check'](untrusted);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    handlers['updater:check'](trusted);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });
});

describe('main.js updater (disabled)', () => {
  it.each([
    ['unpackaged build', { packaged: false }],
    ['STOREOS_DISABLE_UPDATER=1', { disabled: true }],
  ])('does nothing for %s', async (_name, opts) => {
    const { handlers, autoUpdater } = await loadMain(opts);
    expect(autoUpdater.on).not.toHaveBeenCalled();
    expect(handlers['updater:get-state'](trusted)).toMatchObject({ status: 'disabled' });
    handlers['updater:check'](trusted);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    handlers['updater:download'](trusted);
    handlers['updater:install'](trusted);
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
});
