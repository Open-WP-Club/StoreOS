import { memo } from 'react';
import { Bell, Volume2, Trash2 } from 'lucide-react';
import type { Language } from '../../utils/i18n';

interface SettingsNotificationsProps {
  language: Language;
  notifyNewOrders: boolean;
  setNotifyNewOrders: (v: boolean) => void;
  notifyLowStock: boolean;
  setNotifyLowStock: (v: boolean) => void;
  lowStockThreshold: number;
  setLowStockThreshold: (v: number) => void;
  orderSplitDays: number;
  setOrderSplitDays: (v: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  confettiEnabled: boolean;
  setConfettiEnabled: (v: boolean) => void;
  notifications: unknown[];
  clearNotifications: () => void;
  onClearNotifications: () => void;
}

const SettingsNotifications = memo(function SettingsNotifications({
  language,
  notifyNewOrders,
  setNotifyNewOrders,
  notifyLowStock,
  setNotifyLowStock,
  lowStockThreshold,
  setLowStockThreshold,
  orderSplitDays,
  setOrderSplitDays,
  soundEnabled,
  setSoundEnabled,
  confettiEnabled,
  setConfettiEnabled,
  notifications,
  onClearNotifications,
}: SettingsNotificationsProps) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {language === 'bg' ? 'Известия' : 'Notifications'}
        </h2>
      </div>

      <div className="space-y-4">
        {/* New Orders Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {language === 'bg' ? 'Нови поръчки' : 'New orders'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {language === 'bg'
                ? 'Получавай известие при нова поръчка'
                : 'Get notified when new orders arrive'}
            </p>
          </div>
          <button
            type="button"
            className={`w-12 h-6 rounded-full transition-colors ${
              notifyNewOrders ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={() => setNotifyNewOrders(!notifyNewOrders)}
            aria-label={
              notifyNewOrders
                ? 'Disable new order notifications'
                : 'Enable new order notifications'
            }
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mt-0.5 ${
                notifyNewOrders ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Low Stock Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {language === 'bg' ? 'Нисък запас' : 'Low stock'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {language === 'bg'
                ? 'Известие при продукти с нисък запас'
                : 'Get notified when products are running low'}
            </p>
          </div>
          <button
            type="button"
            className={`w-12 h-6 rounded-full transition-colors ${
              notifyLowStock ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={() => setNotifyLowStock(!notifyLowStock)}
            aria-label={
              notifyLowStock ? 'Disable low stock notifications' : 'Enable low stock notifications'
            }
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mt-0.5 ${
                notifyLowStock ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Business Thresholds */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {language === 'bg' ? 'Бизнес прагове' : 'Business thresholds'}
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400 flex-1">
              {language === 'bg' ? 'Праг за нисък запас' : 'Low stock threshold'}
              <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {language === 'bg'
                  ? 'Продукти с наличност под тази стойност се маркират като "нисък запас"'
                  : 'Products with stock below this value are flagged as low stock'}
              </span>
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 5)}
              className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white text-center"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
              {language === 'bg' ? 'бр.' : 'units'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400 flex-1">
              {language === 'bg' ? 'Период за скорошни поръчки' : 'Recent orders window'}
              <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {language === 'bg'
                  ? 'Поръчки в рамките на този период се считат за "скорошни" в таблото'
                  : 'Orders within this period are shown as recent in the dashboard'}
              </span>
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={orderSplitDays}
              onChange={(e) => setOrderSplitDays(parseInt(e.target.value) || 7)}
              className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white text-center"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
              {language === 'bg' ? 'дни' : 'days'}
            </span>
          </div>
        </div>

        {/* Sound Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {language === 'bg' ? 'Звук при известие' : 'Notification sound'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'bg'
                  ? 'Възпроизвеждай звук при ново известие'
                  : 'Play a chime when notifications arrive'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={`w-12 h-6 rounded-full transition-colors ${
              soundEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? 'Disable notification sound' : 'Enable notification sound'}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mt-0.5 ${
                soundEnabled ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Confetti Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🎉</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {language === 'bg' ? 'Конфети при нова поръчка' : 'Order celebration'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'bg'
                  ? 'Показвай конфети и popup при нова поръчка'
                  : 'Show confetti and popup when a new order arrives'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={`w-12 h-6 rounded-full transition-colors ${
              confettiEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={() => setConfettiEnabled(!confettiEnabled)}
            aria-label={confettiEnabled ? 'Disable order celebration' : 'Enable order celebration'}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mt-0.5 ${
                confettiEnabled ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Clear Notification History */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {language === 'bg' ? 'История на известията' : 'Notification history'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {notifications.length} {language === 'bg' ? 'известия' : 'notifications'}
                </p>
              </div>
            </div>
            <button
              onClick={onClearNotifications}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              {language === 'bg' ? 'Изчисти' : 'Clear'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

export default SettingsNotifications;
