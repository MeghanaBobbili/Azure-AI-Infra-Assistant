import { DefaultAzureCredential } from "@azure/identity"
import { MonitorClient } from "@azure/arm-monitor"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const client = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID)

    // Get metrics for multiple resources
    const metrics = await Promise.all([
      client.metrics.list(
        process.env.RESOURCE_ID,
        {
          timespan: 'PT1H',
          interval: 'PT1M',
          metricnames: 'Percentage CPU'
        }
      ),
      client.metrics.list(
        process.env.RESOURCE_ID,
        {
          timespan: 'PT1H',
          interval: 'PT1M',
          metricnames: 'Memory Percentage'
        }
      )
    ])

    // Transform metrics data
    const transformedMetrics = metrics.map(metric => ({
      name: metric.value[0].name.value,
      value: metric.value[0].timeseries[0].data.slice(-1)[0].average
    }))

    res.status(200).json({ metrics: transformedMetrics })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    res.status(500).json({ message: 'Failed to fetch metrics' })
  }
} 