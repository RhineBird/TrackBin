import React, { useState } from 'react'
import { authService } from '../services/authService'
import { useI18n } from '../i18n/hooks'
import type { User, Role } from '../types/database'
import './SignIn.css'

interface SignInProps {
  onSignIn: (user: User & { role: Role }) => void
}

const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [logoError, setLogoError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<{
    email?: string
    password?: string
  }>({})

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {}
    
    if (!email.trim()) {
      errors.email = t('auth.email_required')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t('auth.invalid_email')
    }
    
    if (!password.trim()) {
      errors.password = t('auth.password_required')
    } else if (password.length < 6) {
      errors.password = t('auth.password_min_length')
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    
    try {
      const response = await authService.login({ email, password })
      authService.saveSession(response.user, response.session)
      onSignIn(response.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login_failed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogoError = () => {
    setLogoError(true)
  }

  return (
    <div className="signin-page">
      <div className="signin-container">
        <div className="signin-content">
          <div className="logo-container">
            {!logoError ? (
              <img 
                src="/images/trackbin-logo.png" 
                alt="TrackBin Warehouse Management System" 
                className="logo"
                onError={handleLogoError}
              />
            ) : (
              <div className="logo-fallback">
                <h1>TrackBin</h1>
                <p>{t('auth.warehouse_management')}</p>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="signin-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                {t('auth.email')}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (validationErrors.email) {
                    setValidationErrors(prev => ({ ...prev, email: undefined }))
                  }
                }}
                className={`form-input ${validationErrors.email ? 'form-input-error' : ''}`}
                placeholder={t('auth.email_placeholder')}
                disabled={isLoading}
              />
              {validationErrors.email && (
                <div className="field-error">
                  {validationErrors.email}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                {t('auth.password')}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (validationErrors.password) {
                    setValidationErrors(prev => ({ ...prev, password: undefined }))
                  }
                }}
                className={`form-input ${validationErrors.password ? 'form-input-error' : ''}`}
                placeholder={t('auth.password_placeholder')}
                disabled={isLoading}
              />
              {validationErrors.password && (
                <div className="field-error">
                  {validationErrors.password}
                </div>
              )}
            </div>
            
            <button 
              type="submit"
              className="signin-button"
              disabled={isLoading}
            >
              {isLoading ? t('auth.signing_in') : t('auth.sign_in')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SignIn