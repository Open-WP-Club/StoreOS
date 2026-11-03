import { vi } from 'vitest';
import src from '../main.js?raw';
import { startAutoUpdate } from '../updater';

describe('startAutoUpdate', () => {
  it('checks for updates in a packaged build', () => {
    const autoUpdater = { checkForUpdatesAndNotify: vi.fn() };
    expect(startAutoUpdate({ autoUpdater, isDev: false })).toBe(true);
    expect(autoUpdater.checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  });

  it('does nothing in dev', () => {
    const autoUpdater = { checkForUpdatesAndNotify: vi.fn() };
    expect(startAutoUpdate({ autoUpdater, isDev: true })).toBe(false);
    expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });
});

describe('main.js wiring', () => {
  it('registers no updater:* IPC channels', () => {
    expect(src).not.toMatch(/['"]updater:/);
  });
  it('starts the updater via startAutoUpdate', () => {
    expect(src).toMatch(/startAutoUpdate\(\{ autoUpdater, isDev \}\)/);
  });
});
