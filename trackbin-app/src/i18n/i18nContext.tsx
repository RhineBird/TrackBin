import React, { createContext, useState, useEffect } from 'react'
import enTranslations from './locales/en.json'
import trTranslations from './locales/tr.json'

type Language = 'en' | 'tr'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

const translations = {
  en: enTranslations,
  tr: trTranslations
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined)

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Try to get saved language from localStorage
    const saved = localStorage.getItem('trackbin-language')
    return (saved as Language) || 'en'
  })

  useEffect(() => {
    // Save language preference to localStorage
    localStorage.setItem('trackbin-language', language)
    
    // Update HTML lang attribute
    document.documentElement.lang = language
  }, [language])

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: unknown = translations[language]
    
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k]
    }
    
    let result = (typeof value === 'string' ? value : key) // Return key if translation not found
    
    // Replace variables in the translation
    if (variables && typeof result === 'string') {
      Object.entries(variables).forEach(([varKey, varValue]) => {
        result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue))
      })
    }
    
    return result
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

