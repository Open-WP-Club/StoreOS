import path from 'path';

// Auto-backups are named by us, e.g. storeos-backup-20261102-1830.json. Anything else is rejected.
const BACKUP_RE = /^storeos-backup-\d{8}-\d{4}\.json$/;

// Returns the name if it is a valid backup filename (no separators, fixed pattern), else null.
export function sanitizeBackupFilename(name) {
  return typeof name === 'string' && BACKUP_RE.test(name) ? name : null;
}

// Joins dir + validated name and verifies the result stays directly inside dir.
export function resolveBackupPath(dir, name) {
  const safe = sanitizeBackupFilename(name);
  if (!safe || typeof dir !== 'string' || !path.isAbsolute(dir)) return null;
  const root = path.resolve(dir);
  const full = path.resolve(root, safe);
  return path.dirname(full) === root ? full : null;
}

// Valid backup names, oldest first (timestamp in the name sorts lexicographically).
export function listBackupNames(names) {
  return names.filter((n) => BACKUP_RE.test(n)).sort();
}

// Names to delete so only the newest `keep` (>= 1) remain.
export function selectPrune(names, keep) {
  const k = Math.max(1, Math.floor(Number(keep)) || 1);
  const all = listBackupNames(names);
  return all.slice(0, Math.max(0, all.length - k));
}
