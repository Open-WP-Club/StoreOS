import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Language } from '../../utils/i18n';
import type { UpdateState } from '../../types/electron';

const tr = (language: Language, en: string, b: string): string => (language === 'bg' ? b : en);

export function describeUpdate(s: UpdateState, language: Language): string {
  const v = s.version ?? '';
  switch (s.status) {
    case 'disabled':
      return tr(
        language,
        'Updates are only available in installed builds.',
        'Обновленията са налични само в инсталирани версии.'
      );
    case 'checking':
      return tr(language, 'Checking for updates...', 'Проверка за обновления...');
    case 'available':
      return tr(language, `Version ${v} is available.`, `Налична е версия ${v}.`);
    case 'up-to-date':
      return tr(language, 'You are up to date.', 'Използвате последната версия.');
    case 'downloading':
      return tr(
        language,
        `Downloading ${v}... ${s.percent ?? 0}%`,
        `Изтегляне на ${v}... ${s.percent ?? 0}%`
      );
    case 'downloaded':
      return tr(
        language,
        `Version ${v} is ready to install.`,
        `Версия ${v} е готова за инсталиране.`
      );
    case 'error':
      return `${tr(language, 'Update error', 'Грешка при обновяване')}: ${s.error ?? ''}`;
    default:
      return '';
  }
}

export default function SettingsUpdates({ language }: { language: Language }) {
  const api = window.electronAPI?.updater;
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    if (!api) return;
    let live = true;
    api.getState().then((s) => {
      if (live && s) setState(s);
    });
    const off = api.onStatus(setState);
    return () => {
      live = false;
      off();
    };
  }, [api]);

  const version = state?.currentVersion ?? __APP_VERSION__;
  const status = state?.status;
  const btn =
    'px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50';

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-1">
        <RefreshCw className="w-5 h-5" />
        {tr(language, 'Updates', 'Обновления')}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {tr(language, 'Current version', 'Текуща версия')}: {version}
      </p>
      {state && (
        <p
          role={status === 'error' ? 'alert' : 'status'}
          className={`text-sm mb-3 ${status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}
        >
          {describeUpdate(state, language)}
        </p>
      )}
      {api && status !== 'disabled' && (
        <div className="flex gap-2">
          {status === 'available' ? (
            <button className={btn} onClick={() => api.download()}>
              {tr(language, 'Download update', 'Изтегли обновление')}
            </button>
          ) : status === 'downloaded' ? (
            <button className={btn} onClick={() => api.install()}>
              {tr(language, 'Restart to install', 'Рестартирай и инсталирай')}
            </button>
          ) : (
            <button
              className={btn}
              disabled={status === 'checking' || status === 'downloading'}
              onClick={() => api.check()}
            >
              {tr(language, 'Check for updates', 'Провери за обновления')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
