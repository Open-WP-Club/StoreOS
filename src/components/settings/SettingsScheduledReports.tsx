import { memo } from 'react';
import { CalendarClock } from 'lucide-react';
import useScheduledReports from '../../stores/scheduledReportsStore';
import type { Language } from '../../utils/i18n';
import { nextRun } from '../../utils/reportSchedule';

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_BG = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];

const field =
  'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const SettingsScheduledReports = memo(function SettingsScheduledReports({
  language,
}: {
  language: Language;
}) {
  const cfg = useScheduledReports();
  const bg = language === 'bg';
  const tr = (en: string, b: string): string => (bg ? b : en);
  const canUseFs = !!window.electronAPI?.reports;

  const chooseDir = async (): Promise<void> => {
    const dir = await window.electronAPI?.reports.chooseDir();
    if (dir) cfg.update({ outputDir: dir });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <CalendarClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr('Scheduled reports', 'Планирани отчети')}
        </h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {tr('Runs only while the app is open.', 'Работи само докато приложението е отворено.')}
      </p>

      <label className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white">
        <input
          type="checkbox"
          checked={cfg.enabled}
          disabled={!canUseFs || !cfg.outputDir}
          onChange={(e) => cfg.update({ enabled: e.target.checked })}
        />
        {tr('Enable scheduled reports', 'Включи планирани отчети')}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="sr-type">
            {tr('Report', 'Отчет')}
          </label>
          <select
            id="sr-type"
            className={field}
            value={cfg.reportType}
            onChange={(e) => cfg.update({ reportType: e.target.value as typeof cfg.reportType })}
          >
            <option value="pos-daily">{tr('POS daily', 'POS дневен')}</option>
            <option value="sales-summary">{tr('Sales summary', 'Обобщение на продажби')}</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="sr-format">
            {tr('Format', 'Формат')}
          </label>
          <select
            id="sr-format"
            className={field}
            value={cfg.format}
            onChange={(e) => cfg.update({ format: e.target.value as typeof cfg.format })}
          >
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="sr-freq">
            {tr('Frequency', 'Честота')}
          </label>
          <select
            id="sr-freq"
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
              <label className={label} htmlFor="sr-day">
                {tr('Weekday', 'Ден')}
              </label>
              <select
                id="sr-day"
                className={field}
                value={cfg.weekday}
                onChange={(e) => cfg.update({ weekday: Number(e.target.value) })}
              >
                {(bg ? DAYS_BG : DAYS_EN).map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={label} htmlFor="sr-time">
              {tr('Time', 'Час')}
            </label>
            <input
              id="sr-time"
              type="time"
              className={field}
              value={cfg.time}
              onChange={(e) => e.target.value && cfg.update({ time: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
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
      </div>

      <label className="flex items-center gap-2 mt-4 text-gray-900 dark:text-white">
        <input
          type="checkbox"
          checked={cfg.notify}
          onChange={(e) => cfg.update({ notify: e.target.checked })}
        />
        {tr('Desktop notification when done', 'Известие на работния плот при готовност')}
      </label>

      {cfg.enabled && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {tr('Next run: ', 'Следващо изпълнение: ')}
          {nextRun(new Date(), cfg).toLocaleString()}
        </p>
      )}
    </div>
  );
});

export default SettingsScheduledReports;
