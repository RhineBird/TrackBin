import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import './App.css'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<div>Inventory Page</div>} />
          <Route path="/receiving" element={<div>Receiving Page</div>} />
          <Route path="/move-stock" element={<div>Move Stock Page</div>} />
          <Route path="/shipments" element={<div>Shipments Page</div>} />
          <Route path="/audit-logs" element={<div>Audit Logs Page</div>} />
          <Route path="/users" element={<div>Users & Roles Page</div>} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
