import { sanitizeNotificationPayload as v } from '../ipcValidation';

describe('sanitizeNotificationPayload', () => {
  it('accepts valid payloads', () => {
    expect(v({ title: 'Hi', body: 'There', route: '/orders/12' })).toEqual({
      title: 'Hi',
      body: 'There',
      route: '/orders/12',
    });
    expect(v({ title: 'Hi', body: '' })).toBeTruthy();
  });

  it('rejects malformed payloads', () => {
    expect(v(null)).toBeNull();
    expect(v('x')).toBeNull();
    expect(v({ title: 1, body: 'b' })).toBeNull();
    expect(v({ title: '', body: 'b' })).toBeNull();
    expect(v({ title: 'a'.repeat(501), body: 'b' })).toBeNull();
  });

  it('rejects non in-app routes', () => {
    for (const route of ['https://evil.com', '//evil.com', 'javascript:alert(1)', 5]) {
      expect(v({ title: 't', body: 'b', route })).toBeNull();
    }
  });
});
