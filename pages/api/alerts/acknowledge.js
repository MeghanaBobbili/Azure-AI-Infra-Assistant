import { DefaultAzureCredential } from "@azure/identity"
import { MonitorClient } from "@azure/arm-monitor"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { alertId } = req.body
  if (!alertId) {
    return res.status(400).json({ message: 'Alert ID is required' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const client = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID)

    // Update alert state
    await client.alertsManagement.updateAlert(
      alertId,
      process.env.AZURE_SUBSCRIPTION_ID,
      {
        state: 'Acknowledged'
      }
    )

    res.status(200).json({ message: 'Alert acknowledged successfully' })
  } catch (error) {
    console.error('Error acknowledging alert:', error)
    res.status(500).json({ message: 'Failed to acknowledge alert' })
  }
} 