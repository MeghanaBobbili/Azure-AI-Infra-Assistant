import { useState, useEffect } from 'react'
import MetricsChart from './MetricsChart'

export default function CostAnalysisDashboard() {
  const [costData, setCostData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeRange, setTimeRange] = useState('30d')

  useEffect(() => {
    const fetchCostData = async () => {
      try {
        const res = await fetch(`/api/costs/analysis?timeRange=${timeRange}`)
        const data = await res.json()
        setCostData(data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch cost data:', err)
        setError('Failed to fetch cost data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCostData()
  }, [timeRange])

  const formatCost = (cost) => {
    if (cost === 0) return '$0.00'
    if (cost < 0.01) return `$${cost.toFixed(6)}`
    if (cost < 1) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(2)}`
  }

  if (isLoading) {
    return <div className="text-center py-4">Loading cost analysis...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
  }

  if (!costData?.costs?.length || costData?.message) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Cost Analysis</h2>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border rounded p-2"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-blue-800 mb-2">No Cost Data Available</h3>
              <div className="text-blue-700 space-y-2">
                <p>This could be because:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your subscription is new or free tier</li>
                  <li>No billable resources have been deployed</li>
                  <li>Cost data takes 24-48 hours to appear</li>
                  <li>The current billing period hasn't closed</li>
                </ul>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-blue-700 font-medium">What you can do:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Set up a budget to track future costs</li>
                  <li>Review the pricing calculator for planned resources</li>
                  <li>Enable cost alerts for your subscription</li>
                </ul>
              </div>
              <div className="mt-4 flex space-x-4">
                <a 
                  href="https://azure.microsoft.com/en-us/pricing/calculator/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  <span>Pricing Calculator</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a 
                  href="https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  <span>Set Up Budget</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Cost Analysis</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border rounded p-2"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800">Total Cost</h3>
          <p className="text-2xl font-bold text-blue-900 mt-1">
            {formatCost(parseFloat(costData.total))} {costData.currency}
          </p>
          <p className="text-sm text-blue-700 mt-1">
            {costData.startDate} to {costData.endDate}
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-800">Daily Average</h3>
          <p className="text-2xl font-bold text-green-900 mt-1">
            {formatCost(costData.daily.average)}
          </p>
          <p className="text-sm text-green-700 mt-1">
            Per day this period
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-purple-800">Projected Monthly</h3>
          <p className="text-2xl font-bold text-purple-900 mt-1">
            {formatCost(costData.forecast.total)}
          </p>
          <p className="text-sm text-purple-700 mt-1">
            Based on current usage
          </p>
        </div>
      </div>

      {costData.daily.dates.length > 0 && (
        <div className="mt-6 bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-medium mb-4">Daily Cost Trend</h3>
          <MetricsChart 
            data={{
              labels: costData.daily.dates,
              datasets: [{
                id: 'daily-cost',
                label: 'Daily Cost',
                data: costData.daily.costs,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#3B82F6',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#2563EB',
                pointHoverBorderColor: '#fff'
              }],
              title: 'Daily Cost Trend',
              yAxisLabel: `Cost (${costData.currency})`,
              xAxisLabel: 'Date',
              height: 200
            }}
            options={{
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      return `Cost: ${formatCost(context.raw)}`
                    }
                  }
                }
              },
              scales: {
                x: {
                  grid: {
                    display: false
                  },
                  ticks: {
                    font: {
                      size: 11
                    }
                  }
                },
                y: {
                  beginAtZero: true,
                  grid: {
                    color: 'rgba(0,0,0,0.05)'
                  },
                  ticks: {
                    callback: (value) => formatCost(value),
                    font: {
                      size: 11
                    }
                  }
                }
              }
            }}
          />
          <div className="mt-2 text-sm text-gray-500 text-center">
            Showing cost trends from {costData.startDate} to {costData.endDate}
          </div>
        </div>
      )}

      {costData.topResources?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4">Top Resources by Cost</h3>
          <div className="space-y-3">
            {costData.topResources.map((resource, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{resource.name}</h4>
                    <p className="text-sm text-gray-600">{resource.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCost(resource.cost)}</p>
                    <p className="text-sm text-gray-600">{resource.percentage}%</p>
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${resource.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 