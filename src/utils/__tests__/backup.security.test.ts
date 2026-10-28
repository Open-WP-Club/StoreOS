import useStoreConfig from '../../stores/storeConfigStore';
import { createBackup, encryptCredentials, decryptCredentials, restoreBackup } from '../backup';

const store = {
  id: 's1',
  name: 'Shop',
  url: 'https://example.com',
  consumerKey: 'ck_test_abc',
  consumerSecret: 'cs_test_xyz',
  createdAt: '2024-01-01',
};

describe('backup credentials', () => {
  beforeEach(() => {
    useStoreConfig.setState({ stores: [store as never], currentStoreId: 's1' });
  });

  it('excludes credentials by default', () => {
    const json = JSON.stringify(createBackup({ includeProducts: false }));
    expect(json).not.toContain('ck_test_abc');
    expect(json).not.toContain('cs_test_xyz');
  });

  it('encrypts credentials with a passphrase and restores them', async () => {
    const enc = await encryptCredentials(createBackup({ includeProducts: false }), 'hunter2');
    expect(JSON.stringify(enc)).not.toContain('cs_test_xyz');

    await expect(decryptCredentials(enc, 'wrong')).rejects.toThrow();

    const dec = await decryptCredentials(enc, 'hunter2');
    useStoreConfig.setState({ stores: [], currentStoreId: null });
    restoreBackup(dec);
    expect(useStoreConfig.getState().stores[0]?.consumerSecret).toBe('cs_test_xyz');
  });

  it('restoring a credential-less backup keeps existing credentials', () => {
    restoreBackup(createBackup({ includeProducts: false }));
    const restored = useStoreConfig.getState().stores[0];
    expect(restored?.consumerKey).toBe('ck_test_abc');
    expect(restored?.consumerSecret).toBe('cs_test_xyz');
  });
});
