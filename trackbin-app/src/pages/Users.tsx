import React, { useState, useEffect } from 'react'
import { userService, type UserWithRole, type CreateUserRequest, type UpdateUserRequest } from '../services/userService'
import type { Role } from '../types/database'
import UserModal from '../components/UserModal'
import { useI18n } from '../i18n/hooks'
import './Users.css'

const Users: React.FC = () => {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null)
  const [currentView, setCurrentView] = useState<'users' | 'roles'>('users')

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [usersData, rolesData] = await Promise.all([
        userService.getUsers(),
        userService.getRoles()
      ])
      
      setUsers(usersData)
      setRoles(rolesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      loadData()
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await userService.searchUsers(query)
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.search_failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = () => {
    setModalMode('create')
    setSelectedUser(null)
    setModalOpen(true)
  }

  const handleEditUser = (user: UserWithRole) => {
    setModalMode('edit')
    setSelectedUser(user)
    setModalOpen(true)
  }

  const handleDeleteUser = async (user: UserWithRole) => {
    if (!confirm(t('users.delete_confirm', { name: user.name }))) {
      return
    }

    try {
      await userService.deleteUser(user.id)
      showNotification('success', t('users.user_deactivated'))
      loadData()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : t('users.user_deactivate_failed'))
    }
  }

  const handleModalSave = async (userData: CreateUserRequest | UpdateUserRequest) => {
    try {
      if (modalMode === 'create') {
        await userService.createUser(userData as CreateUserRequest)
        showNotification('success', t('users.user_created'))
      } else {
        await userService.updateUser(selectedUser!.id, userData as UpdateUserRequest)
        showNotification('success', t('users.user_updated'))
      }
      
      setModalOpen(false)
      setSelectedUser(null)
      loadData()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : t('users.user_create_failed'))
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getFilteredUsers = () => {
    if (!searchQuery) return users
    return users.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role?.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  if (loading && users.length === 0) {
    return (
      <div className="users-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>{t('users.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>{t('users.page_title')}</h1>
        <p>{t('users.page_description')}</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="notification-close">×</button>
        </div>
      )}

      <div className="users-tabs">
        <button 
          className={`tab-button ${currentView === 'users' ? 'active' : ''}`}
          onClick={() => setCurrentView('users')}
        >
          {t('users.users_tab')}
        </button>
        <button 
          className={`tab-button ${currentView === 'roles' ? 'active' : ''}`}
          onClick={() => setCurrentView('roles')}
        >
          {t('users.roles_tab')}
        </button>
      </div>

      {currentView === 'users' && (
        <>
          <div className="users-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder={t('users.search_placeholder')}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="controls-actions">
              <button className="btn-success" onClick={handleAddUser}>
                + {t('users.add_user')}
              </button>
              <button className="btn-primary" onClick={loadData}>
                {t('users.refresh')}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <strong>{t('common.error')}:</strong> {error}
              <button onClick={loadData} className="retry-btn">
                {t('users.try_again')}
              </button>
            </div>
          )}

          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>{t('users.name')}</th>
                  <th>{t('users.email')}</th>
                  <th>{t('users.role')}</th>
                  <th>{t('users.status')}</th>
                  <th>{t('users.last_login')}</th>
                  <th>{t('users.created')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredUsers().length === 0 ? (
                  <tr>
                    <td colSpan={7} className="no-data">
                      {searchQuery ? t('users.no_search_results') : t('users.no_users')}
                    </td>
                  </tr>
                ) : (
                  getFilteredUsers().map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-info">
                          <strong>{user.name}</strong>
                          {user.created_by && <span className="created-by">{t('users.created_by_admin')}</span>}
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge ${user.role?.is_system_role ? 'system' : 'custom'}`}>
                          {user.role?.name}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                          {user.is_active ? t('users.active') : t('users.inactive')}
                        </span>
                      </td>
                      <td>
                        {user.last_login ? formatTimestamp(user.last_login) : t('users.never')}
                      </td>
                      <td>{formatTimestamp(user.created_at)}</td>
                      <td className="actions-cell">
                        <button 
                          className="btn-edit"
                          onClick={() => handleEditUser(user)}
                          title={t('users.edit_user')}
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteUser(user)}
                          title={t('users.deactivate_user')}
                          disabled={!user.is_active}
                        >
                          🚫
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="users-summary">
            <p>
              {t('users.showing_count', { 
                count: getFilteredUsers().length, 
                total: users.length, 
                plural: users.length !== 1 ? 's' : '' 
              })}
              {searchQuery && ` ${t('users.matching_search', { query: searchQuery })}`}
            </p>
          </div>
        </>
      )}

      {currentView === 'roles' && (
        <div className="roles-section">
          <div className="roles-header">
            <h2>{t('users.roles_tab')}</h2>
            <button className="btn-success">+ {t('users.add_role')}</button>
          </div>
          
          <div className="roles-table-container">
            <table className="roles-table">
              <thead>
                <tr>
                  <th>{t('users.role_name')}</th>
                  <th>{t('users.description')}</th>
                  <th>{t('users.type')}</th>
                  <th>{t('users.users_count')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <strong>{role.name}</strong>
                    </td>
                    <td>{role.description}</td>
                    <td>
                      <span className={`role-type-badge ${role.is_system_role ? 'system' : 'custom'}`}>
                        {role.is_system_role ? t('users.system') : t('users.custom')}
                      </span>
                    </td>
                    <td>
                      {users.filter(u => u.role_id === role.id).length}
                    </td>
                    <td className="actions-cell">
                      <button className="btn-edit" title={t('users.edit_role')}>
                        ✏️
                      </button>
                      <button className="btn-permissions" title={t('users.manage_permissions')}>
                        🔑
                      </button>
                      {!role.is_system_role && (
                        <button className="btn-delete" title={t('users.delete_role')}>
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
        user={selectedUser}
        mode={modalMode}
        roles={roles}
      />
    </div>
  )
}

export default Users