import { ReactElement } from 'react';
import { Settings } from 'lucide-react';
import useAppSettings from '../stores/appSettingsStore';
import useSettings from '../stores/settingsStore';
import useNotifications from '../stores/notificationStore';
import { t } from '../utils/i18n';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';
import SettingsLanguage from '../components/settings/SettingsLanguage';
import SettingsPrinter from '../components/settings/SettingsPrinter';
import SettingsNotifications from '../components/settings/SettingsNotifications';
import SettingsSecurity from '../components/settings/SettingsSecurity';
import SettingsBackup from '../components/settings/SettingsBackup';

export default function SettingsPage(): ReactElement {
  const {
    language,
    setLanguage,
    defaultPrinter,
    setDefaultPrinter,
    pinEnabled,
    pinCode,
    pinTimeout,
    setPinEnabled,
    setPinCode,
    setPinTimeout,
  } = useAppSettings();

  const {
    notifyNewOrders,
    notifyLowStock,
    lowStockThreshold,
    orderSplitDays,
    setNotifyNewOrders,
    setNotifyLowStock,
    setLowStockThreshold,
    setOrderSplitDays,
  } = useSettings();

  const {
    soundEnabled,
    setSoundEnabled,
    confettiEnabled,
    setConfettiEnabled,
    notifications,
    clearAll: clearNotifications,
  } = useNotifications();

  const { toasts, showToast, removeToast } = useToast();

  const handleClearNotifications = (): void => {
    clearNotifications();
    showToast(
      language === 'bg' ? 'Историята е изчистена' : 'Notification history cleared',
      'success'
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('settingsTitle', language)}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {language === 'bg' ? 'Конфигурирай приложението' : 'Configure the application'}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <SettingsLanguage language={language} setLanguage={setLanguage} />

        <SettingsPrinter
          language={language}
          defaultPrinter={defaultPrinter}
          setDefaultPrinter={setDefaultPrinter}
        />

        <SettingsNotifications
          language={language}
          notifyNewOrders={notifyNewOrders}
          setNotifyNewOrders={setNotifyNewOrders}
          notifyLowStock={notifyLowStock}
          setNotifyLowStock={setNotifyLowStock}
          lowStockThreshold={lowStockThreshold}
          setLowStockThreshold={setLowStockThreshold}
          orderSplitDays={orderSplitDays}
          setOrderSplitDays={setOrderSplitDays}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          confettiEnabled={confettiEnabled}
          setConfettiEnabled={setConfettiEnabled}
          notifications={notifications}
          clearNotifications={clearNotifications}
          onClearNotifications={handleClearNotifications}
        />

        <SettingsSecurity
          language={language}
          pinEnabled={pinEnabled}
          pinCode={pinCode}
          pinTimeout={pinTimeout}
          setPinEnabled={setPinEnabled}
          setPinCode={setPinCode}
          setPinTimeout={setPinTimeout}
        />

        <SettingsBackup language={language} showToast={showToast} />
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
