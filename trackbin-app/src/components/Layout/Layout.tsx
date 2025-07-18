import React from 'react'
import Sidebar from './Sidebar'
import type { User, Role } from '../../types/database'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
  user: User & { role: Role }
  onSignOut: () => void
}

const Layout: React.FC<LayoutProps> = ({ children, user, onSignOut }) => {
  return (
    <div className="layout">
      <Sidebar user={user} onSignOut={onSignOut} />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

export default Layout