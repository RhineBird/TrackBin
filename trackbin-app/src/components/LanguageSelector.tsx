import React from 'react'
import { useI18n } from '../i18n/hooks'
import './LanguageSelector.css'

const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useI18n()

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' }
  ]

  const handleLanguageChange = (langCode: 'en' | 'tr') => {
    setLanguage(langCode)
  }

  return (
    <div className="language-selector">
      <select 
        value={language} 
        onChange={(e) => handleLanguageChange(e.target.value as 'en' | 'tr')}
        className="language-select"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export default LanguageSelector