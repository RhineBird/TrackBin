import React, { useState, useEffect } from 'react'
import { receivingService, type ReceiptWithDetails, type CreateReceiptRequest, type BinWithLocation } from '../services/receivingService'
import { itemsService } from '../services/itemsService'
import type { Item } from '../types/database'
import './Receiving.css'

interface ReceiptLineForm {
  id: string
  item_id: string
  quantity_expected: number
  quantity_received: number
  bin_id: string
}

interface ReceiptFormData {
  reference_code: string
  supplier: string
  receipt_lines: ReceiptLineForm[]
}

const Receiving: React.FC = () => {
  const [receipts, setReceipts] = useState<ReceiptWithDetails[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [bins, setBins] = useState<BinWithLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [formData, setFormData] = useState<ReceiptFormData>({
    reference_code: '',
    supplier: '',
    receipt_lines: []
  })

  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [receiptsData, itemsData, binsData] = await Promise.all([
        receivingService.getReceipts(20),
        itemsService.getAllItems(),
        receivingService.getBinsWithLocation()
      ])
      
      console.log('Receipts loaded:', receiptsData.length, receiptsData)
      setReceipts(receiptsData)
      setItems(itemsData)
      setBins(binsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Set up real-time subscription
    const subscription = receivingService.subscribeToReceipts(() => {
      loadData()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData()
      return
    }

    try {
      const results = await receivingService.searchReceipts(searchQuery, 20)
      setReceipts(results)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  const addReceiptLine = () => {
    const newLine: ReceiptLineForm = {
      id: Date.now().toString(),
      item_id: '',
      quantity_expected: 0,
      quantity_received: 0,
      bin_id: ''
    }
    setFormData(prev => ({
      ...prev,
      receipt_lines: [...prev.receipt_lines, newLine]
    }))
  }

  const removeReceiptLine = (lineId: string) => {
    setFormData(prev => ({
      ...prev,
      receipt_lines: prev.receipt_lines.filter(line => line.id !== lineId)
    }))
  }

  const updateReceiptLine = (lineId: string, field: keyof ReceiptLineForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      receipt_lines: prev.receipt_lines.map(line =>
        line.id === lineId ? { ...line, [field]: value } : line
      )
    }))
    
    // Clear error for this field
    if (formErrors[`line_${lineId}_${field}`]) {
      setFormErrors(prev => ({
        ...prev,
        [`line_${lineId}_${field}`]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {}

    if (!formData.reference_code.trim()) {
      errors.reference_code = 'Reference code is required'
    }

    if (!formData.supplier.trim()) {
      errors.supplier = 'Supplier is required'
    }

    if (formData.receipt_lines.length === 0) {
      errors.receipt_lines = 'At least one item is required'
    }

    formData.receipt_lines.forEach(line => {
      if (!line.item_id) {
        errors[`line_${line.id}_item_id`] = 'Item is required'
      }
      if (!line.bin_id) {
        errors[`line_${line.id}_bin_id`] = 'Bin is required'
      }
      if (line.quantity_expected <= 0) {
        errors[`line_${line.id}_quantity_expected`] = 'Expected quantity must be greater than 0'
      }
      if (line.quantity_received < 0) {
        errors[`line_${line.id}_quantity_received`] = 'Received quantity cannot be negative'
      }
    })

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const request: CreateReceiptRequest = {
        reference_code: formData.reference_code,
        supplier: formData.supplier,
        receipt_lines: formData.receipt_lines.map(line => ({
          item_id: line.item_id,
          quantity_expected: line.quantity_expected,
          quantity_received: line.quantity_received,
          bin_id: line.bin_id
        }))
      }

      await receivingService.createReceipt(request)
      
      showNotification('success', 'Receipt created successfully')
      
      // Reset form
      setFormData({
        reference_code: '',
        supplier: '',
        receipt_lines: []
      })
      setShowCreateForm(false)
      
      // Reload data
      loadData()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to create receipt')
    } finally {
      setSubmitting(false)
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getVarianceDisplay = (expected: number, received: number) => {
    const variance = received - expected
    const percentage = expected > 0 ? (variance / expected) * 100 : 0
    
    if (variance === 0) {
      return <span className="variance-neutral">Perfect</span>
    } else if (variance > 0) {
      return <span className="variance-positive">+{variance} (+{percentage.toFixed(1)}%)</span>
    } else {
      return <span className="variance-negative">{variance} ({percentage.toFixed(1)}%)</span>
    }
  }

  if (loading) {
    return (
      <div className="receiving-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading receiving data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="receiving-page">
      <div className="page-header">
        <h1>Receiving</h1>
        <p>Manage incoming shipments and update inventory</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="notification-close">×</button>
        </div>
      )}

      <div className="receiving-actions">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search receipts by reference or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button onClick={handleSearch} className="btn-secondary">Search</button>
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); loadData(); }} className="btn-secondary">Clear</button>
          )}
        </div>
        
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)} 
          className="btn-primary"
        >
          {showCreateForm ? 'Cancel' : 'New Receipt'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-receipt-section">
          <h2>Create New Receipt</h2>
          
          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="receipt-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reference_code">Reference Code *</label>
                <input
                  type="text"
                  id="reference_code"
                  value={formData.reference_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference_code: e.target.value }))}
                  className={formErrors.reference_code ? 'error' : ''}
                  disabled={submitting}
                  placeholder="PO-2025-001"
                />
                {formErrors.reference_code && <span className="field-error">{formErrors.reference_code}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="supplier">Supplier *</label>
                <input
                  type="text"
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  className={formErrors.supplier ? 'error' : ''}
                  disabled={submitting}
                  placeholder="Supplier Name"
                />
                {formErrors.supplier && <span className="field-error">{formErrors.supplier}</span>}
              </div>
            </div>

            <div className="receipt-lines-section">
              <div className="section-header">
                <h3>Items</h3>
                <button type="button" onClick={addReceiptLine} className="btn-secondary">Add Item</button>
              </div>
              
              {formErrors.receipt_lines && <span className="field-error">{formErrors.receipt_lines}</span>}
              
              {formData.receipt_lines.map(line => (
                <div key={line.id} className="receipt-line">
                  <div className="form-group">
                    <label>Item *</label>
                    <select
                      value={line.item_id}
                      onChange={(e) => updateReceiptLine(line.id, 'item_id', e.target.value)}
                      className={formErrors[`line_${line.id}_item_id`] ? 'error' : ''}
                      disabled={submitting}
                    >
                      <option value="">Select an item</option>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.sku} - {item.name}
                        </option>
                      ))}
                    </select>
                    {formErrors[`line_${line.id}_item_id`] && <span className="field-error">{formErrors[`line_${line.id}_item_id`]}</span>}
                  </div>

                  <div className="form-group">
                    <label>Expected Qty *</label>
                    <input
                      type="number"
                      value={line.quantity_expected || ''}
                      onChange={(e) => updateReceiptLine(line.id, 'quantity_expected', parseInt(e.target.value) || 0)}
                      className={formErrors[`line_${line.id}_quantity_expected`] ? 'error' : ''}
                      disabled={submitting}
                      min="1"
                    />
                    {formErrors[`line_${line.id}_quantity_expected`] && <span className="field-error">{formErrors[`line_${line.id}_quantity_expected`]}</span>}
                  </div>

                  <div className="form-group">
                    <label>Received Qty *</label>
                    <input
                      type="number"
                      value={line.quantity_received || ''}
                      onChange={(e) => updateReceiptLine(line.id, 'quantity_received', parseInt(e.target.value) || 0)}
                      className={formErrors[`line_${line.id}_quantity_received`] ? 'error' : ''}
                      disabled={submitting}
                      min="0"
                    />
                    {formErrors[`line_${line.id}_quantity_received`] && <span className="field-error">{formErrors[`line_${line.id}_quantity_received`]}</span>}
                  </div>

                  <div className="form-group">
                    <label>Bin *</label>
                    <select
                      value={line.bin_id}
                      onChange={(e) => updateReceiptLine(line.id, 'bin_id', e.target.value)}
                      className={formErrors[`line_${line.id}_bin_id`] ? 'error' : ''}
                      disabled={submitting}
                    >
                      <option value="">Select a bin</option>
                      {bins.map(bin => (
                        <option key={bin.id} value={bin.id}>
                          {bin.name} - {bin.zone_name} ({bin.warehouse_name})
                        </option>
                      ))}
                    </select>
                    {formErrors[`line_${line.id}_bin_id`] && <span className="field-error">{formErrors[`line_${line.id}_bin_id`]}</span>}
                  </div>

                  <button 
                    type="button" 
                    onClick={() => removeReceiptLine(line.id)}
                    className="btn-danger-small"
                    disabled={submitting}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Creating Receipt...' : 'Create Receipt'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="receipts-section">
        <h2>Recent Receipts</h2>
        
        {receipts.length === 0 ? (
          <div className="no-receipts">
            <p>No receipts found. Create your first receipt to get started.</p>
          </div>
        ) : (
          <div className="receipts-table-container">
            <table className="receipts-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Variance</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(receipt => (
                  <tr key={receipt.id}>
                    <td>{formatTimestamp(receipt.created_at)}</td>
                    <td>
                      <code className="reference-code">{receipt.reference_code}</code>
                    </td>
                    <td>{receipt.supplier}</td>
                    <td className="center">{receipt.total_items}</td>
                    <td className="center">{receipt.total_expected}</td>
                    <td className="center">{receipt.total_received}</td>
                    <td className="center">
                      {getVarianceDisplay(receipt.total_expected || 0, receipt.total_received || 0)}
                    </td>
                    <td>{receipt.user_name || 'Unknown'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Receiving