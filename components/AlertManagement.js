import { useState, useEffect } from 'react'
import NotificationToast from './NotificationToast'

export default function AlertManagement() {
  const [alerts, setAlerts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notification, setNotification] = useState(null)
  const [filter, setFilter] = useState('all') // all, critical, warning, info

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts/list')
        const data = await res.json()
        setAlerts(data.alerts)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch alerts:', err)
        setError('Failed to fetch alerts')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const handleAcknowledge = async (alertId) => {
    try {
      const res = await fetch(`/api/alerts/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId })
      })
      
      if (!res.ok) throw new Error('Failed to acknowledge alert')
      
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: 'acknowledged' }
          : alert
      ))
      
      setNotification({
        message: 'Alert acknowledged successfully',
        type: 'success'
      })
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
      setNotification({
        message: 'Failed to acknowledge alert',
        type: 'error'
      })
    }
  }

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'bg-red-100 border-red-500 text-red-800',
      warning: 'bg-yellow-100 border-yellow-500 text-yellow-800',
      info: 'bg-blue-100 border-blue-500 text-blue-800'
    }
    return colors[severity.toLowerCase()] || colors.info
  }

  const filteredAlerts = alerts.filter(alert => 
    filter === 'all' || alert.severity.toLowerCase() === filter
  )

  if (isLoading) {
    return <div className="text-center py-4">Loading alerts...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Alert Management</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded p-2"
          >
            <option value="all">All Alerts</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No alerts found
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id}
              className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{alert.title}</h3>
                  <p className="text-sm mt-1">{alert.description}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>Resource: {alert.resource}</span>
                    <span>Time: {new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                {alert.status !== 'acknowledged' && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-3 py-1 bg-white rounded border hover:bg-gray-50"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {notification && (
        <NotificationToast
          {...notification}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  )
} 