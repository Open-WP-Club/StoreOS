import { memo, useState } from 'react';
import { Receipt } from 'lucide-react';
import useAppSettings from '../../stores/appSettingsStore';
import {
  fiscalReport,
  loadPending,
  dismissPending,
  retryPending,
  type FiscalConfig,
} from '../../utils/fiscal';

const input =
  'px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white';
const btn =
  'px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-900 dark:text-white disabled:opacity-50';

const SettingsFiscal = memo(function SettingsFiscal() {
  const fiscal = useAppSettings((s) => s.fiscal);
  const setFiscal = useAppSettings((s) => s.setFiscal);
  const [pending, setPending] = useState(loadPending);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const cfg: FiscalConfig = {
    port: fiscal.port,
    baud: fiscal.baud,
    operator: fiscal.operator,
    password: fiscal.password,
  };

  const run = async (fn: () => Promise<string>): Promise<void> => {
    setBusy(true);
    try {
      setMsg(await fn());
    } finally {
      setPending(loadPending());
      setBusy(false);
    }
  };
  const report = (kind: 'X' | 'Z') => (): Promise<void> =>
    run(async () => {
      const r = await fiscalReport(kind, cfg);
      return r.success ? `${kind} отчет: готово` : `Грешка: ${r.error}`;
    });

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Receipt className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Фискално устройство (ФУ / НАП)
        </h2>
      </div>
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={fiscal.enabled}
            onChange={(e) => setFiscal({ enabled: e.target.checked })}
          />
          Издавай фискален бон при продажба в брой / с карта (Datecs FP, сериен порт)
        </label>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            aria-label="Порт"
            className={`${input} w-48`}
            placeholder="/dev/ttyUSB0 или COM3"
            value={fiscal.port}
            onChange={(e) => setFiscal({ port: e.target.value.trim() })}
          />
          <select
            aria-label="Скорост"
            className={input}
            value={fiscal.baud}
            onChange={(e) => setFiscal({ baud: Number(e.target.value) })}
          >
            {[9600, 19200, 38400, 57600, 115200].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <input
            aria-label="Оператор"
            className={`${input} w-20`}
            placeholder="Оператор"
            value={fiscal.operator}
            onChange={(e) => setFiscal({ operator: e.target.value.replace(/\D/g, '') })}
          />
          <input
            aria-label="Парола на оператора"
            type="password"
            className={`${input} w-28`}
            placeholder="Парола"
            value={fiscal.password}
            onChange={(e) => setFiscal({ password: e.target.value.replace(/\D/g, '') })}
          />
        </div>
        <label className="flex items-center gap-3">
          <input
            aria-label="ДДС групи"
            className={`${input} w-48`}
            value={fiscal.vatMap}
            onChange={(e) => setFiscal({ vatMap: e.target.value })}
          />
          ДДС групи (ставка=буква, напр. 20=Б,9=В,0=А) - трябва да съвпадат с програмирането на ФУ
        </label>
        <div className="flex gap-2">
          <button className={btn} disabled={busy || !fiscal.port} onClick={report('X')}>
            X отчет
          </button>
          <button
            className={btn}
            disabled={busy || !fiscal.port}
            onClick={() => {
              if (window.confirm('Z отчетът приключва фискалния ден. Продължи?'))
                void report('Z')();
            }}
          >
            Z отчет
          </button>
        </div>
        {msg && <p>{msg}</p>}
        {pending.length > 0 && (
          <div className="border border-amber-300 dark:border-amber-600 rounded-lg p-3 space-y-2">
            <p className="font-medium">
              Неиздадени фискални бонове: {pending.length}. Продажбите са запазени в магазина.
            </p>
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="flex-1">
                  {p.sale.lines.length} арт. - {p.error}
                  {p.ambiguous && ' (НЕЯСНО дали е отпечатан - провери устройството)'}
                </span>
                <button
                  className={btn}
                  onClick={() => {
                    dismissPending(p.id);
                    setPending(loadPending());
                  }}
                >
                  Премахни
                </button>
              </div>
            ))}
            <button
              className={btn}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await retryPending(cfg);
                  return `Издадени: ${r.done}, останали: ${r.left}`;
                })
              }
            >
              Опитай отново
            </button>
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Нетествано с реално фискално устройство. Проверете командите и ДДС буквите по
          ръководството на вашия модел.
        </p>
      </div>
    </section>
  );
});

export default SettingsFiscal;
