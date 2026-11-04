import useAppSettings from '../appSettingsStore';

describe('appSettingsStore persistence', () => {
  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    localStorage.clear();
  });

  it('encrypts the persisted blob (fiscal password) when the keychain is available', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      secureStorage: {
        encrypt: (v: string) => Buffer.from(v).toString('base64'),
        decrypt: (v: string) => Buffer.from(v, 'base64').toString(),
      },
    };
    useAppSettings.getState().setFiscal({ password: '7391' });
    await Promise.resolve();
    const raw = localStorage.getItem('woocommerce-app-settings') ?? '';
    expect(raw.startsWith('enc:v1:')).toBe(true);
    expect(raw).not.toContain('7391');
  });
});
