import React from 'react'

const Dashboard: React.FC = () => {
  return (
    <div>
      <h1>Dashboard</h1>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Total Items</h3>
          <p className="dashboard-metric">0</p>
        </div>
        <div className="dashboard-card">
          <h3>Low Stock Alerts</h3>
          <p className="dashboard-metric">0</p>
        </div>
        <div className="dashboard-card">
          <h3>Recent Movements</h3>
          <p className="dashboard-metric">0</p>
        </div>
        <div className="dashboard-card">
          <h3>Active Bins</h3>
          <p className="dashboard-metric">0</p>
        </div>
      </div>
      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <p>No recent activity</p>
      </div>
    </div>
  )
}

export default Dashboard