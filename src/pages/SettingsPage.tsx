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
import SettingsAutoBackup from '../components/settings/SettingsAutoBackup';
import SettingsScheduledReports from '../components/settings/SettingsScheduledReports';
import SettingsUpdates from '../components/settings/SettingsUpdates';
import SettingsBackup from '../components/settings/SettingsBackup';

export default function SettingsPage(): ReactElement {
  const {
    language,
    setLanguage,
    defaultPrinter,
    setDefaultPrinter,
    autoPrintReceipt,
    setAutoPrintReceipt,
    receiptVatRate,
    receiptShowLogo,
    setReceiptShowLogo,
    setReceiptVatRate,
    openCashDrawer,
    setOpenCashDrawer,
    syncCustomerProfile,
    setSyncCustomerProfile,
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
          autoPrintReceipt={autoPrintReceipt}
          setAutoPrintReceipt={setAutoPrintReceipt}
          receiptShowLogo={receiptShowLogo}
          setReceiptShowLogo={setReceiptShowLogo}
          receiptVatRate={receiptVatRate}
          setReceiptVatRate={setReceiptVatRate}
          openCashDrawer={openCashDrawer}
          setOpenCashDrawer={setOpenCashDrawer}
        />

        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={syncCustomerProfile}
              onChange={(e) => setSyncCustomerProfile(e.target.checked)}
            />
            <span>
              {language === 'bg'
                ? 'Синхронизирай тагове и бележки на клиенти с WooCommerce (meta_data). Изключено = остават само локално.'
                : 'Sync customer tags and notes to WooCommerce (customer meta_data). Off = stays local only.'}
            </span>
          </label>
        </section>

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

        <SettingsScheduledReports language={language} />

        <SettingsBackup language={language} showToast={showToast} />

        <SettingsAutoBackup language={language} showToast={showToast} />

        <SettingsUpdates language={language} />
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
