import React, { useState, useEffect } from 'react'
import { itemsService, type ItemWithStock } from '../services/itemsService'
import ItemModal from '../components/ItemModal/ItemModal'
import type { Item, User, Role } from '../types/database'
import { useTranslation } from '../i18n/hooks'
import './Items.css'

interface ItemsProps {
  user: User & { role: Role }
}

const Items: React.FC<ItemsProps> = ({ user }) => {
  const { t } = useTranslation()
  const [items, setItems] = useState<ItemWithStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showStockOnly, setShowStockOnly] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const loadItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = showStockOnly 
        ? await itemsService.getItemsWithStockOnly()
        : await itemsService.getItemsWithStock()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      loadItems()
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await itemsService.searchItems(query, showStockOnly)
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()

    // Set up real-time subscription
    const subscription = itemsService.subscribeToItems(() => {
      // Reload items when database changes
      loadItems()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [showStockOnly]) // Reload when toggle changes

  // Handle toggle change
  const handleToggleChange = (stockOnly: boolean) => {
    setShowStockOnly(stockOnly)
    // Clear search when toggling
    if (searchQuery) {
      setSearchQuery('')
    }
  }

  const getStockStatus = (available: number = 0, total: number = 0) => {
    if (total === 0) return 'out-of-stock'
    if (available === 0) return 'reserved'
    if (available < 10) return 'low-stock'
    return 'in-stock'
  }

  const getStockStatusText = (available: number = 0, total: number = 0) => {
    if (total === 0) return 'Out of Stock'
    if (available === 0) return 'All Reserved'
    if (available < 10) return 'Low Stock'
    return 'In Stock'
  }

  const handleAddItem = () => {
    setModalMode('create')
    setSelectedItem(null)
    setModalOpen(true)
  }

  const handleEditItem = (item: ItemWithStock) => {
    setModalMode('edit')
    setSelectedItem(item as Item)
    setModalOpen(true)
  }

  const handleDeleteItem = async (item: ItemWithStock) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await itemsService.deleteItem(item.id, user.id, user.name)
      showNotification('success', 'Item deleted successfully')
      loadItems()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  const handleModalSave = () => {
    const action = modalMode === 'create' ? 'created' : 'updated'
    showNotification('success', `Item ${action} successfully`)
    loadItems()
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  if (loading && items.length === 0) {
    return (
      <div className="items-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>{t('items.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="items-page">
      <div className="page-header">
        <h1>{t('items.page_title')}</h1>
        <p>{t('items.page_description')}</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="notification-close">×</button>
        </div>
      )}

      <div className="items-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder={t('items.search_placeholder')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="controls-middle">
          <div className="stock-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showStockOnly}
                onChange={(e) => handleToggleChange(e.target.checked)}
                className="toggle-checkbox"
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">
                {showStockOnly ? t('items.items_with_stock') : t('items.all_items')}
              </span>
            </label>
          </div>
        </div>
        <div className="controls-actions">
          <button className="btn-success" onClick={handleAddItem}>
            {t('items.add_item')}
          </button>
          <button className="btn-primary" onClick={loadItems}>
            {t('items.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={loadItems} className="retry-btn">
            Try Again
          </button>
        </div>
      )}

      <div className="items-table-container">
        <table className="items-table">
          <thead>
            <tr>
              <th>{t('items.sku')}</th>
              <th>{t('items.name')}</th>
              <th>{t('items.unit')}</th>
              <th>{t('items.total_stock')}</th>
              <th>{t('items.available')}</th>
              <th>{t('items.status')}</th>
              <th>{t('items.description')}</th>
              <th>{t('items.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="no-data">
                  {searchQuery ? t('items.no_search_results') : t('items.no_items')}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code className="sku">{item.sku}</code>
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.unit}</td>
                  <td className={`quantity-cell ${(!item.total_quantity || item.total_quantity === 0) ? 'zero-stock' : ''}`}>
                    {item.total_quantity || 0}
                  </td>
                  <td className={`quantity-cell ${(!item.available_quantity || item.available_quantity === 0) ? 'zero-stock' : ''}`}>
                    {item.available_quantity || 0}
                  </td>
                  <td>
                    <span className={`status-badge ${getStockStatus(item.available_quantity, item.total_quantity)}`}>
                      {getStockStatusText(item.available_quantity, item.total_quantity)}
                    </span>
                  </td>
                  <td className="description-cell">
                    {item.description || '—'}
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="btn-edit"
                      onClick={() => handleEditItem(item)}
                      title="Edit item"
                    >
                      ✏️
                    </button>
                    {user.role.name === 'System Administrator' && (
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteItem(item)}
                        title="Delete item (Admin only)"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loading && items.length > 0 && (
        <div className="loading-overlay">
          <div className="loading-spinner small"></div>
        </div>
      )}

      <div className="items-summary">
        <p>
          Showing {items.length} item{items.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
          {showStockOnly ? ' with stock' : ' (all items)'}
        </p>
      </div>

      <ItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
        item={selectedItem}
        mode={modalMode}
      />
    </div>
  )
}

export default Items