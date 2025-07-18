import React, { useState } from 'react'
import { authService } from '../services/authService'
import type { User, Role } from '../types/database'
import './SignIn.css'

interface SignInProps {
  onSignIn: (user: User & { role: Role }) => void
}

const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
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
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    if (!password.trim()) {
      errors.password = 'Password is required'
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
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
      setError(err instanceof Error ? err.message : 'Login failed')
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
                <p>Warehouse Management System</p>
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
                Email
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
                placeholder="Enter your email"
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
                Password
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
                placeholder="Enter your password"
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
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SignIn