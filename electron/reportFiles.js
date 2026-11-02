import path from 'path';

const MAX_NAME = 120;
const ALLOWED_EXT = new Set(['.csv', '.pdf']);

// Returns a bare, safe filename (.csv/.pdf only) or null. No separators, no dot-names.
export function sanitizeReportFilename(name) {
  if (typeof name !== 'string') return null;
  const base = name.trim();
  if (!base || base.length > MAX_NAME) return null;
  if (!/^[\w][\w .\-()]*$/u.test(base) || base.includes('..')) return null;
  if (!ALLOWED_EXT.has(path.extname(base).toLowerCase())) return null;
  return base;
}

// Joins dir + sanitized name and verifies the result stays directly inside dir.
export function resolveReportPath(dir, name) {
  const safe = sanitizeReportFilename(name);
  if (!safe || typeof dir !== 'string' || !path.isAbsolute(dir)) return null;
  const root = path.resolve(dir);
  const full = path.resolve(root, safe);
  return path.dirname(full) === root ? full : null;
}
