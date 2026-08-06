import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';
import tr from './locales/tr.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ms from './locales/ms.json';
import ur from './locales/ur.json';
import id from './locales/id.json';
import bn from './locales/bn.json';
import ru from './locales/ru.json';
import pt from './locales/pt.json';
import de from './locales/de.json';
import it from './locales/it.json';
import es from './locales/es.json';
import bm from './locales/bm.json';
import nl from './locales/nl.json';

export const LANGUAGE_KEY = '@app_language';
export const SUPPORTED_LANGUAGES = ['fr', 'en', 'ar', 'tr', 'ja', 'ko', 'ms', 'ur', 'id', 'bn', 'ru', 'pt', 'de', 'it', 'es', 'bm', 'nl'];

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
      const locale = Localization.getLocales()?.[0]?.languageCode ?? 'en';
      callback(SUPPORTED_LANGUAGES.includes(locale) ? locale : 'en');
    } catch {
      callback('en');
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
      tr: { translation: tr },
      ja: { translation: ja },
      ko: { translation: ko },
      ms: { translation: ms },
      ur: { translation: ur },
      id: { translation: id },
      bn: { translation: bn },
      ru: { translation: ru },
      pt: { translation: pt },
      de: { translation: de },
      it: { translation: it },
      es: { translation: es },
      bm: { translation: bm },
      nl: { translation: nl },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

// RTL is handled via JS-level `direction` style in App.js — disable native RTL entirely
I18nManager.allowRTL(false);

export default i18n;
