import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const LANGUAGE_KEY = '@app_language';
export const SUPPORTED_LANGUAGES = ['fr', 'en', 'ar'];

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
        callback(saved);
        return;
      }
      const locale = Localization.getLocales()?.[0]?.languageCode ?? 'fr';
      callback(SUPPORTED_LANGUAGES.includes(locale) ? locale : 'fr');
    } catch {
      callback('fr');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try { await AsyncStorage.setItem(LANGUAGE_KEY, language); } catch {}
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  });

// RTL is handled via JS-level `direction` style in App.js — disable native RTL entirely
I18nManager.allowRTL(false);

export default i18n;
