import { DefaultAzureCredential } from "@azure/identity"
import { ResourceManagementClient } from "@azure/arm-resources"
import { AdvisorManagementClient } from "@azure/arm-advisor"
import { MonitorClient } from "@azure/arm-monitor"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const advisorClient = new AdvisorManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID)
    const monitorClient = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID)

    // Get recommendations from Azure Advisor
    const recommendations = await advisorClient.recommendations.list()
    
    // Process and categorize recommendations
    const processedRecommendations = {
      cost: [],
      performance: [],
      security: [],
      metrics: {
        potentialSavings: 0,
        optimizationScore: 0,
        history: {
          labels: [],
          datasets: []
        }
      }
    }

    for await (const rec of recommendations) {
      const category = rec.category.toLowerCase()
      const recommendation = {
        id: rec.id,
        title: rec.shortDescription.solution,
        description: rec.description,
        impact: rec.impact,
        resource: rec.resourceMetadata.resourceId.split('/').pop(),
        category: category,
        actionLink: rec.extendedProperties?.actionLink || '#',
        potentialSavings: rec.extendedProperties?.savingsAmount || 0
      }

      if (category === 'cost') {
        processedRecommendations.cost.push(recommendation)
        processedRecommendations.metrics.potentialSavings += parseFloat(recommendation.potentialSavings)
      } else if (category === 'performance') {
        processedRecommendations.performance.push(recommendation)
      } else if (category === 'security') {
        processedRecommendations.security.push(recommendation)
      }
    }

    // Calculate optimization score
    const totalRecs = processedRecommendations.cost.length + 
                     processedRecommendations.performance.length + 
                     processedRecommendations.security.length
    const highImpactRecs = [...processedRecommendations.cost, 
                           ...processedRecommendations.performance, 
                           ...processedRecommendations.security]
                          .filter(rec => rec.impact.toLowerCase() === 'high').length

    processedRecommendations.metrics.optimizationScore = Math.round(
      ((totalRecs - highImpactRecs) / totalRecs) * 100
    )

    // Get historical optimization data
    const timespan = 'P30D' // Last 30 days
    const interval = 'P1D'  // Daily intervals
    const metrics = await monitorClient.metrics.list(
      process.env.RESOURCE_ID,
      {
        timespan,
        interval,
        metricnames: 'Percentage CPU,Available Memory Bytes,Network In Total'
      }
    )

    if (metrics.value[0]?.timeseries[0]?.data) {
      processedRecommendations.metrics.history = {
        labels: metrics.value[0].timeseries[0].data.map(d => 
          new Date(d.timeStamp).toLocaleDateString()
        ),
        datasets: [{
          id: 'optimization',
          label: 'Optimization Score',
          data: metrics.value[0].timeseries[0].data.map(d => d.average)
        }],
        title: 'Resource Optimization Score Trend',
        yAxisLabel: 'Score (%)',
        xAxisLabel: 'Date'
      }
    }

    res.status(200).json(processedRecommendations)
  } catch (error) {
    console.error('Error fetching recommendations:', error)
    res.status(500).json({ message: 'Failed to fetch recommendations' })
  }
} 