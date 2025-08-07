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
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { I18nProvider } from './i18n/i18nContext'
import './App.css'

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </I18nProvider>
  )
}

function AppContent() {
  const { user, isLoading, logout } = useAuth()

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
    return <SignIn />
  }

  return (
    <Router>
      <Layout user={user} onSignOut={logout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Items />} />
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
