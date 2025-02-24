import { DefaultAzureCredential } from "@azure/identity"
import { ComputeManagementClient } from "@azure/arm-compute"
import { WebSiteManagementClient } from "@azure/arm-appservice"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { resourceId, action, size, tier } = req.body
    const credential = new DefaultAzureCredential()

    // Parse resource ID to get components
    const parts = resourceId.split('/')
    const subscriptionId = parts[2]
    const resourceGroup = parts[4]
    const type = parts[6].toLowerCase()
    const name = parts[8]

    let result
    
    switch (type) {
      case 'virtualmachines':
        const computeClient = new ComputeManagementClient(credential, subscriptionId)
        const vm = await computeClient.virtualMachines.get(resourceGroup, name)
        
        // Update VM size
        vm.hardwareProfile.vmSize = size
        result = await computeClient.virtualMachines.beginCreateOrUpdate(
          resourceGroup,
          name,
          vm
        )
        break

      case 'sites':
        const webClient = new WebSiteManagementClient(credential, subscriptionId)
        result = await webClient.appService.updateWebApp(resourceGroup, name, {
          sku: {
            name: size,
            tier: tier
          }
        })
        break

      default:
        throw new Error(`Unsupported resource type: ${type}`)
    }

    res.status(200).json({
      message: `Successfully scaled ${type} ${name}`,
      details: result
    })

  } catch (error) {
    console.error('Error scaling resource:', error)
    res.status(500).json({
      message: 'Failed to scale resource',
      error: error.message
    })
  }
} 