import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import SignIn from './components/SignIn'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import StockMovement from './pages/StockMovement'
import Receiving from './pages/Receiving'
import Shipments from './pages/Shipments'
import AuditLogs from './pages/AuditLogs'
import Users from './pages/Users'
import { authService } from './services/authService'
import { I18nProvider } from './i18n/i18nContext'
import type { User, Role } from './types/database'
import './App.css'

function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}

function AppContent() {
  const [user, setUser] = useState<(User & { role: Role }) | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session on app load
    const checkSession = async () => {
      const stored = authService.getStoredSession()
      if (stored) {
        try {
          const response = await authService.verifySession(stored.sessionToken)
          if (response) {
            setUser(response.user)
          } else {
            authService.clearStoredSession()
          }
        } catch (error) {
          authService.clearStoredSession()
        }
      }
      setIsLoading(false)
    }
    
    checkSession()
  }, [])

  const handleSignIn = (authenticatedUser: User & { role: Role }) => {
    setUser(authenticatedUser)
  }

  const handleSignOut = async () => {
    const stored = authService.getStoredSession()
    if (stored) {
      try {
        await authService.logout(stored.sessionToken)
      } catch (error) {
        console.error('Error during logout:', error)
      }
    }
    authService.clearStoredSession()
    setUser(null)
  }

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #2c5282 0%, #1a365d 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <SignIn onSignIn={handleSignIn} />
  }

  return (
    <Router>
      <Layout user={user} onSignOut={handleSignOut}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Items user={user} />} />
          <Route path="/receiving" element={<Receiving />} />
          <Route path="/move-stock" element={<StockMovement />} />
          <Route path="/shipments" element={<Shipments />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
