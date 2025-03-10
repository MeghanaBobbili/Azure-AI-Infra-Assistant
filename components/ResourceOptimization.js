import { useState, useEffect } from 'react'
import MetricsChart from './MetricsChart'
import RecommendationModal from './RecommendationModal'

export default function ResourceOptimization() {
  const [recommendations, setRecommendations] = useState({
    cost: [],
    performance: [],
    security: [],
    metrics: {
      potentialSavings: 0,
      optimizationScore: 100,
      history: {
        labels: [],
        datasets: []
      }
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('all')
  const [actionInProgress, setActionInProgress] = useState(null)
  const [actionResults, setActionResults] = useState({})
  const [selectedRecommendation, setSelectedRecommendation] = useState(null)

  useEffect(() => {
    fetchRecommendations()
  }, [])

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

  const handleOptimizationAction = async (recommendation) => {
    setActionInProgress(recommendation.id)
    try {
      const res = await fetch('/api/recommendations/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId: recommendation.id,
          resourceId: recommendation.resourceId,
          action: recommendation.action
        })
      })
      const result = await res.json()
      
      setActionResults(prev => ({
        ...prev,
        [recommendation.id]: {
          status: res.ok ? 'success' : 'error',
          message: result.message
        }
      }))

      if (res.ok) {
        // Refresh recommendations after successful action
        await fetchRecommendations()
        // Close the modal
        setSelectedRecommendation(null)
      }
    } catch (err) {
      setActionResults(prev => ({
        ...prev,
        [recommendation.id]: {
          status: 'error',
          message: 'Failed to apply optimization'
        }
      }))
    } finally {
      setActionInProgress(null)
    }
  }

  const getActionButton = (recommendation) => {
    const result = actionResults[recommendation.id]
    const isInProgress = actionInProgress === recommendation.id

    if (result?.status === 'success') {
      return (
        <div className="flex items-center text-green-600">
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Optimized</span>
        </div>
      )
    }

    return (
      <button 
        className={`px-3 py-1 rounded border ${
          isInProgress 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-white hover:bg-gray-50'
        }`}
        onClick={() => handleOptimizationAction(recommendation)}
        disabled={isInProgress}
      >
        {isInProgress ? (
          <div className="flex items-center">
            <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Optimizing...
          </div>
        ) : (
          'Take Action'
        )}
      </button>
    )
  }

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
    <>
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
                    {rec.potentialSavings > 0 && (
                      <span className="ml-4">Potential Savings: ${rec.potentialSavings}/month</span>
                    )}
                  </div>
                  {actionResults[rec.id]?.message && (
                    <div className={`mt-2 text-sm ${
                      actionResults[rec.id].status === 'success' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {actionResults[rec.id].message}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {rec.action && getActionButton(rec)}
                  <button 
                    className="px-3 py-1 text-blue-600 hover:text-blue-800"
                    onClick={() => setSelectedRecommendation(rec)}
                  >
                    Learn More
                  </button>
                </div>
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

      {selectedRecommendation && (
        <RecommendationModal
          recommendation={selectedRecommendation}
          onClose={() => setSelectedRecommendation(null)}
          onAction={handleOptimizationAction}
          isActionInProgress={actionInProgress === selectedRecommendation.id}
        />
      )}
    </>
  )
} 