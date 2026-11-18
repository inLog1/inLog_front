import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ru from './ru.json'
import en from './en.json'

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: {
      ru: {
        translation: ru, // ← оставляем, но...
      },
      en: {
        translation: en,
      },
    },
    // ↓ Самое важное
    ns: ['translation'],           // явно говорим, что основной namespace — translation
    defaultNS: 'translation',      // и он используется по умолчанию
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'en'],   // добавляем en, если хочешь потом включить
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n