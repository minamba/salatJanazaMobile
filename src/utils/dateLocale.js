export const LOCALE_MAP = {
  fr: 'fr-FR',
  en: 'en-US',
  ar: 'ar-SA',
  tr: 'tr-TR',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ms: 'ms-MY',
  ur: 'ur-PK',
  id: 'id-ID',
  bn: 'bn-BD',
  ru: 'ru-RU',
  pt: 'pt-BR',
  de: 'de-DE',
  it: 'it-IT',
  es: 'es-ES',
  bm: 'fr-FR',
  nl: 'nl-BE',
};

// Returns the BCP-47 locale string for a given i18n language code.
// Falls back to 'en-US' for unsupported languages.
export function getDateLocale(lang) {
  const code = lang?.split('-')[0];
  return LOCALE_MAP[code] ?? 'en-US';
}
