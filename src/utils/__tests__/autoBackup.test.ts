import { createBackup, encryptCredentials, verifyBackupText, backupFilename } from '../backup';
import { runAutoBackup } from '../autoBackup';
import useBackupSchedule from '../../stores/backupScheduleStore';
import useStoreConfig from '../../stores/storeConfigStore';
import { validateWebhookInput } from '../webhookValidation';

const SECRET = 'cs_test_supersecret';

beforeEach(() => {
  useStoreConfig.setState({
    stores: [
      {
        id: 's1',
        name: 'Shop',
        url: 'https://shop.example.com',
        consumerKey: 'ck_test_key',
        consumerSecret: SECRET,
      },
    ] as never,
    currentStoreId: 's1',
  });
});

describe('encrypted backup round-trip', () => {
  it('never contains plaintext credentials and verifies with the right passphrase', async () => {
    const enc = await encryptCredentials(createBackup({ includeProducts: false }), 'correct horse');
    const text = JSON.stringify(enc);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('ck_test_key');
    const r = await verifyBackupText(text, 'correct horse');
    expect(r).toMatchObject({ storesCount: 1, encrypted: true });
  });

  it('rejects wrong or missing passphrase and invalid files', async () => {
    const text = JSON.stringify(
      await encryptCredentials(createBackup({ includeProducts: false }), 'pw-one')
    );
    await expect(verifyBackupText(text, 'pw-two')).rejects.toThrow(/Wrong passphrase/);
    await expect(verifyBackupText(text, '')).rejects.toThrow(/Passphrase required/);
    await expect(verifyBackupText('{nope', 'x')).rejects.toThrow(/not valid JSON/);
    await expect(verifyBackupText('{"appName":"x"}', 'x')).rejects.toThrow(/wrong application/);
  });

  it('plain (credential-free) backup verifies without passphrase', async () => {
    const text = JSON.stringify(createBackup({ includeProducts: false }));
    expect(text).not.toContain(SECRET);
    expect((await verifyBackupText(text, '')).encrypted).toBe(false);
  });
});

describe('backupFilename', () => {
  it('matches the main-process pattern', () => {
    expect(backupFilename(new Date(2026, 10, 2, 3, 5))).toBe('storeos-backup-20261102-0305.json');
  });
});

describe('runAutoBackup', () => {
  const save = vi.fn();
  const base = { enabled: true, frequency: 'daily' as const, time: '03:00', keep: 3 };
  const now = new Date(2026, 10, 2, 12, 0);

  beforeEach(() => {
    save.mockResolvedValue({ success: true });
    (window as unknown as { electronAPI: unknown }).electronAPI = { backups: { save } };
  });
  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it('does nothing when not due, and saves once when due (passing keep)', async () => {
    useBackupSchedule.setState({ ...base, lastRun: now.getTime(), passphrase: '' });
    await runAutoBackup(now);
    expect(save).not.toHaveBeenCalled();

    useBackupSchedule.setState({ lastRun: new Date(2026, 10, 1, 12, 0).getTime() });
    await runAutoBackup(now);
    await runAutoBackup(now); // lastRun was marked: no repeat
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toBe('storeos-backup-20261102-1200.json');
    expect(save.mock.calls[0]?.[2]).toBe(3);
  });

  it('writes no plaintext credentials with or without passphrase', async () => {
    for (const passphrase of ['', 'pw-123456']) {
      save.mockClear();
      useBackupSchedule.setState({ ...base, passphrase, lastRun: new Date(2026, 10, 1).getTime() });
      await runAutoBackup(now);
      const written = save.mock.calls[0]?.[1] as string;
      expect(written).not.toContain(SECRET);
      expect(written.includes('encryptedCredentials')).toBe(!!passphrase);
    }
  });

  it('records failures', async () => {
    save.mockResolvedValue({ success: false, error: 'disk full' });
    useBackupSchedule.setState({
      ...base,
      passphrase: '',
      lastRun: new Date(2026, 10, 1).getTime(),
    });
    await runAutoBackup(now);
    expect(useBackupSchedule.getState().lastResult).toMatchObject({
      ok: false,
      message: 'disk full',
    });
  });

  it('does not persist the passphrase', () => {
    useBackupSchedule.setState({ passphrase: 'topsecret1' });
    expect(localStorage.getItem('backup-schedule') ?? '').not.toContain('topsecret1');
  });
});

describe('validateWebhookInput', () => {
  const ok = { name: 'n', topic: 'order.created', delivery_url: 'https://hook.example.com/x' };
  it('accepts valid input', () => expect(validateWebhookInput(ok)).toEqual({}));
  it('rejects non-https, credentials in URL, bad topic, blank name, short secret', () => {
    expect(validateWebhookInput({ ...ok, delivery_url: 'http://x.com' }).delivery_url).toBeTruthy();
    expect(
      validateWebhookInput({ ...ok, delivery_url: 'javascript:alert(1)' }).delivery_url
    ).toBeTruthy();
    expect(
      validateWebhookInput({ ...ok, delivery_url: 'https://u:p@x.com' }).delivery_url
    ).toBeTruthy();
    expect(validateWebhookInput({ ...ok, delivery_url: 'nonsense' }).delivery_url).toBeTruthy();
    expect(validateWebhookInput({ ...ok, topic: 'order.exploded' }).topic).toBeTruthy();
    expect(validateWebhookInput({ ...ok, name: '  ' }).name).toBeTruthy();
    expect(validateWebhookInput({ ...ok, secret: 'short' }).secret).toBeTruthy();
  });
});
