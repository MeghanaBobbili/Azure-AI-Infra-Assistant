import { DefaultAzureCredential } from "@azure/identity"
import { ResourceHealthClient } from "@azure/arm-resourcehealth"
import { MonitorClient } from "@azure/arm-monitor"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { resource = 'all' } = req.query

  try {
    const credential = new DefaultAzureCredential()
    const healthClient = new ResourceHealthClient(credential, process.env.AZURE_SUBSCRIPTION_ID)
    const monitorClient = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID)

    // Get resource health
    const scope = `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}`
    let healthData = []

    try {
      const healthResults = await healthClient.availabilityStatuses.listBySubscriptionId()
      for await (const status of healthResults) {
        healthData.push({
          id: status.id,
          name: status.name,
          type: status.type,
          status: status.properties.availabilityState,
          reason: status.properties.reasonType,
          description: status.properties.summary,
          lastUpdated: status.properties.occuredTime
        })
      }
    } catch (error) {
      console.warn('Health data not available:', error.message)
    }

    // Get performance metrics
    const now = new Date()
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours

    const metrics = await monitorClient.metrics.list(
      scope,
      {
        timespan: `${startTime.toISOString()}/${now.toISOString()}`,
        interval: 'PT1H',
        metricnames: ['Percentage CPU', 'Available Memory Bytes', 'Network In Total'].join(',')
      }
    )

    // Process metrics
    const processedMetrics = metrics.value.map(metric => ({
      name: metric.name.value,
      data: metric.timeseries[0]?.data.map(point => ({
        timestamp: point.timeStamp,
        value: point.average || 0
      })) || []
    }))

    res.status(200).json({
      health: healthData,
      metrics: {
        cpu: processedMetrics.find(m => m.name === 'Percentage CPU')?.data || [],
        memory: processedMetrics.find(m => m.name === 'Available Memory Bytes')?.data || [],
        network: processedMetrics.find(m => m.name === 'Network In Total')?.data || []
      },
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Error fetching health data:', error)
    res.status(200).json({
      health: [],
      metrics: {
        cpu: [],
        memory: [],
        network: []
      },
      error: 'Failed to fetch health data. Please verify Azure permissions.',
      timestamp: new Date().toISOString()
    })
  }
} 