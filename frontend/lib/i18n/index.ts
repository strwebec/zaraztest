'use client';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './uk.json';
import en from './en.json';

export { SUPPORTED_LOCALES, type Locale } from './locales';

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources: { uk: { translation: uk }, en: { translation: en } },
    lng: 'uk',
    fallbackLng: 'uk',
    interpolation: { escapeValue: false },
  });
}

export default i18next;
