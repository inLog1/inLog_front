import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import type { LanguageType } from '../../../shared/types/enums'
import { APP_LANGUAGE_KEY, I18NEXT_LANGUAGE_KEY } from '../../config/constants'

export const useLanguage = () => {
  const { i18n } = useTranslation()
  const [currentLanguage, setCurrentLanguage] = useState<LanguageType>(
    (localStorage.getItem(APP_LANGUAGE_KEY) as LanguageType) || 
    (localStorage.getItem(I18NEXT_LANGUAGE_KEY) as LanguageType) || 
    (i18n.language as LanguageType) || 
    'ru'
  )

  const changeLanguage = async (lang: LanguageType) => {
    try {
      localStorage.setItem(APP_LANGUAGE_KEY, lang)
      localStorage.setItem(I18NEXT_LANGUAGE_KEY, lang)
      
      await i18n.changeLanguage(lang)
      setCurrentLanguage(lang)
      document.documentElement.lang = lang
      
      return true
    } catch (error) {
      console.error('Failed to change language:', error)
      return false
    }
  }

  useEffect(() => {
    const savedLang = localStorage.getItem(APP_LANGUAGE_KEY)
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang as LanguageType)
      setCurrentLanguage(savedLang as LanguageType)
      document.documentElement.lang = savedLang
    } else if (i18n.language) {
      setCurrentLanguage(i18n.language as LanguageType)
      document.documentElement.lang = i18n.language
    }
  }, [i18n])

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLanguage(lng as LanguageType)
      document.documentElement.lang = lng
    }

    i18n.on('languageChanged', handleLanguageChanged)
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [i18n])

  return {
    currentLanguage,
    changeLanguage,
    isRu: currentLanguage === 'ru',
    isEn: currentLanguage === 'en',
  }
}