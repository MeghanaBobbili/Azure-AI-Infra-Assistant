import { DefaultAzureCredential } from "@azure/identity"
import { ResourceManagementClient } from "@azure/arm-resources"
import { MonitorClient } from "@azure/arm-monitor"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const resourceClient = new ResourceManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID)
    const monitorClient = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID)

    // Get all resources
    const resources = []
    for await (const resource of resourceClient.resources.list()) {
      resources.push({
        id: resource.id,
        name: resource.name,
        type: resource.type,
        location: resource.location,
        resourceGroup: resource.id.split('/')[4],
        tags: resource.tags || {},
        status: 'Unknown' // Will be updated with health status
      })
    }

    // Get health status for each resource
    const now = new Date()
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours

    for (const resource of resources) {
      try {
        // Get availability metrics
        const metrics = await monitorClient.metrics.list(
          resource.id,
          {
            timespan: `${startTime.toISOString()}/${now.toISOString()}`,
            interval: 'PT1H',
            metricnames: 'Availability'
          }
        )

        const availabilityData = metrics.value[0]?.timeseries[0]?.data || []
        const availability = availabilityData.reduce((sum, point) => sum + (point.average || 0), 0) / 
          (availabilityData.length || 1)

        resource.status = availability > 99 ? 'Healthy' : 
          availability > 95 ? 'Warning' : 'Critical'
        resource.availability = Math.round(availability * 100) / 100
      } catch (error) {
        console.warn(`Could not fetch metrics for ${resource.name}:`, error.message)
      }
    }

    // Get resource groups
    const resourceGroups = []
    for await (const group of resourceClient.resourceGroups.list()) {
      resourceGroups.push({
        name: group.name,
        location: group.location,
        tags: group.tags || {},
        resourceCount: resources.filter(r => r.resourceGroup === group.name).length
      })
    }

    // Calculate statistics
    const stats = {
      total: resources.length,
      healthy: resources.filter(r => r.status === 'Healthy').length,
      warning: resources.filter(r => r.status === 'Warning').length,
      critical: resources.filter(r => r.status === 'Critical').length,
      byType: Object.entries(
        resources.reduce((acc, r) => {
          const type = r.type.split('/')[1]
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {})
      ).map(([type, count]) => ({ type, count }))
    }

    res.status(200).json({
      resources,
      resourceGroups,
      stats,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Error fetching resource data:', error)
    res.status(200).json({
      resources: [],
      resourceGroups: [],
      stats: {
        total: 0,
        healthy: 0,
        warning: 0,
        critical: 0,
        byType: []
      },
      error: 'Failed to fetch resource data. Please verify Azure permissions.',
      timestamp: new Date().toISOString()
    })
  }
} 