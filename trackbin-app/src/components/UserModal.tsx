import React, { useState, useEffect } from 'react'
import type { UserWithRole, CreateUserRequest, UpdateUserRequest } from '../services/userService'
import type { Role } from '../types/database'
import './UserModal.css'

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (userData: CreateUserRequest | UpdateUserRequest) => Promise<void>
  user: UserWithRole | null
  mode: 'create' | 'edit'
  roles: Role[]
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSave,
  user,
  mode,
  roles
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role_id: '',
    is_active: true
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && user) {
        setFormData({
          name: user.name,
          email: user.email,
          password: '',
          role_id: user.role_id,
          is_active: user.is_active
        })
      } else {
        setFormData({
          name: '',
          email: '',
          password: '',
          role_id: roles.length > 0 ? roles[0].id : '',
          is_active: true
        })
      }
      setErrors({})
    }
  }, [isOpen, mode, user, roles])

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (mode === 'create' && !formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (!formData.role_id) {
      newErrors.role_id = 'Role is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'create') {
        await onSave({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role_id: formData.role_id
        })
      } else {
        const updateData: UpdateUserRequest = {
          name: formData.name,
          email: formData.email,
          role_id: formData.role_id,
          is_active: formData.is_active
        }
        await onSave(updateData)
      }
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content user-modal">
        <div className="modal-header">
          <h2>{mode === 'create' ? 'Create New User' : 'Edit User'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? 'error' : ''}
                disabled={submitting}
                placeholder="Enter full name"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? 'error' : ''}
                disabled={submitting}
                placeholder="Enter email address"
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            {mode === 'create' && (
              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={errors.password ? 'error' : ''}
                  disabled={submitting}
                  placeholder="Enter password"
                />
                {errors.password && <span className="field-error">{errors.password}</span>}
                <small className="field-hint">Password must be at least 6 characters</small>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="role_id">Role *</label>
              <select
                id="role_id"
                name="role_id"
                value={formData.role_id}
                onChange={handleInputChange}
                className={errors.role_id ? 'error' : ''}
                disabled={submitting}
              >
                <option value="">Select a role</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name} - {role.description}
                  </option>
                ))}
              </select>
              {errors.role_id && <span className="field-error">{errors.role_id}</span>}
            </div>

            {mode === 'edit' && (
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                  <span className="checkbox-custom"></span>
                  Active User
                </label>
                <small className="field-hint">Inactive users cannot log in</small>
              </div>
            )}

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : (mode === 'create' ? 'Create User' : 'Update User')}
              </button>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default UserModal