import React, { useState, useEffect } from 'react'
import { dashboardService, type DashboardMetrics, type RecentActivity, type LowStockItem } from '../services/dashboardService'
import { useI18n } from '../i18n/hooks'
import './Dashboard.css'

const Dashboard: React.FC = () => {
  const { t } = useI18n()
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
      setError(err instanceof Error ? err.message : t('dashboard.load_failed'))
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
          <p>{t('dashboard.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>{t('dashboard.page_title')}</h1>
        <p>{t('dashboard.page_description')}</p>
        {error && (
          <div className="error-message">
            <strong>{t('common.error')}:</strong> {error}
            <button onClick={loadDashboardData} className="retry-btn">
              {t('dashboard.refresh')}
            </button>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <div className={getMetricCardClass('totalItems', metrics.totalItems)}>
          <h3>{t('dashboard.total_items')}</h3>
          <p className="dashboard-metric">{metrics.totalItems.toLocaleString()}</p>
          <span className="metric-label">{t('dashboard.active_skus')}</span>
        </div>
        
        <div className={getMetricCardClass('lowStockAlerts', metrics.lowStockAlerts)}>
          <h3>{t('dashboard.low_stock_alerts')}</h3>
          <p className="dashboard-metric">{metrics.lowStockAlerts}</p>
          <span className="metric-label">{t('dashboard.items_below_threshold')}</span>
        </div>
        
        <div className={getMetricCardClass('totalStockValue', metrics.totalStockValue)}>
          <h3>{t('dashboard.total_stock')}</h3>
          <p className="dashboard-metric">{metrics.totalStockValue.toLocaleString()}</p>
          <span className="metric-label">{t('dashboard.units_in_warehouse')}</span>
        </div>
        
        <div className={getMetricCardClass('activeBins', metrics.activeBins)}>
          <h3>{t('dashboard.active_bins')}</h3>
          <p className="dashboard-metric">{metrics.activeBins}</p>
          <span className="metric-label">{t('dashboard.locations_with_stock')}</span>
        </div>
      </div>

      <div className="dashboard-content">
        {metrics.lowStockAlerts > 0 && (
          <div className="low-stock-section">
            <h3>{t('dashboard.low_stock_alerts_title')}</h3>
            <div className="low-stock-items">
              {lowStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="low-stock-item">
                  <span className="item-sku">{item.sku}</span>
                  <span className="item-name">{item.name}</span>
                  <span className="item-quantity">{t('dashboard.quantity_left', { quantity: item.available_quantity })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="recent-activity">
          <h3>{t('dashboard.recent_activity')}</h3>
          {recentActivity.length === 0 ? (
            <p className="no-activity">{t('dashboard.no_activity')}</p>
          ) : (
            <div className="activity-list">
              {recentActivity.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-main">
                    <span className="activity-action">{activity.action_type}</span>
                    <span className="activity-entity">{activity.entity}</span>
                    {activity.user_name && (
                      <span className="activity-user">{t('dashboard.activity_by', { user: activity.user_name })}</span>
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