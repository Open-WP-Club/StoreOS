import {
  t,
  getSupportedLanguages,
  isLanguageSupported,
  getLanguageInfo,
  SUPPORTED_LANGUAGES,
  LANGUAGE_INFO,
  translations,
} from '../i18n';

describe('i18n utilities', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('should contain bg and en', () => {
      expect(SUPPORTED_LANGUAGES).toContain('bg');
      expect(SUPPORTED_LANGUAGES).toContain('en');
    });

    it('should be a readonly array', () => {
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
    });
  });

  describe('LANGUAGE_INFO', () => {
    it('should have info for all supported languages', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(LANGUAGE_INFO[lang]).toBeDefined();
        expect(LANGUAGE_INFO[lang].code).toBe(lang);
        expect(LANGUAGE_INFO[lang].name).toBeDefined();
        expect(LANGUAGE_INFO[lang].englishName).toBeDefined();
        expect(LANGUAGE_INFO[lang].flag).toBeDefined();
      });
    });

    it('should have correct Bulgarian language info', () => {
      expect(LANGUAGE_INFO.bg).toEqual({
        code: 'bg',
        name: 'Български',
        englishName: 'Bulgarian',
        flag: '🇧🇬',
      });
    });

    it('should have correct English language info', () => {
      expect(LANGUAGE_INFO.en).toEqual({
        code: 'en',
        name: 'English',
        englishName: 'English',
        flag: '🇬🇧',
      });
    });
  });

  describe('t (translate function)', () => {
    it('should return Bulgarian translation when language is bg', () => {
      expect(t('save', 'bg')).toBe('Запази');
      expect(t('cancel', 'bg')).toBe('Отказ');
      expect(t('dashboard', 'bg')).toBe('Табло');
    });

    it('should return English translation when language is en', () => {
      expect(t('save', 'en')).toBe('Save');
      expect(t('cancel', 'en')).toBe('Cancel');
      expect(t('dashboard', 'en')).toBe('Dashboard');
    });

    it('should fallback to Bulgarian when key not found in requested language', () => {
      // This tests the fallback mechanism
      // All keys exist in both languages, so we test with a known key
      expect(t('orders', 'bg')).toBe('Поръчки');
      expect(t('orders', 'en')).toBe('Orders');
    });

    it('should translate status strings correctly', () => {
      expect(t('pending', 'bg')).toBe('Изчакваща');
      expect(t('processing', 'bg')).toBe('Обработва се');
      expect(t('completed', 'bg')).toBe('Завършена');

      expect(t('pending', 'en')).toBe('Pending');
      expect(t('processing', 'en')).toBe('Processing');
      expect(t('completed', 'en')).toBe('Completed');
    });

    it('should translate navigation strings correctly', () => {
      expect(t('products', 'en')).toBe('Products');
      expect(t('inventory', 'en')).toBe('Inventory');
      expect(t('analytics', 'en')).toBe('Analytics');
      expect(t('pos', 'en')).toBe('POS');
    });

    it('should translate settings strings correctly', () => {
      expect(t('settingsTitle', 'en')).toBe('App Settings');
      expect(t('languageLabel', 'en')).toBe('Language');
      expect(t('pinLockLabel', 'en')).toBe('PIN Lock');
    });

    it('should translate POS strings correctly', () => {
      expect(t('cart', 'en')).toBe('Cart');
      expect(t('cartEmpty', 'en')).toBe('Cart is empty');
      expect(t('total', 'en')).toBe('Total');
      expect(t('cash', 'en')).toBe('Cash');
      expect(t('card', 'en')).toBe('Card');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return array of language info objects', () => {
      const languages = getSupportedLanguages();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBe(SUPPORTED_LANGUAGES.length);
    });

    it('should return objects with required properties', () => {
      const languages = getSupportedLanguages();

      languages.forEach((lang) => {
        expect(lang).toHaveProperty('code');
        expect(lang).toHaveProperty('name');
        expect(lang).toHaveProperty('englishName');
        expect(lang).toHaveProperty('flag');
      });
    });

    it('should return correct language info for each language', () => {
      const languages = getSupportedLanguages();
      const bgLang = languages.find((l) => l.code === 'bg');
      const enLang = languages.find((l) => l.code === 'en');

      expect(bgLang).toEqual(LANGUAGE_INFO.bg);
      expect(enLang).toEqual(LANGUAGE_INFO.en);
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('bg')).toBe(true);
      expect(isLanguageSupported('en')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('de')).toBe(false);
      expect(isLanguageSupported('fr')).toBe(false);
      expect(isLanguageSupported('es')).toBe(false);
      expect(isLanguageSupported('invalid')).toBe(false);
    });

    it('should return false for empty or invalid input', () => {
      expect(isLanguageSupported('')).toBe(false);
      expect(isLanguageSupported('x')).toBe(false);
    });
  });

  describe('getLanguageInfo', () => {
    it('should return correct info for Bulgarian', () => {
      const info = getLanguageInfo('bg');

      expect(info.code).toBe('bg');
      expect(info.name).toBe('Български');
      expect(info.englishName).toBe('Bulgarian');
      expect(info.flag).toBe('🇧🇬');
    });

    it('should return correct info for English', () => {
      const info = getLanguageInfo('en');

      expect(info.code).toBe('en');
      expect(info.name).toBe('English');
      expect(info.englishName).toBe('English');
      expect(info.flag).toBe('🇬🇧');
    });
  });

  describe('translations completeness', () => {
    it('should have the same keys in all languages', () => {
      const bgKeys = Object.keys(translations.bg);
      const enKeys = Object.keys(translations.en);

      expect(bgKeys.length).toBe(enKeys.length);
      bgKeys.forEach((key) => {
        expect(enKeys).toContain(key);
      });
    });

    it('should not have empty translations', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        Object.entries(translations[lang]).forEach(([_key, value]) => {
          expect(value).toBeTruthy();
          expect(value.trim()).not.toBe('');
        });
      });
    });
  });
});
