import { DefaultAzureCredential } from "@azure/identity"
import { MonitorClient } from "@azure/arm-monitor"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const client = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID)

    // Get alerts from Azure Monitor
    const alerts = await client.activityLogAlerts.listBySubscriptionId()
    
    // Transform alerts data
    const transformedAlerts = []
    for await (const alert of alerts) {
      // Get alert details
      const alertDetails = await client.alertsManagement.getAlert(
        alert.id,
        process.env.AZURE_SUBSCRIPTION_ID
      )

      transformedAlerts.push({
        id: alert.id,
        title: alert.name,
        description: alert.description || 'No description available',
        severity: alertDetails.severity || 'info',
        status: alertDetails.state || 'new',
        resource: alertDetails.targetResource?.name || 'Unknown',
        timestamp: alertDetails.startDateTime || new Date().toISOString(),
        metrics: alertDetails.essentials?.monitorCondition || 'Unknown'
      })
    }

    res.status(200).json({ 
      alerts: transformedAlerts.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      )
    })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    res.status(500).json({ message: 'Failed to fetch alerts' })
  }
} 