import { vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '../SettingsPage';
import useAppSettings from '../../stores/appSettingsStore';
import useSettings from '../../stores/settingsStore';

const mockSetLanguage = vi.fn();
const mockSetDefaultPrinter = vi.fn();
const mockSetPinEnabled = vi.fn();
const mockSetPinCode = vi.fn();
const mockSetPinTimeout = vi.fn();
const mockSetNotifyNewOrders = vi.fn();
const mockSetNotifyLowStock = vi.fn();
const mockSetLowStockThreshold = vi.fn();

vi.mock('../../stores/appSettingsStore', () => {
  const mock = vi.fn();
  Object.assign(mock, { getState: vi.fn() });
  return { __esModule: true, default: mock };
});

vi.mock('../../stores/settingsStore', () => {
  const mock = vi.fn();
  return { __esModule: true, default: mock };
});

vi.mock('../../utils/i18n', () => ({
  t: (key: string) => key,
  getSupportedLanguages: () => [
    { code: 'bg', name: 'Български', flag: '🇧🇬' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ],
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    (useAppSettings as unknown as Mock).mockReturnValue({
      language: 'bg',
      setLanguage: mockSetLanguage,
      defaultPrinter: '',
      setDefaultPrinter: mockSetDefaultPrinter,
      pinEnabled: false,
      pinCode: null,
      pinTimeout: 5,
      setPinEnabled: mockSetPinEnabled,
      setPinCode: mockSetPinCode,
      setPinTimeout: mockSetPinTimeout,
    });
    useAppSettings.getState = vi.fn().mockReturnValue({
      verifyPin: vi.fn().mockReturnValue(true),
    });

    (useSettings as unknown as Mock).mockReturnValue({
      notifyNewOrders: true,
      notifyLowStock: true,
      lowStockThreshold: 5,
      setNotifyNewOrders: mockSetNotifyNewOrders,
      setNotifyLowStock: mockSetNotifyLowStock,
      setLowStockThreshold: mockSetLowStockThreshold,
    });
  });

  it('should render settings page title', () => {
    render(<SettingsPage />);
    // t('settingsTitle') returns 'settingsTitle' with our mock
    expect(screen.getByText('settingsTitle')).toBeInTheDocument();
  });

  it('should render language section', () => {
    render(<SettingsPage />);
    // t('languageLabel') returns 'languageLabel'
    expect(screen.getByText('languageLabel')).toBeInTheDocument();
  });

  it('should render security section', () => {
    render(<SettingsPage />);
    // t('securitySection') returns 'securitySection'
    expect(screen.getByText('securitySection')).toBeInTheDocument();
  });

  it('should render notifications section', () => {
    render(<SettingsPage />);
    // Uses inline language check: language === 'bg' ? 'Известия' : 'Notifications'
    expect(screen.getByText('Известия')).toBeInTheDocument();
  });

  it('should change language when clicking language button', () => {
    render(<SettingsPage />);
    // Language selector uses buttons, not <select>
    const englishButton = screen.getByText('English');
    fireEvent.click(englishButton);
    expect(mockSetLanguage).toHaveBeenCalledWith('en');
  });

  it('should show PIN active status when enabled', () => {
    (useAppSettings as unknown as Mock).mockReturnValue({
      language: 'bg',
      setLanguage: mockSetLanguage,
      defaultPrinter: '',
      setDefaultPrinter: mockSetDefaultPrinter,
      pinEnabled: true,
      pinCode: '1234',
      pinTimeout: 5,
      setPinEnabled: mockSetPinEnabled,
      setPinCode: mockSetPinCode,
      setPinTimeout: mockSetPinTimeout,
    });

    render(<SettingsPage />);
    // Shows "PIN е активен" when bg language and pin enabled
    expect(screen.getByText(/е активен/)).toBeInTheDocument();
  });

  it('should update low stock threshold', () => {
    render(<SettingsPage />);
    const thresholdInput = screen.getByDisplayValue('5');
    fireEvent.change(thresholdInput, { target: { value: '10' } });
    expect(mockSetLowStockThreshold).toHaveBeenCalledWith(10);
  });
});
