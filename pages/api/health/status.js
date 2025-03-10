import { DefaultAzureCredential } from "@azure/identity"
import { MonitorClient } from "@azure/arm-monitor"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID
    const monitorClient = new MonitorClient(credential, subscriptionId)

    // Get resource health using Monitor client instead
    const now = new Date()
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours

    const metrics = await monitorClient.metrics.list(
      process.env.RESOURCE_ID,
      {
        timespan: `${startTime.toISOString()}/${now.toISOString()}`,
        interval: 'PT1H',
        metricnames: 'Percentage CPU,Available Memory Bytes,Network In Total,Network Out Total'
      }
    )

    // Transform metrics into health status
    const resources = []
    if (metrics.value) {
      const cpuMetric = metrics.value.find(m => m.name.value === 'Percentage CPU')
      const memoryMetric = metrics.value.find(m => m.name.value === 'Available Memory Bytes')
      const networkInMetric = metrics.value.find(m => m.name.value === 'Network In Total')
      const networkOutMetric = metrics.value.find(m => m.name.value === 'Network Out Total')

      const getLatestValue = (metric) => {
        if (!metric?.timeseries?.[0]?.data) return null
        const data = metric.timeseries[0].data
        return data[data.length - 1]?.average || null
      }

      const cpuValue = getLatestValue(cpuMetric)
      const memoryValue = getLatestValue(memoryMetric)
      const networkIn = getLatestValue(networkInMetric)
      const networkOut = getLatestValue(networkOutMetric)

      resources.push({
        id: process.env.RESOURCE_ID,
        name: process.env.RESOURCE_ID.split('/').pop(),
        type: 'Virtual Machine',
        status: cpuValue > 80 ? 'critical' : cpuValue > 60 ? 'warning' : 'healthy',
        metrics: {
          cpu: cpuValue?.toFixed(1) || '0',
          memory: memoryValue ? ((memoryValue / 1024 / 1024 / 1024).toFixed(1) + ' GB') : '0 GB',
          network: {
            in: networkIn ? ((networkIn / 1024 / 1024).toFixed(1) + ' MB/s') : '0 MB/s',
            out: networkOut ? ((networkOut / 1024 / 1024).toFixed(1) + ' MB/s') : '0 MB/s'
          }
        }
      })
    }

    return res.status(200).json({
      resources,
      metrics: {
        labels: metrics.value?.[0]?.timeseries?.[0]?.data?.map(d => 
          new Date(d.timeStamp).toLocaleTimeString()
        ) || [],
        datasets: metrics.value?.map(metric => ({
          id: metric.name.value,
          label: metric.name.value,
          data: metric.timeseries?.[0]?.data?.map(d => d.average) || []
        })) || [],
        title: 'Resource Performance',
        yAxisLabel: 'Usage',
        xAxisLabel: 'Time'
      }
    })

  } catch (error) {
    console.error('Error fetching health data:', error)
    return res.status(500).json({ message: 'Failed to fetch health data' })
  }
} 