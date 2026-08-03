import { memo } from 'react';
import { Globe, Check } from 'lucide-react';
import { t, getSupportedLanguages } from '../../utils/i18n';
import type { Language } from '../../utils/i18n';

interface SettingsLanguageProps {
  language: Language;
  setLanguage: (code: Language) => void;
}

const SettingsLanguage = memo(function SettingsLanguage({
  language,
  setLanguage,
}: SettingsLanguageProps) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Globe className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('languageLabel', language)}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {getSupportedLanguages().map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
              language === lang.code
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="text-2xl">{lang.flag}</span>
            <span
              className={`font-medium ${language === lang.code ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}
            >
              {lang.name}
            </span>
            {language === lang.code && <Check className="w-5 h-5 text-blue-600" />}
          </button>
        ))}
      </div>
    </section>
  );
});

export default SettingsLanguage;
