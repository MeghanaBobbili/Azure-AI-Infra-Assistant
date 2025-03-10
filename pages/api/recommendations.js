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
    
    // Process and categorize recommendations
    const processedRecommendations = {
      cost: [],
      performance: [],
      security: [],
      metrics: {
        potentialSavings: 0,
        optimizationScore: 100,
        history: {
          labels: Array.from({length: 30}, (_, i) => {
            const date = new Date()
            date.setDate(date.getDate() - (29 - i))
            return date.toLocaleDateString()
          }),
          datasets: [{
            id: 'optimization',
            label: 'Resource Optimization Score',
            data: Array(30).fill(100)
          }],
          title: 'Resource Optimization Score Trend',
          yAxisLabel: 'Score (%)',
          xAxisLabel: 'Date'
        }
      }
    }

    try {
      // Get recommendations from Azure Advisor
      const recommendations = await advisorClient.recommendations.list()
      
      for await (const rec of recommendations) {
        const category = rec.category?.toLowerCase() || 'unknown'
        const resourceType = rec.resourceMetadata?.resourceType?.toLowerCase() || 'unknown'
        
        // Determine the appropriate action based on recommendation type and resource
        let action = null
        let actionDescription = null

        if (category === 'cost') {
          if (resourceType.includes('virtualmachines')) {
            if (rec.shortDescription?.solution?.toLowerCase().includes('shutdown')) {
              action = 'shutdown'
              actionDescription = 'Automatically shut down VM during non-business hours'
            } else if (rec.shortDescription?.solution?.toLowerCase().includes('resize')) {
              action = 'resize'
              actionDescription = 'Resize VM to a more cost-effective size based on usage'
            } else {
              action = 'schedule'
              actionDescription = 'Set up auto-shutdown schedule for cost optimization'
            }
          } else if (resourceType.includes('sites')) {
            if (rec.shortDescription?.solution?.toLowerCase().includes('scale')) {
              action = 'scale_down'
              actionDescription = 'Scale down to a more cost-effective tier based on usage'
            } else {
              action = 'enable_autoscale'
              actionDescription = 'Enable autoscaling to optimize costs during low-traffic periods'
            }
          }
        }

        const recommendation = {
          id: rec.id || `rec-${Math.random()}`,
          title: rec.shortDescription?.solution || 'No title available',
          description: rec.description || 'No description available',
          impact: rec.impact || 'low',
          resource: rec.resourceMetadata?.resourceId?.split('/').pop() || 'unknown',
          resourceId: rec.resourceMetadata?.resourceId || '',
          resourceType: resourceType,
          category: category,
          action: action,
          actionDescription: actionDescription,
          actionLink: getActionLink(rec, process.env.AZURE_SUBSCRIPTION_ID),
          potentialSavings: parseFloat(rec.extendedProperties?.savingsAmount || 0)
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

      // Calculate optimization score based on recommendations
      const totalRecs = processedRecommendations.cost.length + 
                       processedRecommendations.performance.length + 
                       processedRecommendations.security.length
      const highImpactRecs = [...processedRecommendations.cost, 
                             ...processedRecommendations.performance, 
                             ...processedRecommendations.security]
                            .filter(rec => rec.impact.toLowerCase() === 'high').length

      if (totalRecs > 0) {
        processedRecommendations.metrics.optimizationScore = Math.round(
          ((totalRecs - highImpactRecs) / totalRecs) * 100
        )
        // Update history with the current score
        processedRecommendations.metrics.history.datasets[0].data = 
          Array(30).fill(processedRecommendations.metrics.optimizationScore)
      }

    } catch (error) {
      console.warn('Failed to fetch recommendations:', error)
      // Continue with default values set above
    }

    res.status(200).json(processedRecommendations)
  } catch (error) {
    console.error('Error in recommendations handler:', error)
    res.status(500).json({ 
      message: 'Failed to process recommendations',
      error: error.message 
    })
  }
}

function getActionLink(recommendation, subscriptionId) {
  if (!recommendation?.resourceMetadata?.resourceId) {
    return `https://portal.azure.com/#view/Microsoft_Azure_Advisor/AdvisorMenuBlade/~/overview`;
  }

  const resourceId = recommendation.resourceMetadata.resourceId;
  const resourceType = recommendation.resourceMetadata.resourceType?.toLowerCase() || '';
  const category = recommendation.category?.toLowerCase() || '';
  
  if (category === 'cost') {
    return `https://portal.azure.com/#view/Microsoft_Azure_CostManagement/CostAnalysis/~/scope/${encodeURIComponent(resourceId)}`;
  }

  if (resourceType.includes('virtualmachines')) {
    return `https://portal.azure.com/#@/resource/${resourceId}/overview`;
  } else if (resourceType.includes('sites')) {
    return `https://portal.azure.com/#@/resource/${resourceId}/appServices`;
  }

  // Default to resource overview
  return `https://portal.azure.com/#@/resource/${resourceId}/overview`;
} 