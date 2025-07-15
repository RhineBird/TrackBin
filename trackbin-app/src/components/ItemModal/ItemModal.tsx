import React, { useState, useEffect } from 'react'
import { itemsService } from '../../services/itemsService'
import type { Item } from '../../types/database'
import './ItemModal.css'

interface ItemFormData {
  sku: string
  name: string
  unit: string
  description: string
}

interface ItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  item?: Item | null
  mode: 'create' | 'edit'
}

const ItemModal: React.FC<ItemModalProps> = ({ isOpen, onClose, onSave, item, mode }) => {
  const [formData, setFormData] = useState<ItemFormData>({
    sku: '',
    name: '',
    unit: '',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<ItemFormData>>({})

  // Reset form when modal opens/closes or item changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && item) {
        setFormData({
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          description: item.description || ''
        })
      } else {
        setFormData({
          sku: '',
          name: '',
          unit: '',
          description: ''
        })
      }
      setError(null)
      setErrors({})
    }
  }, [isOpen, item, mode])

  const validateForm = (): boolean => {
    const newErrors: Partial<ItemFormData> = {}

    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required'
    } else if (!/^[A-Z0-9-]+$/.test(formData.sku)) {
      newErrors.sku = 'SKU must contain only uppercase letters, numbers, and hyphens'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Unit is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error for this field when user starts typing
    if (errors[name as keyof ItemFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (mode === 'create') {
        await itemsService.createItem({
          ...formData,
          is_active: true
        })
      } else if (mode === 'edit' && item) {
        await itemsService.updateItem(item.id, formData)
      }
      
      onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'create' ? 'Add New Item' : 'Edit Item'}</h2>
          <button 
            className="modal-close" 
            onClick={handleClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="item-form">
          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="sku">SKU *</label>
            <input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleInputChange}
              className={errors.sku ? 'error' : ''}
              placeholder="e.g., BOLT-M8-50"
              disabled={loading}
              style={{ textTransform: 'uppercase' }}
            />
            {errors.sku && <span className="field-error">{errors.sku}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={errors.name ? 'error' : ''}
              placeholder="e.g., M8x50mm Hex Bolt"
              disabled={loading}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="unit">Unit *</label>
            <input
              type="text"
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleInputChange}
              className={errors.unit ? 'error' : ''}
              placeholder="e.g., pieces, meters, liters"
              disabled={loading}
            />
            {errors.unit && <span className="field-error">{errors.unit}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Optional description of the item"
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : (mode === 'create' ? 'Add Item' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ItemModal