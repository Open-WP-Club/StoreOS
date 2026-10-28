import useAppSettings, { lockoutMs } from '../../stores/appSettingsStore';
import { hashPin, verifyPinHash, isLegacyHash } from '../pinHash';

// Old weak hash, reproduced to fabricate a pre-migration stored value
function legacy(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = (h << 5) - h + pin.charCodeAt(i);
    h = h & h;
  }
  return h.toString(36);
}

describe('pinHash', () => {
  it('produces salted hashes that verify', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).not.toBe(b);
    expect(isLegacyHash(a)).toBe(false);
    expect(await verifyPinHash('1234', a)).toBe(true);
    expect(await verifyPinHash('1235', a)).toBe(false);
  });

  it('verifies legacy hashes and rejects malformed ones', async () => {
    expect(await verifyPinHash('1234', legacy('1234'))).toBe(true);
    expect(await verifyPinHash('4321', legacy('1234'))).toBe(false);
    expect(await verifyPinHash('1234', 'pbkdf2$abc')).toBe(false);
  });
});

describe('verifyPin migration and throttling', () => {
  beforeEach(() => {
    useAppSettings.setState({
      pinEnabled: true,
      pinCode: null,
      failedPinAttempts: 0,
      pinLockedUntil: null,
    });
  });

  it('upgrades a legacy hash on successful unlock', async () => {
    useAppSettings.setState({ pinCode: legacy('1234') });
    expect(await useAppSettings.getState().verifyPin('1234')).toBe(true);
    expect(isLegacyHash(useAppSettings.getState().pinCode as string)).toBe(false);
    expect(await useAppSettings.getState().verifyPin('1234')).toBe(true);
  });

  it('locks out after repeated failures, even for the right PIN', async () => {
    await useAppSettings.getState().setPinCode('1234');
    for (let i = 0; i < 5; i++) {
      expect(await useAppSettings.getState().verifyPin('0000')).toBe(false);
    }
    const { pinLockedUntil } = useAppSettings.getState();
    expect(pinLockedUntil).toBeGreaterThan(Date.now());
    expect(await useAppSettings.getState().verifyPin('1234')).toBe(false);

    useAppSettings.setState({ pinLockedUntil: Date.now() - 1 });
    expect(await useAppSettings.getState().verifyPin('1234')).toBe(true);
    expect(useAppSettings.getState().failedPinAttempts).toBe(0);
  });

  it('lockout grows and is capped', () => {
    expect(lockoutMs(4)).toBe(0);
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(50)).toBe(15 * 60_000);
  });
});
