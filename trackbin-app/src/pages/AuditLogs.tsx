import React, { useState, useEffect } from 'react'
import { auditService, type AuditLogWithDetails, type AuditFilters } from '../services/auditService'
import './AuditLogs.css'

const AuditLogs: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogWithDetails[]>([])
  const [actionTypes, setActionTypes] = useState<string[]>([])
  const [entities, setEntities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [filters, setFilters] = useState<AuditFilters>({
    action_type: '',
    entity: '',
    start_date: '',
    end_date: ''
  })

  const [stats, setStats] = useState<{
    total_actions: number
    unique_users: number
    most_common_action: string
    most_active_entity: string
  } | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [logsData, actionTypesData, entitiesData, statsData] = await Promise.all([
        auditService.getAuditLogs(filters, 100),
        auditService.getActionTypes(),
        auditService.getEntities(),
        auditService.getAuditStats(30)
      ])
      
      setAuditLogs(logsData)
      setActionTypes(actionTypesData)
      setEntities(entitiesData)
      setStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Set up real-time subscription
    const subscription = auditService.subscribeToAuditLogs(() => {
      loadData()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [filters])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData()
      return
    }

    try {
      setLoading(true)
      const results = await auditService.searchAuditLogs(searchQuery, 100)
      setAuditLogs(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field: keyof AuditFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const clearFilters = () => {
    setFilters({
      action_type: '',
      entity: '',
      start_date: '',
      end_date: ''
    })
    setSearchQuery('')
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const csvContent = await auditService.exportAuditLogs(filters)
      
      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      showNotification('success', 'Audit logs exported successfully')
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getActionTypeColor = (actionType: string): string => {
    switch (actionType.toLowerCase()) {
      case 'insert': return 'action-insert'
      case 'update': return 'action-update'
      case 'delete': return 'action-delete'
      default: return 'action-default'
    }
  }

  const formatEntityName = (entity: string): string => {
    return entity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (loading && auditLogs.length === 0) {
    return (
      <div className="audit-logs-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading audit logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="audit-logs-page">
      <div className="page-header">
        <h1>Audit Logs</h1>
        <p>View system activities and track all changes</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="notification-close">×</button>
        </div>
      )}

      {stats && (
        <div className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.total_actions}</div>
              <div className="stat-label">Total Actions (30 days)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.unique_users}</div>
              <div className="stat-label">Active Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatEntityName(stats.most_common_action)}</div>
              <div className="stat-label">Most Common Action</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatEntityName(stats.most_active_entity)}</div>
              <div className="stat-label">Most Active Entity</div>
            </div>
          </div>
        </div>
      )}

      <div className="audit-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search by entity, action, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button onClick={handleSearch} className="btn-secondary">Search</button>
        </div>
        
        <div className="controls-right">
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`btn-secondary ${showFilters ? 'active' : ''}`}
          >
            Filters
          </button>
          <button 
            onClick={handleExport} 
            className="btn-secondary"
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Action Type</label>
              <select
                value={filters.action_type || ''}
                onChange={(e) => handleFilterChange('action_type', e.target.value)}
              >
                <option value="">All Actions</option>
                {actionTypes.map(type => (
                  <option key={type} value={type}>{formatEntityName(type)}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Entity</label>
              <select
                value={filters.entity || ''}
                onChange={(e) => handleFilterChange('entity', e.target.value)}
              >
                <option value="">All Entities</option>
                {entities.map(entity => (
                  <option key={entity} value={entity}>{formatEntityName(entity)}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Start Date</label>
              <input
                type="datetime-local"
                value={filters.start_date || ''}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>End Date</label>
              <input
                type="datetime-local"
                value={filters.end_date || ''}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </div>
          </div>
          
          <div className="filters-actions">
            <button onClick={clearFilters} className="btn-secondary">Clear All</button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="audit-logs-section">
        <div className="section-header">
          <h2>Activity Log</h2>
          <div className="log-count">
            {auditLogs.length} {auditLogs.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
        
        {auditLogs.length === 0 ? (
          <div className="no-logs">
            <p>No audit logs found. Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="audit-logs-table-container">
            <table className="audit-logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td className="timestamp-cell">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="user-cell">
                      {log.user_name || 'Unknown'}
                    </td>
                    <td className="action-cell">
                      <span className={`action-badge ${getActionTypeColor(log.action_type)}`}>
                        {formatEntityName(log.action_type)}
                      </span>
                    </td>
                    <td className="entity-cell">
                      {formatEntityName(log.entity)}
                    </td>
                    <td className="details-cell">
                      {log.entity_details}
                    </td>
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

export default AuditLogs