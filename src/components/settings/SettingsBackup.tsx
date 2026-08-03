import { memo, useState, useRef } from 'react';
import { HardDrive, AlertTriangle, Download, Upload, X } from 'lucide-react';
import { t } from '../../utils/i18n';
import type { Language } from '../../utils/i18n';
import { createBackup, downloadBackup, readBackupFile, restoreBackup } from '../../utils/backup';
import type { BackupData } from '../../utils/backup';
import type { ToastType } from '../../types/ui';

interface SettingsBackupProps {
  language: Language;
  showToast: (msg: string, type?: ToastType) => void;
}

const SettingsBackup = memo(function SettingsBackup({ language, showToast }: SettingsBackupProps) {
  const [includeProducts, setIncludeProducts] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateBackup = (): void => {
    setIsBackingUp(true);
    try {
      const backup = createBackup({ includeProducts });
      downloadBackup(backup);
      showToast(t('backupSuccess', language), 'success');
    } catch {
      showToast(t('error', language), 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const backup = await readBackupFile(file);
      setPendingRestore(backup);
      setShowRestoreConfirm(true);
    } catch {
      showToast(t('invalidBackupFile', language), 'error');
    }
  };

  const handleConfirmRestore = (): void => {
    if (!pendingRestore) return;

    setIsRestoring(true);
    setShowRestoreConfirm(false);

    try {
      const result = restoreBackup(pendingRestore);

      if (result.success) {
        showToast(t('restoreSuccess', language), 'success');
        setTimeout(() => window.location.reload(), 1500);
      } else if (result.restored.length > 0) {
        showToast(
          `${t('restorePartialSuccess', language)}: ${result.errors.join(', ')}`,
          'warning'
        );
        setTimeout(() => window.location.reload(), 2500);
      } else {
        showToast(t('restoreError', language), 'error');
      }
    } catch {
      showToast(t('restoreError', language), 'error');
    } finally {
      setIsRestoring(false);
      setPendingRestore(null);
    }
  };

  return (
    <>
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-2">
          <HardDrive className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('backupRestore', language)}
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 ml-8">
          {t('backupRestoreDescription', language)}
        </p>

        <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t('backupWarningCredentials', language)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {t('createBackup', language)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('createBackupDescription', language)}
              </p>
            </div>
            <button
              onClick={handleCreateBackup}
              disabled={isBackingUp}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              {t('createBackup', language)}
            </button>
          </div>

          <label htmlFor="settings-include-products" className="flex items-center gap-3 ml-4 cursor-pointer">
            <input
              id="settings-include-products"
              type="checkbox"
              aria-label={t('includeProducts', language)}
              checked={includeProducts}
              onChange={(e) => setIncludeProducts(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('includeProducts', language)}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('includeProductsDescription', language)}
              </p>
            </div>
          </label>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {t('restoreFromBackup', language)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('restoreFromBackupDescription', language)}
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                {t('restoreFromBackup', language)}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && pendingRestore && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="presentation"
          onClick={() => {
            setShowRestoreConfirm(false);
            setPendingRestore(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowRestoreConfirm(false);
              setPendingRestore(null);
            }
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {t('restoreConfirmTitle', language)}
              </h3>
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setPendingRestore(null);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('restoreConfirmMessage', language)}
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">
                  {language === 'bg' ? 'Дата' : 'Date'}:
                </span>{' '}
                {new Date(pendingRestore.createdAt).toLocaleString()}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">
                  {language === 'bg' ? 'Магазини' : 'Stores'}:
                </span>{' '}
                {pendingRestore.storesCount}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">
                  {language === 'bg' ? 'Включва продукти' : 'Includes products'}:
                </span>{' '}
                {pendingRestore.includesProducts
                  ? language === 'bg'
                    ? 'Да'
                    : 'Yes'
                  : language === 'bg'
                    ? 'Не'
                    : 'No'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setPendingRestore(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('cancel', language)}
              </button>
              <button
                onClick={handleConfirmRestore}
                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
              >
                {t('confirm', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default SettingsBackup;
