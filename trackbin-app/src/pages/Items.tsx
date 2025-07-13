import React, { useState, useEffect } from 'react'
import { itemsService, type ItemWithStock } from '../services/itemsService'
import './Items.css'

const Items: React.FC = () => {
  const [items, setItems] = useState<ItemWithStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await itemsService.getItemsWithStock()
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
      const data = await itemsService.searchItems(query)
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
  }, [])

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

  if (loading && items.length === 0) {
    return (
      <div className="items-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading items...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="items-page">
      <div className="page-header">
        <h1>Inventory Items</h1>
        <p>Manage your warehouse inventory and stock levels</p>
      </div>

      <div className="items-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search items by SKU or name..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <button className="btn-primary" onClick={loadItems}>
          Refresh
        </button>
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
              <th>SKU</th>
              <th>Name</th>
              <th>Unit</th>
              <th>Total Stock</th>
              <th>Available</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="no-data">
                  {searchQuery ? 'No items found matching your search.' : 'No items found. Please add some items to get started.'}
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
                  <td className="quantity-cell">
                    {item.total_quantity || 0}
                  </td>
                  <td className="quantity-cell">
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
        </p>
      </div>
    </div>
  )
}

export default Items