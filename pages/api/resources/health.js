import { DefaultAzureCredential } from "@azure/identity"
import * as armResourceHealth from "@azure/arm-resourcehealth"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Verify authentication
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const credential = new DefaultAzureCredential()
    const client = new armResourceHealth.ResourceHealthClient(
      credential,
      process.env.AZURE_SUBSCRIPTION_ID
    )

    const healthStatuses = []
    const resourceId = req.query.resourceId

    if (resourceId) {
      // Get health for specific resource
      const health = await client.getByResource(resourceId)
      healthStatuses.push({
        resourceId: resourceId,
        status: health.properties.availabilityState,
        description: health.properties.summary,
        occuredTime: health.properties.occuredTime,
        reasonType: health.properties.reasonType,
        recommendedAction: health.properties.recommendedAction
      })
    } else {
      // Get health for all resources in subscription
      for await (const health of client.listBySubscriptionId()) {
        healthStatuses.push({
          resourceId: health.id,
          status: health.properties.availabilityState,
          description: health.properties.summary,
          occuredTime: health.properties.occuredTime,
          reasonType: health.properties.reasonType,
          recommendedAction: health.properties.recommendedAction
        })
      }
    }

    // Calculate statistics
    const stats = {
      total: healthStatuses.length,
      healthy: healthStatuses.filter(h => h.status === 'Available').length,
      warning: healthStatuses.filter(h => h.status === 'Degraded').length,
      critical: healthStatuses.filter(h => h.status === 'Unavailable').length,
      unknown: healthStatuses.filter(h => !['Available', 'Degraded', 'Unavailable'].includes(h.status)).length
    }

    return res.status(200).json({
      healthStatuses,
      stats
    })

  } catch (error) {
    console.error('Error fetching resource health:', error)
    return res.status(500).json({ 
      message: 'Failed to fetch resource health',
      error: error.message 
    })
  }
} 