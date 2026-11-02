import { useEffect } from 'react';
import { runAutoBackup } from '../utils/autoBackup';

const CHECK_MS = 60_000;

/** Headless: runs the due automatic backup while the app is open (and one catch-up on startup). */
function ScheduledBackupRunner(): null {
  useEffect(() => {
    const tick = (): void => {
      runAutoBackup(new Date()).catch((e) => {
        // eslint-disable-next-line no-console
        console.error('Scheduled backup failed', e instanceof Error ? e.message : 'unknown');
      });
    };
    tick();
    const id = setInterval(tick, CHECK_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}

export default ScheduledBackupRunner;
