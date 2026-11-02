import { memo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import useBackupSchedule from '../../stores/backupScheduleStore';
import type { Language } from '../../utils/i18n';
import type { ToastType } from '../../types/ui';
import { nextRun } from '../../utils/reportSchedule';
import { verifyLastBackup } from '../../utils/autoBackup';

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_BG = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];

const field =
  'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const SettingsAutoBackup = memo(function SettingsAutoBackup({
  language,
  showToast,
}: {
  language: Language;
  showToast: (msg: string, type?: ToastType) => void;
}) {
  const cfg = useBackupSchedule();
  const [verifying, setVerifying] = useState(false);
  const tr = (en: string, b: string): string => (language === 'bg' ? b : en);
  const canUseFs = !!window.electronAPI?.backups;

  const chooseDir = async (): Promise<void> => {
    const dir = await window.electronAPI?.backups.chooseDir();
    if (dir) cfg.update({ outputDir: dir });
  };

  const verify = async (): Promise<void> => {
    setVerifying(true);
    try {
      const r = await verifyLastBackup(cfg.passphrase);
      showToast(
        `${r.name}: OK (${r.storesCount} ${tr('stores', 'магазина')}, ${
          r.encrypted
            ? tr('credentials decrypted', 'ключовете са декриптирани')
            : tr('no credentials', 'без ключове')
        })`,
        'success'
      );
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : tr('Verification failed', 'Проверката е неуспешна'),
        'error'
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr('Automatic backup', 'Автоматичен backup')}
        </h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {tr(
          'Runs only while the app is open. API keys are saved only encrypted with the passphrase below; the passphrase is kept in memory for this session only, so without it backups contain no API keys.',
          'Работи само докато приложението е отворено. API ключовете се записват само криптирани с паролата по-долу; паролата се пази само в паметта за тази сесия, без нея backup-ите не съдържат API ключове.'
        )}
      </p>

      <label className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white">
        <input
          type="checkbox"
          checked={cfg.enabled}
          disabled={!canUseFs || !cfg.outputDir}
          onChange={(e) => cfg.update({ enabled: e.target.checked })}
        />
        {tr('Enable automatic backup', 'Включи автоматичен backup')}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="ab-freq">
            {tr('Frequency', 'Честота')}
          </label>
          <select
            id="ab-freq"
            className={field}
            value={cfg.frequency}
            onChange={(e) => cfg.update({ frequency: e.target.value as typeof cfg.frequency })}
          >
            <option value="daily">{tr('Daily', 'Ежедневно')}</option>
            <option value="weekly">{tr('Weekly', 'Седмично')}</option>
          </select>
        </div>
        <div className="flex gap-2">
          {cfg.frequency === 'weekly' && (
            <div>
              <label className={label} htmlFor="ab-day">
                {tr('Weekday', 'Ден')}
              </label>
              <select
                id="ab-day"
                className={field}
                value={cfg.weekday}
                onChange={(e) => cfg.update({ weekday: Number(e.target.value) })}
              >
                {(language === 'bg' ? DAYS_BG : DAYS_EN).map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={label} htmlFor="ab-time">
              {tr('Time', 'Час')}
            </label>
            <input
              id="ab-time"
              type="time"
              className={field}
              value={cfg.time}
              onChange={(e) => e.target.value && cfg.update({ time: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="ab-keep">
            {tr('Backups to keep', 'Брой запазени backup-и')}
          </label>
          <input
            id="ab-keep"
            type="number"
            min={1}
            max={100}
            className={field}
            value={cfg.keep}
            onChange={(e) =>
              cfg.update({
                keep: Math.min(100, Math.max(1, Math.floor(Number(e.target.value)) || 1)),
              })
            }
          />
        </div>
        <div>
          <label className={label} htmlFor="ab-pass">
            {tr('Passphrase (this session only)', 'Парола (само за тази сесия)')}
          </label>
          <input
            id="ab-pass"
            type="password"
            autoComplete="new-password"
            className={field}
            value={cfg.passphrase}
            onChange={(e) => cfg.update({ passphrase: e.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 mt-4 text-gray-900 dark:text-white">
        <input
          type="checkbox"
          checked={cfg.includeProducts}
          onChange={(e) => cfg.update({ includeProducts: e.target.checked })}
        />
        {tr('Include cached products', 'Включи кешираните продукти')}
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={chooseDir}
          disabled={!canUseFs}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {tr('Choose folder', 'Избери папка')}
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
          {cfg.outputDir ?? tr('No folder selected', 'Не е избрана папка')}
        </span>
        <button
          type="button"
          onClick={verify}
          disabled={!canUseFs || !cfg.outputDir || verifying}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          {tr('Verify last backup', 'Провери последния backup')}
        </button>
      </div>

      {cfg.lastResult && (
        <p
          className={`mt-3 text-sm ${cfg.lastResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {new Date(cfg.lastResult.at).toLocaleString()}: {cfg.lastResult.message}
        </p>
      )}
      {cfg.enabled && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {tr('Next run: ', 'Следващо изпълнение: ')}
          {nextRun(new Date(), cfg).toLocaleString()}
        </p>
      )}
    </div>
  );
});

export default SettingsAutoBackup;
