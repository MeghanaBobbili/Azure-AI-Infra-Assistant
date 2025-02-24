import { useState, useEffect } from 'react'
import MetricsChart from './MetricsChart'

export default function ResourceHealthMonitor() {
  const [healthData, setHealthData] = useState({
    resources: [],
    metrics: {
      labels: [],
      datasets: [],
      title: 'Resource Performance',
      yAxisLabel: 'Usage (%)',
      xAxisLabel: 'Time'
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedResource, setSelectedResource] = useState('all')

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const res = await fetch(`/api/health/status?resource=${selectedResource}`)
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        const data = await res.json()
        setHealthData({
          resources: data.resources || [],
          metrics: {
            labels: data.metrics?.labels || [],
            datasets: data.metrics?.datasets || [],
            title: data.metrics?.title || 'Resource Performance',
            yAxisLabel: data.metrics?.yAxisLabel || 'Usage (%)',
            xAxisLabel: data.metrics?.xAxisLabel || 'Time'
          }
        })
        setError(null)
      } catch (err) {
        console.error('Failed to fetch health data:', err)
        setError('Failed to fetch health data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchHealthData()
    const interval = setInterval(fetchHealthData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [selectedResource])

  const getStatusColor = (status) => {
    const colors = {
      healthy: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
      unknown: 'bg-gray-100 text-gray-800'
    }
    return colors[status.toLowerCase()] || colors.unknown
  }

  if (isLoading) {
    return <div className="text-center py-4">Loading health status...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
  }

  if (!healthData.resources || healthData.resources.length === 0) {
    return <div className="text-center py-4">No resource health data available</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Resource Health</h2>
        <select
          value={selectedResource}
          onChange={(e) => setSelectedResource(e.target.value)}
          className="border rounded p-2"
        >
          <option value="all">All Resources</option>
          {healthData.resources.map(resource => (
            <option key={resource.id} value={resource.id}>
              {resource.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {healthData.resources.map(resource => (
          <div 
            key={resource.id}
            className="border rounded-lg p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium">{resource.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(resource.status)}`}>
                {resource.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{resource.type}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>CPU</span>
                <span>{resource.metrics?.cpu || '0'}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Memory</span>
                <span>{resource.metrics?.memory || '0'}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Uptime</span>
                <span>{resource.metrics?.uptime || '0'}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {healthData.metrics && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4">Performance Trends</h3>
          <MetricsChart 
            data={healthData.metrics}
            height={300}
          />
        </div>
      )}
    </div>
  )
} 