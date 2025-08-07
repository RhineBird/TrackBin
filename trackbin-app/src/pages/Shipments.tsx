import React, { useState, useEffect } from 'react'
import { shipmentsService, type ShipmentWithDetails, type CreateShipmentRequest, type AvailableStock } from '../services/shipmentsService'
import { useI18n } from '../i18n/hooks'
import './Shipments.css'

interface ShipmentLineForm {
  id: string
  item_id: string
  quantity: number
  bin_id: string
  available_quantity?: number
}

interface ShipmentFormData {
  reference_code: string
  customer: string
  shipment_lines: ShipmentLineForm[]
}

const Shipments: React.FC = () => {
  const { t } = useI18n()
  const [shipments, setShipments] = useState<ShipmentWithDetails[]>([])
  const [availableStock, setAvailableStock] = useState<AvailableStock[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [formData, setFormData] = useState<ShipmentFormData>({
    reference_code: '',
    customer: '',
    shipment_lines: []
  })

  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [shipmentsData, stockData] = await Promise.all([
        shipmentsService.getShipments(20),
        shipmentsService.getAvailableStock()
      ])
      
      setShipments(shipmentsData)
      setAvailableStock(stockData)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shipments.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Set up real-time subscription
    const subscription = shipmentsService.subscribeToShipments(() => {
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
      const results = await shipmentsService.searchShipments(searchQuery, 20)
      setShipments(results)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  const addShipmentLine = () => {
    const newLine: ShipmentLineForm = {
      id: Date.now().toString(),
      item_id: '',
      quantity: 0,
      bin_id: ''
    }
    setFormData(prev => ({
      ...prev,
      shipment_lines: [...prev.shipment_lines, newLine]
    }))
  }

  const removeShipmentLine = (lineId: string) => {
    setFormData(prev => ({
      ...prev,
      shipment_lines: prev.shipment_lines.filter(line => line.id !== lineId)
    }))
  }

  const updateShipmentLine = (lineId: string, field: keyof ShipmentLineForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      shipment_lines: prev.shipment_lines.map(line => {
        if (line.id === lineId) {
          const updatedLine = { ...line, [field]: value }
          
          // If item_id or bin_id changed, update available quantity
          if (field === 'item_id' || field === 'bin_id') {
            const stockEntry = availableStock.find(stock => 
              stock.item_id === updatedLine.item_id && stock.bin_id === updatedLine.bin_id
            )
            updatedLine.available_quantity = stockEntry?.available_quantity || 0
          }
          
          return updatedLine
        }
        return line
      })
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
      errors.reference_code = t('shipments.reference_required')
    }

    if (!formData.customer.trim()) {
      errors.customer = t('shipments.customer_required')
    }

    if (formData.shipment_lines.length === 0) {
      errors.shipment_lines = t('shipments.items_required')
    }

    formData.shipment_lines.forEach(line => {
      if (!line.item_id) {
        errors[`line_${line.id}_item_id`] = t('shipments.item_selection_required')
      }
      if (!line.bin_id) {
        errors[`line_${line.id}_bin_id`] = t('shipments.bin_selection_required')
      }
      if (line.quantity <= 0) {
        errors[`line_${line.id}_quantity`] = t('shipments.quantity_required')
      }
      if (line.available_quantity !== undefined && line.quantity > line.available_quantity) {
        errors[`line_${line.id}_quantity`] = t('shipments.quantity_exceeds', { available: line.available_quantity })
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
      const request: CreateShipmentRequest = {
        reference_code: formData.reference_code,
        customer: formData.customer,
        shipment_lines: formData.shipment_lines.map(line => ({
          item_id: line.item_id,
          quantity: line.quantity,
          bin_id: line.bin_id
        }))
      }

      await shipmentsService.createShipment(request)
      
      showNotification('success', t('shipments.shipment_created'))
      
      // Reset form
      setFormData({
        reference_code: '',
        customer: '',
        shipment_lines: []
      })
      setShowCreateForm(false)
      
      // Reload data
      loadData()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : t('shipments.create_failed'))
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

  const getAvailableStockForItem = (itemId: string): AvailableStock[] => {
    return availableStock.filter(stock => stock.item_id === itemId)
  }

  const getUniqueItems = (): AvailableStock[] => {
    const uniqueItems = new Map<string, AvailableStock>()
    availableStock.forEach(stock => {
      if (!uniqueItems.has(stock.item_id)) {
        uniqueItems.set(stock.item_id, stock)
      }
    })
    return Array.from(uniqueItems.values())
  }

  if (loading) {
    return (
      <div className="shipments-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>{t('shipments.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="shipments-page">
      <div className="page-header">
        <h1>{t('shipments.page_title')}</h1>
        <p>{t('shipments.page_description')}</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="notification-close">×</button>
        </div>
      )}

      <div className="shipments-actions">
        <div className="search-section">
          <input
            type="text"
            placeholder={t('shipments.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button onClick={handleSearch} className="btn-secondary">{t('shipments.search')}</button>
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); loadData(); }} className="btn-secondary">{t('shipments.clear')}</button>
          )}
        </div>
        
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)} 
          className="btn-primary"
        >
          {showCreateForm ? t('shipments.cancel') : t('shipments.new_shipment')}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-shipment-section">
          <h2>{t('shipments.create_new_shipment')}</h2>
          
          {error && (
            <div className="error-message">
              <strong>{t('common.error')}:</strong> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="shipment-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reference_code">{t('shipments.reference_code')} *</label>
                <input
                  type="text"
                  id="reference_code"
                  value={formData.reference_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference_code: e.target.value }))}
                  className={formErrors.reference_code ? 'error' : ''}
                  disabled={submitting}
                  placeholder="SH-2025-001"
                />
                {formErrors.reference_code && <span className="field-error">{formErrors.reference_code}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="customer">{t('shipments.customer')} *</label>
                <input
                  type="text"
                  id="customer"
                  value={formData.customer}
                  onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                  className={formErrors.customer ? 'error' : ''}
                  disabled={submitting}
                  placeholder="Customer Name"
                />
                {formErrors.customer && <span className="field-error">{formErrors.customer}</span>}
              </div>
            </div>

            <div className="shipment-lines-section">
              <div className="section-header">
                <h3>{t('shipments.items_to_ship')}</h3>
                <button type="button" onClick={addShipmentLine} className="btn-secondary">{t('shipments.add_item')}</button>
              </div>
              
              {formErrors.shipment_lines && <span className="field-error">{formErrors.shipment_lines}</span>}
              
              {formData.shipment_lines.map(line => (
                <div key={line.id} className="shipment-line">
                  <div className="shipment-line-fields">
                    <div className="form-group">
                      <label>{t('shipments.item')} *</label>
                      <select
                        value={line.item_id}
                        onChange={(e) => updateShipmentLine(line.id, 'item_id', e.target.value)}
                        className={formErrors[`line_${line.id}_item_id`] ? 'error' : ''}
                        disabled={submitting}
                      >
                        <option value="">{t('shipments.select_item')}</option>
                        {getUniqueItems().map(stock => (
                          <option key={stock.item_id} value={stock.item_id}>
                            {stock.item_sku} - {stock.item_name}
                          </option>
                        ))}
                      </select>
                      {formErrors[`line_${line.id}_item_id`] && <span className="field-error">{formErrors[`line_${line.id}_item_id`]}</span>}
                    </div>

                    <div className="form-group">
                      <label>{t('shipments.bin_location')} *</label>
                      <select
                        value={line.bin_id}
                        onChange={(e) => updateShipmentLine(line.id, 'bin_id', e.target.value)}
                        className={formErrors[`line_${line.id}_bin_id`] ? 'error' : ''}
                        disabled={submitting || !line.item_id}
                      >
                        <option value="">{t('shipments.select_bin')}</option>
                        {getAvailableStockForItem(line.item_id).map(stock => (
                          <option key={`${stock.item_id}-${stock.bin_id}`} value={stock.bin_id}>
                            {stock.bin_name} - {stock.zone_name} ({t('shipments.available_quantity', { quantity: stock.available_quantity })})
                          </option>
                        ))}
                      </select>
                      {formErrors[`line_${line.id}_bin_id`] && <span className="field-error">{formErrors[`line_${line.id}_bin_id`]}</span>}
                    </div>

                    <div className="form-group">
                      <label>{t('shipments.quantity')} *</label>
                      <input
                        type="number"
                        value={line.quantity || ''}
                        onChange={(e) => updateShipmentLine(line.id, 'quantity', parseInt(e.target.value) || 0)}
                        className={formErrors[`line_${line.id}_quantity`] ? 'error' : ''}
                        disabled={submitting}
                        min="1"
                        max={line.available_quantity || undefined}
                      />
                      {line.available_quantity !== undefined && (
                        <div className="quantity-info">
                          {t('shipments.available_units', { quantity: line.available_quantity, unit: availableStock.find(s => s.item_id === line.item_id)?.item_unit || t('shipments.units') })}
                        </div>
                      )}
                      {formErrors[`line_${line.id}_quantity`] && <span className="field-error">{formErrors[`line_${line.id}_quantity`]}</span>}
                    </div>
                  </div>

                  <div className="shipment-line-actions">
                    <button 
                      type="button" 
                      onClick={() => removeShipmentLine(line.id)}
                      className="btn-danger-small"
                      disabled={submitting}
                    >
                      {t('shipments.remove')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? t('shipments.creating_shipment') : t('shipments.create_shipment')}
              </button>
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
                disabled={submitting}
              >
                {t('shipments.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="shipments-section">
        <h2>{t('shipments.recent_shipments')}</h2>
        
        {shipments.length === 0 ? (
          <div className="no-shipments">
            <p>{t('shipments.no_shipments')}</p>
          </div>
        ) : (
          <div className="shipments-table-container">
            <table className="shipments-table">
              <thead>
                <tr>
                  <th>{t('shipments.date')}</th>
                  <th>{t('shipments.reference')}</th>
                  <th>{t('shipments.customer')}</th>
                  <th>{t('shipments.items')}</th>
                  <th>{t('shipments.total_qty')}</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(shipment => (
                  <tr key={shipment.id}>
                    <td>{formatTimestamp(shipment.created_at)}</td>
                    <td>
                      <code className="reference-code">{shipment.reference_code}</code>
                    </td>
                    <td>{shipment.customer}</td>
                    <td className="center">{shipment.total_items}</td>
                    <td className="center">{shipment.total_quantity}</td>
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

export default Shipments