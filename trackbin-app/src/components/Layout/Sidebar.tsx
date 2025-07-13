import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const Sidebar: React.FC = () => {
  const location = useLocation()

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/inventory', label: 'Inventory', icon: '📦' },
    { path: '/receiving', label: 'Receiving', icon: '📥' },
    { path: '/move-stock', label: 'Move Stock', icon: '🔄' },
    { path: '/shipments', label: 'Shipments', icon: '📤' },
    { path: '/audit-logs', label: 'Audit Logs', icon: '📋' },
    { path: '/users', label: 'Users & Roles', icon: '👥' },
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>TrackBin</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

export default Sidebar