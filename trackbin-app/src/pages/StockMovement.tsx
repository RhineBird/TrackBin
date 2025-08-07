import React, { useState, useEffect } from 'react'
import { stockMovementService, type StockMovementWithDetails, type ItemStockLocation, type BinWithLocation } from '../services/stockMovementService'
import { itemsService } from '../services/itemsService'
import StatusChangeModal from '../components/StatusChangeModal'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/hooks'
import type { Item } from '../types/database'
import './StockMovement.css'

interface MovementFormData {
  item_id: string
  from_bin_id: string
  to_bin_id: string
  quantity: number | string
  reason: string
}

const StockMovement: React.FC = () => {
  const { getCurrentUserId } = useAuth()
  const { t } = useI18n()
  const [movements, setMovements] = useState<StockMovementWithDetails[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [bins, setBins] = useState<BinWithLocation[]>([])
  const [itemStockLocations, setItemStockLocations] = useState<ItemStockLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [statusChangeModalOpen, setStatusChangeModalOpen] = useState(false)
  const [selectedStockEntry, setSelectedStockEntry] = useState<{
    id: string
    item_sku: string
    item_name: string
    bin_name: string
    zone_name: string
    quantity: number
    status: 'available' | 'reserved' | 'quarantined' | 'damaged'
  } | null>(null)

  const [formData, setFormData] = useState<MovementFormData>({
    item_id: '',
    from_bin_id: '',
    to_bin_id: '',
    quantity: 0,
    reason: ''
  })

  const [formErrors, setFormErrors] = useState<Partial<MovementFormData>>({})

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [movementsData, itemsData, binsData] = await Promise.all([
        stockMovementService.getMovements(20),
        itemsService.getAllItems(),
        stockMovementService.getBinsWithLocation()
      ])
      
      setMovements(movementsData)
      setItems(itemsData)
      setBins(binsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stock_movement.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  const loadItemStockLocations = async (itemId: string) => {
    if (!itemId) {
      setItemStockLocations([])
      return
    }

    try {
      const locations = await stockMovementService.getItemStockLocations(itemId)
      setItemStockLocations(locations)
    } catch (err) {
      console.error('Failed to load item stock locations:', err)
      setItemStockLocations([])
    }
  }

  useEffect(() => {
    loadData()

    // Set up real-time subscription
    const subscription = stockMovementService.subscribeToMovements(() => {
      loadData()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    loadItemStockLocations(formData.item_id)
  }, [formData.item_id])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : value
    }))
    
    // Clear error for this field
    if (formErrors[name as keyof MovementFormData]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: undefined
      }))
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<MovementFormData> = {}

    if (!formData.item_id) {
      errors.item_id = t('stock_movement.item_required')
    }

    if (!formData.from_bin_id) {
      errors.from_bin_id = t('stock_movement.source_bin_required')
    }

    if (!formData.to_bin_id) {
      errors.to_bin_id = t('stock_movement.destination_bin_required')
    }

    if (formData.from_bin_id === formData.to_bin_id) {
      errors.to_bin_id = t('stock_movement.destination_different')
    }

    if (!formData.quantity || Number(formData.quantity) <= 0) {
      errors.quantity = t('stock_movement.quantity_required')
    }

    if (!formData.reason.trim()) {
      errors.reason = t('stock_movement.reason_required')
    }

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

    const currentUserId = getCurrentUserId()
    if (!currentUserId) {
      showNotification('error', 'User not authenticated')
      return
    }

    try {
      await stockMovementService.moveStock({
        ...formData,
        quantity: Number(formData.quantity),
        user_id: currentUserId
      })
      
      showNotification('success', t('stock_movement.stock_moved'))
      
      // Reset form
      setFormData({
        item_id: '',
        from_bin_id: '',
        to_bin_id: '',
        quantity: 0,
        reason: ''
      })
      setItemStockLocations([])
      
      // Reload data
      loadData()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : t('stock_movement.move_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleStatusChange = (location: ItemStockLocation) => {
    setSelectedStockEntry({
      id: location.stock_entry_id,
      item_sku: location.item_sku,
      item_name: location.item_name,
      bin_name: location.bin_name,
      zone_name: location.zone_name,
      quantity: location.quantity,
      status: location.status
    })
    setStatusChangeModalOpen(true)
  }

  const handleStatusChanged = () => {
    showNotification('success', t('stock_movement.status_updated'))
    // Reload the item stock locations
    if (formData.item_id) {
      loadItemStockLocations(formData.item_id)
    }
    setStatusChangeModalOpen(false)
    setSelectedStockEntry(null)
  }

  const getAvailableQuantity = (binId: string): number => {
    const location = itemStockLocations.find(loc => loc.bin_id === binId && loc.status === 'available')
    return location ? location.quantity : 0
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getSourceBinOptions = () => {
    return itemStockLocations.filter(loc => loc.status === 'available' && loc.quantity > 0)
  }

  if (loading) {
    return (
      <div className="stock-movement-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>{t('stock_movement.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="stock-movement-page">
      <div className="page-header">
        <h1>{t('stock_movement.page_title')}</h1>
        <p>{t('stock_movement.page_description')}</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="notification-close">×</button>
        </div>
      )}

      <div className="movement-content">
        <div className="movement-form-section">
          <h2>{t('stock_movement.move_stock')}</h2>
          
          {error && (
            <div className="error-message">
              <strong>{t('common.error')}:</strong> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="movement-form">
            <div className="form-group">
              <label htmlFor="item_id">{t('stock_movement.item')} *</label>
              <select
                id="item_id"
                name="item_id"
                value={formData.item_id}
                onChange={handleInputChange}
                className={formErrors.item_id ? 'error' : ''}
                disabled={submitting}
              >
                <option value="">{t('stock_movement.select_item')}</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.sku} - {item.name}
                  </option>
                ))}
              </select>
              {formErrors.item_id && <span className="field-error">{formErrors.item_id}</span>}
            </div>

            {itemStockLocations.length > 0 && (
              <div className="stock-locations">
                <h3>{t('stock_movement.current_locations')}</h3>
                <div className="locations-grid">
                  {itemStockLocations.map(location => (
                    <div key={location.bin_id} className="location-card">
                      <div className="location-info">
                        <strong>{location.bin_name}</strong>
                        <span className="location-path">{location.warehouse_name} → {location.zone_name}</span>
                      </div>
                      <div className="location-details">
                        <div className="location-quantity">
                          <span className={`quantity ${location.status}`}>{location.quantity}</span>
                          <span className={`status-badge ${location.status}`}>
                            {location.status.charAt(0).toUpperCase() + location.status.slice(1)}
                          </span>
                        </div>
                        <div className="location-actions">
                          <button
                            type="button"
                            className="btn-status-change"
                            onClick={() => handleStatusChange(location)}
                            title={t('stock_movement.change_status')}
                          >
                            {t('stock_movement.change_status')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="from_bin_id">{t('stock_movement.source_bin')} *</label>
              <select
                id="from_bin_id"
                name="from_bin_id"
                value={formData.from_bin_id}
                onChange={handleInputChange}
                className={formErrors.from_bin_id ? 'error' : ''}
                disabled={submitting || !formData.item_id}
              >
                <option value="">{t('stock_movement.select_source_bin')}</option>
                {getSourceBinOptions().map(location => (
                  <option key={location.bin_id} value={location.bin_id}>
                    {location.bin_name} - {location.zone_name} ({t('stock_movement.available_quantity', { quantity: location.quantity })})
                  </option>
                ))}
              </select>
              {formErrors.from_bin_id && <span className="field-error">{formErrors.from_bin_id}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="to_bin_id">{t('stock_movement.destination_bin')} *</label>
              <select
                id="to_bin_id"
                name="to_bin_id"
                value={formData.to_bin_id}
                onChange={handleInputChange}
                className={formErrors.to_bin_id ? 'error' : ''}
                disabled={submitting}
              >
                <option value="">{t('stock_movement.select_destination_bin')}</option>
                {bins.map(bin => (
                  <option key={bin.id} value={bin.id}>
                    {bin.name} - {bin.zone_name} ({bin.warehouse_name})
                  </option>
                ))}
              </select>
              {formErrors.to_bin_id && <span className="field-error">{formErrors.to_bin_id}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="quantity">{t('stock_movement.quantity')} *</label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity || ''}
                onChange={handleInputChange}
                className={formErrors.quantity ? 'error' : ''}
                disabled={submitting}
                min="1"
                max={formData.from_bin_id ? getAvailableQuantity(formData.from_bin_id) : undefined}
              />
              {formData.from_bin_id && (
                <div className="quantity-info">
                  {t('stock_movement.available_units', { quantity: getAvailableQuantity(formData.from_bin_id) })}
                </div>
              )}
              {formErrors.quantity && <span className="field-error">{formErrors.quantity}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="reason">{t('stock_movement.reason')} *</label>
              <textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                className={formErrors.reason ? 'error' : ''}
                disabled={submitting}
                rows={3}
                placeholder={t('stock_movement.reason_placeholder')}
              />
              {formErrors.reason && <span className="field-error">{formErrors.reason}</span>}
            </div>

            <button 
              type="submit" 
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? t('stock_movement.moving_stock') : t('stock_movement.move_stock')}
            </button>
          </form>
        </div>

        <div className="movement-history-section">
          <h2>{t('stock_movement.recent_movements')}</h2>
          
          {error && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              <strong>{t('common.error')}:</strong> {error}
            </div>
          )}
          
          {movements.length === 0 && !loading ? (
            <div className="no-movements">
              <p>{t('stock_movement.no_movements')}</p>
              {!error && (
                <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                  If you just performed a stock movement, try refreshing the page.
                </p>
              )}
            </div>
          ) : movements.length > 0 ? (
            <div className="movements-table-container">
              <table className="movements-table">
                <thead>
                  <tr>
                    <th>{t('stock_movement.date')}</th>
                    <th>{t('stock_movement.item')}</th>
                    <th>{t('stock_movement.from')}</th>
                    <th>{t('stock_movement.to')}</th>
                    <th>{t('stock_movement.quantity')}</th>
                    <th>{t('stock_movement.reason')}</th>
                    <th>{t('stock_movement.user')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(movement => (
                    <tr key={movement.id}>
                      <td>{formatTimestamp(movement.created_at)}</td>
                      <td>
                        <div className="item-info">
                          <code className="sku">{movement.item?.sku || t('stock_movement.unknown')}</code>
                          <span className="item-name">{movement.item?.name || t('stock_movement.unknown')}</span>
                        </div>
                      </td>
                      <td>{movement.from_bin?.name || t('stock_movement.unknown')}</td>
                      <td>{movement.to_bin?.name || t('stock_movement.unknown')}</td>
                      <td className="quantity-cell">{movement.quantity}</td>
                      <td className="reason-cell">{movement.reason}</td>
                      <td>{movement.user_name || t('stock_movement.unknown')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <StatusChangeModal
        isOpen={statusChangeModalOpen}
        onClose={() => setStatusChangeModalOpen(false)}
        onStatusChanged={handleStatusChanged}
        stockEntry={selectedStockEntry}
      />
    </div>
  )
}

export default StockMovement