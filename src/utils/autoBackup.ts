import useBackupSchedule from '../stores/backupScheduleStore';
import { backupFilename, createBackup, encryptCredentials, verifyBackupText } from './backup';
import { isDue } from './reportSchedule';

/**
 * Run one scheduled backup if due. Credentials are written only AES-GCM encrypted (passphrase set
 * for this session) or omitted entirely; plaintext credentials never reach disk.
 */
export async function runAutoBackup(now: Date): Promise<void> {
  const cfg = useBackupSchedule.getState();
  const api = window.electronAPI;
  if (!cfg.enabled || !api?.backups || !isDue(now, cfg, cfg.lastRun)) return;

  // Mark first: a slow or failing run must not retrigger every minute.
  useBackupSchedule.setState({ lastRun: now.getTime() });
  let message: string;
  let ok = false;
  try {
    let backup = createBackup({ includeProducts: cfg.includeProducts });
    if (cfg.passphrase) backup = await encryptCredentials(backup, cfg.passphrase);
    const res = await api.backups.save(backupFilename(now), JSON.stringify(backup), cfg.keep);
    ok = res.success;
    message = ok
      ? cfg.passphrase
        ? 'Saved (credentials encrypted)'
        : 'Saved (credentials not included: no passphrase set this session)'
      : (res.error ?? 'unknown error');
  } catch (e) {
    message = e instanceof Error ? e.message : 'unknown error';
  }
  useBackupSchedule.setState({ lastResult: { at: Date.now(), ok, message } });
}

/** Read the newest backup in the backup folder and prove it decrypts + validates. */
export async function verifyLastBackup(
  passphrase: string
): Promise<{ name: string; createdAt: string; storesCount: number; encrypted: boolean }> {
  const api = window.electronAPI;
  if (!api?.backups) throw new Error('Backups are only available in the desktop app');
  const res = await api.backups.readLatest();
  if (!res.success || !res.data || !res.name) throw new Error(res.error ?? 'No backup found');
  return { name: res.name, ...(await verifyBackupText(res.data, passphrase)) };
}
