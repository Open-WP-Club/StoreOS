import { sanitizeBackupFilename as s, resolveBackupPath as r, selectPrune } from '../backupFiles';

describe('backupFiles', () => {
  it('accepts only the generated pattern', () => {
    expect(s('storeos-backup-20261102-1830.json')).not.toBeNull();
    for (const bad of [
      '../storeos-backup-20261102-1830.json',
      'a.json',
      'x.csv',
      '',
      null,
      'storeos-backup-1-1.json',
    ])
      expect(s(bad)).toBeNull();
  });
  it('resolves inside dir only, absolute dir required', () => {
    expect(r('/tmp/b', 'storeos-backup-20261102-1830.json')).toBe(
      '/tmp/b/storeos-backup-20261102-1830.json'
    );
    expect(r('rel', 'storeos-backup-20261102-1830.json')).toBeNull();
    expect(r('/tmp/b', '../x.json')).toBeNull();
  });
  it('prunes oldest, keeps newest N, ignores foreign files', () => {
    const n = [
      'storeos-backup-20261103-0900.json',
      'storeos-backup-20261101-0900.json',
      'notes.txt',
      'storeos-backup-20261102-0900.json',
    ];
    expect(selectPrune(n, 2)).toEqual(['storeos-backup-20261101-0900.json']);
    expect(selectPrune(n, 5)).toEqual([]);
    expect(selectPrune(n, 0)).toHaveLength(2); // keep is clamped to >= 1
  });
});
