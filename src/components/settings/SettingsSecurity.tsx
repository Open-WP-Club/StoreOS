import { memo, useState } from 'react';
import { Lock, Shield, Check, X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { t } from '../../utils/i18n';
import type { Language } from '../../utils/i18n';
import useAppSettings from '../../stores/appSettingsStore';

interface SettingsSecurityProps {
  language: Language;
  pinEnabled: boolean;
  pinCode: string | null;
  pinTimeout: number;
  setPinEnabled: (v: boolean) => void;
  setPinCode: (v: string | null) => void;
  setPinTimeout: (v: number) => void;
}

const SettingsSecurity = memo(function SettingsSecurity({
  language,
  pinEnabled,
  pinCode,
  pinTimeout,
  setPinEnabled,
  setPinCode,
  setPinTimeout,
}: SettingsSecurityProps) {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState<'setup' | 'change' | 'remove'>('setup');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);

  const resetPinForm = (): void => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setShowPin(false);
  };

  const openPinModal = (mode: 'setup' | 'change' | 'remove'): void => {
    setPinMode(mode);
    resetPinForm();
    setShowPinModal(true);
  };

  const handlePinSubmit = (): void => {
    setPinError('');

    if (pinMode === 'change' || pinMode === 'remove') {
      if (!currentPin) {
        setPinError('Въведи текущия PIN');
        return;
      }
      const { verifyPin } = useAppSettings.getState();
      if (!verifyPin(currentPin)) {
        setPinError(t('pinIncorrect', language));
        return;
      }
    }

    if (pinMode === 'remove') {
      setPinCode(null);
      setPinEnabled(false);
      setShowPinModal(false);
      resetPinForm();
      return;
    }

    if (newPin.length < 4) {
      setPinError(t('pinTooShort', language));
      return;
    }

    if (newPin !== confirmPin) {
      setPinError(t('pinMismatch', language));
      return;
    }

    setPinCode(newPin);
    setPinEnabled(true);
    setShowPinModal(false);
    resetPinForm();
  };

  return (
    <>
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('securitySection', language)}
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {t('pinLockLabel', language)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('pinLockDescription', language)}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={`w-12 h-6 rounded-full transition-colors ${
                pinEnabled && pinCode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              onClick={() => {
                if (pinEnabled && pinCode) {
                  openPinModal('remove');
                } else {
                  openPinModal('setup');
                }
              }}
              aria-label={pinEnabled && pinCode ? 'Disable PIN' : 'Enable PIN'}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mt-0.5 ${
                  pinEnabled && pinCode ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {pinEnabled && pinCode && (
            <div className="ml-8 space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span className="text-sm">PIN {language === 'bg' ? 'е активен' : 'is active'}</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  {t('pinTimeoutLabel', language)}
                </label>
                <select
                  value={pinTimeout}
                  onChange={(e) => setPinTimeout(parseInt(e.target.value))}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                  <option value={120}>120</option>
                </select>
              </div>

              <button
                onClick={() => openPinModal('change')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('pinChange', language)}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* PIN Setup Modal */}
      {showPinModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="presentation"
          onClick={() => setShowPinModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowPinModal(false)}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5" />
                {pinMode === 'setup' && t('pinSetup', language)}
                {pinMode === 'change' && t('pinChange', language)}
                {pinMode === 'remove' && t('pinRemove', language)}
              </h3>
              <button
                onClick={() => setShowPinModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {(pinMode === 'change' || pinMode === 'remove') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('pinCurrent', language)}
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={currentPin}
                      onChange={(e) =>
                        setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {pinMode !== 'remove' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('pinNew', language)}
                    </label>
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                      maxLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('pinConfirm', language)}
                    </label>
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={confirmPin}
                      onChange={(e) =>
                        setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                      maxLength={6}
                    />
                  </div>
                </>
              )}

              {pinError && (
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('cancel', language)}
                </button>
                <button
                  onClick={handlePinSubmit}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                    pinMode === 'remove'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {pinMode === 'remove' ? t('delete', language) : t('save', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default SettingsSecurity;
