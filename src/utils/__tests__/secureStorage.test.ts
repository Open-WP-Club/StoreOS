import { createSecureStorage } from '../secureStorage';

const fakeApi = {
  encrypt: (t: string) => btoa(`k:${t}`),
  decrypt: (b: string) => atob(b).slice(2),
};
const nullApi = { encrypt: () => null, decrypt: () => null };
const setApi = (secureStorage: unknown): void => {
  window.electronAPI = { secureStorage } as unknown as Window['electronAPI'];
};

describe('createSecureStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.electronAPI = undefined;
  });
  afterEach(() => {
    window.electronAPI = undefined;
  });

  it('falls back to plaintext without Electron', () => {
    const s = createSecureStorage();
    s.setItem('k', '{"a":1}');
    expect(localStorage.getItem('k')).toBe('{"a":1}');
    expect(s.getItem('k')).toBe('{"a":1}');
  });

  it('encrypts at rest and round-trips in Electron', () => {
    setApi(fakeApi);
    const s = createSecureStorage();
    s.setItem('k', '{"consumerSecret":"cs_test"}');
    const raw = localStorage.getItem('k') as string;
    expect(raw.startsWith('enc:v1:')).toBe(true);
    expect(raw).not.toContain('cs_test');
    expect(s.getItem('k')).toBe('{"consumerSecret":"cs_test"}');
  });

  it('migrates legacy plaintext transparently', () => {
    localStorage.setItem('k', '{"consumerSecret":"cs_test"}');
    setApi(fakeApi);
    expect(createSecureStorage().getItem('k')).toBe('{"consumerSecret":"cs_test"}');
    expect(localStorage.getItem('k')).toMatch(/^enc:v1:/);
  });

  it('returns null when the keychain cannot decrypt', () => {
    localStorage.setItem('k', 'enc:v1:abc');
    setApi(nullApi);
    expect(createSecureStorage().getItem('k')).toBeNull();
  });

  it('keeps plaintext when encryption is unavailable', () => {
    setApi(nullApi);
    createSecureStorage().setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
  });
});
