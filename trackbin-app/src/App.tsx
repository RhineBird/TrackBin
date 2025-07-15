import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import StockMovement from './pages/StockMovement'
import Receiving from './pages/Receiving'
import Shipments from './pages/Shipments'
import AuditLogs from './pages/AuditLogs'
import './App.css'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Items />} />
          <Route path="/receiving" element={<Receiving />} />
          <Route path="/move-stock" element={<StockMovement />} />
          <Route path="/shipments" element={<Shipments />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/users" element={<div>Users & Roles Page</div>} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
