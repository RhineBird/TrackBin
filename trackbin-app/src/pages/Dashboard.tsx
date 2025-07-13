import React, { useState, useEffect } from 'react'
import { dashboardService, type DashboardMetrics, type RecentActivity, type LowStockItem } from '../services/dashboardService'
import './Dashboard.css'

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalItems: 0,
    lowStockAlerts: 0,
    totalStockValue: 0,
    activeBins: 0
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [metricsData, activityData, lowStockData] = await Promise.all([
        dashboardService.getMetrics(),
        dashboardService.getRecentActivity(5),
        dashboardService.getLowStockItems()
      ])
      
      setMetrics(metricsData)
      setRecentActivity(activityData)
      setLowStockItems(lowStockData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()

    // Set up real-time subscription
    const subscription = dashboardService.subscribeToUpdates(() => {
      // Reload dashboard data when database changes
      loadDashboardData()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getMetricCardClass = (metric: string, value: number) => {
    if (metric === 'lowStockAlerts' && value > 0) {
      return 'dashboard-card alert'
    }
    return 'dashboard-card'
  }

  if (loading && metrics.totalItems === 0) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Warehouse Dashboard</h1>
        <p>Real-time overview of your inventory and operations</p>
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
            <button onClick={loadDashboardData} className="retry-btn">
              Refresh
            </button>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <div className={getMetricCardClass('totalItems', metrics.totalItems)}>
          <h3>Total Items</h3>
          <p className="dashboard-metric">{metrics.totalItems.toLocaleString()}</p>
          <span className="metric-label">Active SKUs</span>
        </div>
        
        <div className={getMetricCardClass('lowStockAlerts', metrics.lowStockAlerts)}>
          <h3>Low Stock Alerts</h3>
          <p className="dashboard-metric">{metrics.lowStockAlerts}</p>
          <span className="metric-label">Items below threshold</span>
        </div>
        
        <div className={getMetricCardClass('totalStockValue', metrics.totalStockValue)}>
          <h3>Total Stock</h3>
          <p className="dashboard-metric">{metrics.totalStockValue.toLocaleString()}</p>
          <span className="metric-label">Units in warehouse</span>
        </div>
        
        <div className={getMetricCardClass('activeBins', metrics.activeBins)}>
          <h3>Active Bins</h3>
          <p className="dashboard-metric">{metrics.activeBins}</p>
          <span className="metric-label">Locations with stock</span>
        </div>
      </div>

      <div className="dashboard-content">
        {metrics.lowStockAlerts > 0 && (
          <div className="low-stock-section">
            <h3>🚨 Low Stock Alerts</h3>
            <div className="low-stock-items">
              {lowStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="low-stock-item">
                  <span className="item-sku">{item.sku}</span>
                  <span className="item-name">{item.name}</span>
                  <span className="item-quantity">{item.available_quantity} left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="recent-activity">
          <h3>Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="no-activity">No recent activity</p>
          ) : (
            <div className="activity-list">
              {recentActivity.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-main">
                    <span className="activity-action">{activity.action_type}</span>
                    <span className="activity-entity">{activity.entity}</span>
                    {activity.user_name && (
                      <span className="activity-user">by {activity.user_name}</span>
                    )}
                  </div>
                  <div className="activity-time">
                    {formatTimestamp(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && metrics.totalItems > 0 && (
        <div className="loading-overlay">
          <div className="loading-spinner small"></div>
        </div>
      )}
    </div>
  )
}

export default Dashboard