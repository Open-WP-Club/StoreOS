// Auto-update startup, extracted from main.js so it can be unit-tested with injected deps.
// Checks GitHub releases (package.json "build.publish"), downloads in the background and shows
// a native notification when ready to install on quit. Skipped in dev / unpackaged runs.
// There are no updater:* IPC channels: the renderer cannot trigger or observe updates.
export function startAutoUpdate({ autoUpdater, isDev }) {
  if (isDev) return false;
  autoUpdater.checkForUpdatesAndNotify();
  return true;
}
