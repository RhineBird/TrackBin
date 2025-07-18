import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { User, Role } from '../../types/database'

interface SidebarProps {
  user: User & { role: Role }
  onSignOut: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ user, onSignOut }) => {
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
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role.name}</div>
          </div>
        </div>
        <button className="sign-out-btn" onClick={onSignOut}>
          <span className="sign-out-icon">🚪</span>
          <span className="sign-out-label">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar