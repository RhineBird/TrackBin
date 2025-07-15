import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import StockMovement from './pages/StockMovement'
import './App.css'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Items />} />
          <Route path="/receiving" element={<div>Receiving Page</div>} />
          <Route path="/move-stock" element={<StockMovement />} />
          <Route path="/shipments" element={<div>Shipments Page</div>} />
          <Route path="/audit-logs" element={<div>Audit Logs Page</div>} />
          <Route path="/users" element={<div>Users & Roles Page</div>} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
