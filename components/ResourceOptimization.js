import { useState, useEffect } from 'react'
import MetricsChart from './MetricsChart'

export default function ResourceOptimization() {
  const [recommendations, setRecommendations] = useState({
    cost: [],
    performance: [],
    security: [],
    metrics: {
      labels: [],
      datasets: []
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('all')

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await fetch('/api/recommendations')
        const data = await res.json()
        setRecommendations(data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch recommendations:', err)
        setError('Failed to fetch recommendations')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecommendations()
  }, [])

  const getImpactColor = (impact) => {
    const colors = {
      high: 'bg-red-50 border-red-200',
      medium: 'bg-yellow-50 border-yellow-200',
      low: 'bg-green-50 border-green-200'
    }
    return colors[impact.toLowerCase()] || colors.low
  }

  const getImpactIcon = (impact) => {
    const icons = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    }
    return icons[impact.toLowerCase()] || icons.low
  }

  const filteredRecommendations = category === 'all' 
    ? [...recommendations.cost, ...recommendations.performance, ...recommendations.security]
    : recommendations[category] || []

  if (isLoading) {
    return <div className="text-center py-4">Loading recommendations...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Resource Optimization</h2>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded p-2"
        >
          <option value="all">All Recommendations</option>
          <option value="cost">Cost Optimization</option>
          <option value="performance">Performance</option>
          <option value="security">Security</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium">Potential Monthly Savings</h3>
          <p className="text-2xl font-bold mt-2">${recommendations.metrics.potentialSavings}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <h3 className="font-medium">Optimization Score</h3>
          <p className="text-2xl font-bold mt-2">{recommendations.metrics.optimizationScore}%</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <h3 className="font-medium">Active Recommendations</h3>
          <p className="text-2xl font-bold mt-2">{filteredRecommendations.length}</p>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRecommendations.map((rec, index) => (
          <div 
            key={index}
            className={`border rounded-lg p-4 ${getImpactColor(rec.impact)}`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{getImpactIcon(rec.impact)}</span>
                  <h3 className="font-medium">{rec.title}</h3>
                </div>
                <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                <div className="mt-2 text-sm text-gray-500">
                  <span>Resource: {rec.resource}</span>
                  {rec.potentialSavings && (
                    <span className="ml-4">Potential Savings: ${rec.potentialSavings}/month</span>
                  )}
                </div>
              </div>
              <button 
                className="px-3 py-1 bg-white rounded border hover:bg-gray-50"
                onClick={() => window.open(rec.actionLink, '_blank')}
              >
                Take Action
              </button>
            </div>
          </div>
        ))}
      </div>

      {recommendations.metrics.history && (
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Optimization Trends</h3>
          <MetricsChart 
            data={recommendations.metrics.history}
            height={300}
          />
        </div>
      )}
    </div>
  )
} 