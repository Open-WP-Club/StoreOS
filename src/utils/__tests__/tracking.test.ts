import { buildTrackingMeta, trackingNote, TRACKING_META_KEY } from '../tracking';

describe('tracking', () => {
  const now = new Date('2026-01-02T03:04:05Z');
  it('builds new meta without ids', () => {
    const m = buildTrackingMeta([], 'AB1', 'Speedy', now);
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({
      key: TRACKING_META_KEY,
      value: { number: 'AB1', carrier: 'Speedy', date: now.toISOString() },
    });
  });
  it('reuses existing meta id', () => {
    const m = buildTrackingMeta([{ id: 7, key: TRACKING_META_KEY, value: {} }], 'AB1', 'X', now);
    expect(m[0]!.id).toBe(7);
    expect(m[1]!.id).toBeUndefined();
  });
  it('writes wc-shipment-tracking shape', () => {
    const m = buildTrackingMeta([], 'AB1', 'Speedy', now);
    expect(m[1]!.value).toEqual([
      { tracking_provider: 'Speedy', tracking_number: 'AB1', date_shipped: '2026-01-02' },
    ]);
  });
  it('formats note', () => {
    expect(trackingNote('AB1', 'Speedy')).toContain('Speedy');
    expect(trackingNote('AB1', '')).not.toContain(' с ');
  });
});
