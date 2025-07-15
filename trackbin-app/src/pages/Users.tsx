import React, { useState, useEffect } from 'react'
import { userService, type UserWithRole, type CreateUserRequest, type UpdateUserRequest } from '../services/userService'
import type { Role } from '../types/database'
import UserModal from '../components/UserModal'
import './Users.css'

const Users: React.FC = () => {
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
      setError(err instanceof Error ? err.message : 'Failed to load data')
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
      setError(err instanceof Error ? err.message : 'Failed to search users')
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
    if (!confirm(`Are you sure you want to deactivate user "${user.name}"?`)) {
      return
    }

    try {
      await userService.deleteUser(user.id)
      showNotification('success', 'User deactivated successfully')
      loadData()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to deactivate user')
    }
  }

  const handleModalSave = async (userData: CreateUserRequest | UpdateUserRequest) => {
    try {
      if (modalMode === 'create') {
        await userService.createUser(userData as CreateUserRequest)
        showNotification('success', 'User created successfully')
      } else {
        await userService.updateUser(selectedUser!.id, userData as UpdateUserRequest)
        showNotification('success', 'User updated successfully')
      }
      
      setModalOpen(false)
      setSelectedUser(null)
      loadData()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to save user')
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
          <p>Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>User Management</h1>
        <p>Manage user accounts, roles, and permissions</p>
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
          Users
        </button>
        <button 
          className={`tab-button ${currentView === 'roles' ? 'active' : ''}`}
          onClick={() => setCurrentView('roles')}
        >
          Roles & Permissions
        </button>
      </div>

      {currentView === 'users' && (
        <>
          <div className="users-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="controls-actions">
              <button className="btn-success" onClick={handleAddUser}>
                + Add User
              </button>
              <button className="btn-primary" onClick={loadData}>
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
              <button onClick={loadData} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredUsers().length === 0 ? (
                  <tr>
                    <td colSpan={7} className="no-data">
                      {searchQuery ? 'No users found matching your search.' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  getFilteredUsers().map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-info">
                          <strong>{user.name}</strong>
                          {user.created_by && <span className="created-by">Created by admin</span>}
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
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {user.last_login ? formatTimestamp(user.last_login) : 'Never'}
                      </td>
                      <td>{formatTimestamp(user.created_at)}</td>
                      <td className="actions-cell">
                        <button 
                          className="btn-edit"
                          onClick={() => handleEditUser(user)}
                          title="Edit user"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteUser(user)}
                          title="Deactivate user"
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
              Showing {getFilteredUsers().length} of {users.length} user{users.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        </>
      )}

      {currentView === 'roles' && (
        <div className="roles-section">
          <div className="roles-header">
            <h2>Roles & Permissions</h2>
            <button className="btn-success">+ Add Role</button>
          </div>
          
          <div className="roles-table-container">
            <table className="roles-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Users</th>
                  <th>Actions</th>
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
                        {role.is_system_role ? 'System' : 'Custom'}
                      </span>
                    </td>
                    <td>
                      {users.filter(u => u.role_id === role.id).length}
                    </td>
                    <td className="actions-cell">
                      <button className="btn-edit" title="Edit role">
                        ✏️
                      </button>
                      <button className="btn-permissions" title="Manage permissions">
                        🔑
                      </button>
                      {!role.is_system_role && (
                        <button className="btn-delete" title="Delete role">
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