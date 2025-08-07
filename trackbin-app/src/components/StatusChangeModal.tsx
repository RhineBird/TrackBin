import React, { useState, useEffect } from 'react'
import { stockStatusService } from '../services/stockStatusService'
import { useAuth } from '../contexts/AuthContext'
import './StatusChangeModal.css'

interface StatusChangeModalProps {
  isOpen: boolean
  onClose: () => void
  onStatusChanged: () => void
  stockEntry: {
    id: string
    item_sku: string
    item_name: string
    bin_name: string
    zone_name: string
    quantity: number
    status: 'available' | 'reserved' | 'quarantined' | 'damaged'
  } | null
}

const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  isOpen,
  onClose,
  onStatusChanged,
  stockEntry
}) => {
  const { getCurrentUserId } = useAuth()
  const [newStatus, setNewStatus] = useState<'available' | 'reserved' | 'quarantined' | 'damaged'>('available')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && stockEntry) {
      setNewStatus(stockEntry.status)
      setReason('')
      setError(null)
    }
  }, [isOpen, stockEntry])

  const statusOptions = [
    { value: 'available', label: 'Available', color: '#28a745' },
    { value: 'reserved', label: 'Reserved', color: '#007bff' },
    { value: 'quarantined', label: 'Quarantined', color: '#ffc107' },
    { value: 'damaged', label: 'Damaged', color: '#dc3545' }
  ]

  const getAvailableStatusOptions = () => {
    if (!stockEntry) return statusOptions

    return statusOptions.filter(option => {
      const validation = stockStatusService.validateStatusTransition(stockEntry.status, option.value as any)
      return validation.valid || option.value === stockEntry.status
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!stockEntry) return

    if (newStatus === stockEntry.status) {
      setError('Please select a different status')
      return
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the status change')
      return
    }

    const currentUserId = getCurrentUserId()
    if (!currentUserId) {
      setError('User not authenticated')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await stockStatusService.updateStockStatus({
        stockEntryId: stockEntry.id,
        newStatus,
        reason: reason.trim(),
        user_id: currentUserId
      })

      onStatusChanged()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !stockEntry) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content status-change-modal">
        <div className="modal-header">
          <h2>Change Stock Status</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="stock-info">
            <h3>Stock Entry Details</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Item:</label>
                <span>{stockEntry.item_sku} - {stockEntry.item_name}</span>
              </div>
              <div className="info-item">
                <label>Location:</label>
                <span>{stockEntry.bin_name} ({stockEntry.zone_name})</span>
              </div>
              <div className="info-item">
                <label>Quantity:</label>
                <span>{stockEntry.quantity}</span>
              </div>
              <div className="info-item">
                <label>Current Status:</label>
                <span className={`status-badge ${stockEntry.status}`}>
                  {stockEntry.status.charAt(0).toUpperCase() + stockEntry.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="newStatus">New Status *</label>
              <select
                id="newStatus"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                disabled={submitting}
                required
              >
                {getAvailableStatusOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason for Change *</label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                required
                rows={3}
                placeholder="Enter reason for status change..."
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={submitting || newStatus === stockEntry.status}
              >
                {submitting ? 'Updating...' : 'Update Status'}
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

export default StatusChangeModal