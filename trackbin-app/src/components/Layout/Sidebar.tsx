import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { User, Role } from '../../types/database'
import { useTranslation } from '../../i18n/hooks'
import LanguageSelector from '../LanguageSelector'

interface SidebarProps {
  user: User & { role: Role }
  onSignOut: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ user, onSignOut }) => {
  const location = useLocation()
  const { t } = useTranslation()

  const menuItems = [
    { path: '/', label: t('navigation.dashboard'), icon: '📊' },
    { path: '/inventory', label: t('navigation.inventory'), icon: '📦' },
    { path: '/receiving', label: t('navigation.receiving'), icon: '📥' },
    { path: '/move-stock', label: t('navigation.move_stock'), icon: '🔄' },
    { path: '/shipments', label: t('navigation.shipments'), icon: '📤' },
    { path: '/audit-logs', label: t('navigation.audit_logs'), icon: '📋' },
    { path: '/users', label: t('navigation.users'), icon: '👥' },
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
        <div className="language-selector-container">
          <LanguageSelector />
        </div>
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
          <span className="sign-out-label">{t('auth.sign_out')}</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar