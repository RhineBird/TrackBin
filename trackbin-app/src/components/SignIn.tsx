import React, { useState } from 'react'
import './SignIn.css'

interface SignInProps {
  onSignIn: () => void
}

const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [logoError, setLogoError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSignIn()
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
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Enter your email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Enter your password"
              />
            </div>
            
            <button 
              type="submit"
              className="signin-button"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SignIn