import { ReactElement, useState, useEffect } from 'react';
import { Lock, X, AlertCircle } from 'lucide-react';
import useAppSettings from '../stores/appSettingsStore';
import appIcon from '../../assets/icon.svg';

export default function PinLockScreen(): ReactElement | null {
  const isLocked = useAppSettings((state) => state.isLocked);
  const pinEnabled = useAppSettings((state) => state.pinEnabled);
  const pinCode = useAppSettings((state) => state.pinCode);
  const verifyPin = useAppSettings((state) => state.verifyPin);
  const unlock = useAppSettings((state) => state.unlock);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const shouldShow = isLocked && pinEnabled && pinCode;

  const handleKeyPress = (key: string): void => {
    if (!shouldShow) return;

    setError('');
    if (key === 'clear') {
      setPin('');
    } else if (key === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
    } else if (pin.length < 6) {
      const newPin = pin + key;
      setPin(newPin);

      // Auto-submit when 4+ digits entered
      if (newPin.length >= 4) {
        setTimeout(async () => {
          if (await verifyPin(newPin)) {
            unlock();
            setPin('');
          } else {
            const { pinLockedUntil } = useAppSettings.getState();
            const secs = pinLockedUntil ? Math.ceil((pinLockedUntil - Date.now()) / 1000) : 0;
            setError(secs > 0 ? `Твърде много опити. Опитай след ${secs} сек.` : 'Грешен PIN код');
            setShake(true);
            setTimeout(() => {
              setShake(false);
              setPin('');
            }, 500);
          }
        }, 100);
      }
    }
  };

  // Keyboard support
  useEffect(() => {
    if (!shouldShow) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('backspace');
      } else if (e.key === 'Escape') {
        handleKeyPress('clear');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Don't render if not locked or PIN not set up
  if (!shouldShow) {
    return null;
  }

  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'];

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-[9999]">
      <div className={`text-center ${shake ? 'animate-shake' : ''}`}>
        {/* Logo */}
        <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-gray-700">
          <img src={appIcon} alt="" aria-hidden="true" className="w-12 h-12 object-contain" />
        </div>

        {/* Lock Icon */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Lock className="w-5 h-5 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Заключено</h2>
        </div>

        <p className="text-gray-500 dark:text-gray-400 mb-8">Въведи PIN код за достъп</p>

        {/* PIN Display */}
        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                pin.length > i
                  ? 'bg-blue-500 border-blue-500 scale-110'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center justify-center gap-2 mb-4 text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-64 mx-auto">
          {numpadKeys.map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className={`h-16 rounded-xl font-semibold text-xl transition-all duration-150 active:scale-95 ${
                key === 'clear'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                  : key === 'backspace'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {key === 'clear' ? (
                <X className="w-6 h-6 mx-auto" />
              ) : key === 'backspace' ? (
                '⌫'
              ) : (
                key
              )}
            </button>
          ))}
        </div>

        {/* Hint */}
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-6">
          Натисни цифри на клавиатурата или използвай бутоните
        </p>
      </div>

      {/* CSS for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
