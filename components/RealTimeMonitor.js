import { useState, useEffect } from 'react'
import MetricsChart from './MetricsChart'

export default function RealTimeMonitor() {
  const [metrics, setMetrics] = useState({
    labels: [],
    datasets: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics/realtime')
        const data = await res.json()
        
        setMetrics(prevMetrics => ({
          labels: [...prevMetrics.labels, new Date().toLocaleTimeString()].slice(-10),
          datasets: data.metrics.map(metric => ({
            id: metric.name.toLowerCase(),
            label: metric.name,
            data: [...(prevMetrics.datasets.find(d => d.id === metric.name.toLowerCase())?.data || []), 
                   metric.value].slice(-10)
          }))
        }))
        setError(null)
      } catch (err) {
        console.error('Failed to fetch metrics:', err)
        setError('Failed to fetch metrics')
      } finally {
        setIsLoading(false)
      }
    }

    // Initial fetch
    fetchMetrics()

    // Set up polling
    const interval = setInterval(fetchMetrics, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return <div className="text-center py-4">Loading metrics...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Real-time Resource Metrics</h2>
      <MetricsChart 
        data={{
          ...metrics,
          title: 'Resource Usage',
          yAxisLabel: 'Usage (%)',
          xAxisLabel: 'Time',
          unit: '%'
        }}
        height={300}
      />
    </div>
  )
} 