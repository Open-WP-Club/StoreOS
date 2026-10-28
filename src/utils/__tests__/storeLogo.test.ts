import { vi } from 'vitest';
import { fetchStoreLogo, getStoreLogo } from '../storeLogo';

const json = (body: unknown, ok = true) =>
  ({ ok, headers: new Headers(), json: async () => body }) as Response;

describe('fetchStoreLogo', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns site_icon_url and sends no credentials', async () => {
    fetchMock.mockResolvedValue(json({ site_icon_url: 'https://shop.test/icon.png' }));
    expect(await fetchStoreLogo('shop.test')).toBe('https://shop.test/icon.png');
    expect(fetchMock.mock.calls[0]![0]).toBe('https://shop.test/wp-json/');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ credentials: 'omit' });
  });

  it('prefers site_logo media when resolvable', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ site_logo: 5, site_icon_url: 'https://shop.test/i.png' }))
      .mockResolvedValueOnce(json({ source_url: 'https://shop.test/logo.png' }));
    expect(await fetchStoreLogo('https://shop.test')).toBe('https://shop.test/logo.png');
  });

  it('returns null when there is no icon', async () => {
    fetchMock.mockResolvedValue(json({ site_icon_url: '' }));
    expect(await fetchStoreLogo('https://shop.test')).toBeNull();
  });

  it('rejects non-https and javascript URLs', async () => {
    fetchMock.mockResolvedValue(json({ site_icon_url: 'http://shop.test/i.png' }));
    expect(await fetchStoreLogo('https://shop.test')).toBeNull();
    fetchMock.mockResolvedValue(json({ site_icon_url: 'javascript:alert(1)' }));
    expect(await fetchStoreLogo('https://shop.test')).toBeNull();
  });

  it('returns null on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    expect(await fetchStoreLogo('https://shop.test')).toBeNull();
  });

  it('caches per store and refetches when the URL changes', async () => {
    fetchMock.mockResolvedValue(json({ site_icon_url: 'https://shop.test/i.png' }));
    await getStoreLogo('s1', 'https://shop.test');
    await getStoreLogo('s1', 'https://shop.test');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getStoreLogo('s1', 'https://other.test');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
