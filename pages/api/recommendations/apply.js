import { DefaultAzureCredential } from "@azure/identity"
import { ComputeManagementClient } from "@azure/arm-compute"
import { WebSiteManagementClient } from "@azure/arm-appservice"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { recommendationId, resourceId, action } = req.body

  if (!resourceId || !action) {
    return res.status(400).json({ message: 'Missing required parameters' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID
    const computeClient = new ComputeManagementClient(credential, subscriptionId)
    const webClient = new WebSiteManagementClient(credential, subscriptionId)

    // Parse resource ID
    const parts = resourceId.split('/')
    const resourceGroup = parts[4]
    const resourceName = parts[8]
    const resourceType = parts[7].toLowerCase()

    let result = null

    switch (action) {
      case 'shutdown':
        if (resourceType === 'virtualmachines') {
          await computeClient.virtualMachines.beginDeallocate(resourceGroup, resourceName)
          result = { message: 'VM shutdown initiated successfully' }
        }
        break

      case 'resize':
        if (resourceType === 'virtualmachines') {
          // Get VM details
          const vm = await computeClient.virtualMachines.get(resourceGroup, resourceName)
          // Determine next size down based on current size
          const newSize = await getOptimalVMSize(computeClient, resourceGroup, vm)
          if (newSize) {
            vm.hardwareProfile.vmSize = newSize
            await computeClient.virtualMachines.beginUpdate(resourceGroup, resourceName, vm)
            result = { message: `VM resize to ${newSize} initiated` }
          }
        }
        break

      case 'schedule':
        if (resourceType === 'virtualmachines') {
          // Set auto-shutdown schedule for 7 PM
          const scheduleParams = {
            location: parts[6],
            properties: {
              taskType: "ComputeVmShutdownTask",
              dailyRecurrence: { time: "1900" },
              timeZoneId: "UTC",
              notificationSettings: {
                status: "Enabled",
                timeInMinutes: 30
              },
              targetResourceId: resourceId
            }
          }
          await computeClient.virtualMachines.beginCreateOrUpdate(
            resourceGroup,
            `shutdown-computevm-${resourceName}`,
            scheduleParams
          )
          result = { message: 'Auto-shutdown schedule set for 7 PM UTC' }
        }
        break

      case 'scale_down':
        if (resourceType === 'sites') {
          const site = await webClient.webApps.get(resourceGroup, resourceName)
          const currentSku = site.sku.name
          const newSku = getOptimalAppServiceTier(currentSku)
          if (newSku) {
            await webClient.appServicePlans.beginUpdate(
              resourceGroup,
              site.serverFarmId.split('/').pop(),
              { sku: { name: newSku } }
            )
            result = { message: `App Service scaled down to ${newSku}` }
          }
        }
        break

      case 'enable_autoscale':
        if (resourceType === 'sites') {
          // Configure autoscale settings
          const autoscaleSettings = {
            location: parts[6],
            properties: {
              profiles: [{
                name: "Auto created scale condition",
                capacity: {
                  minimum: "1",
                  maximum: "3",
                  default: "1"
                },
                rules: [
                  {
                    scaleAction: {
                      direction: "Increase",
                      type: "ChangeCount",
                      value: "1",
                      cooldown: "PT5M"
                    },
                    metricTrigger: {
                      metricName: "CpuPercentage",
                      metricNamespace: "microsoft.web/serverfarms",
                      metricResourceUri: resourceId,
                      operator: "GreaterThan",
                      statistic: "Average",
                      threshold: 70,
                      timeAggregation: "Average",
                      timeGrain: "PT1M",
                      timeWindow: "PT10M"
                    }
                  },
                  {
                    scaleAction: {
                      direction: "Decrease",
                      type: "ChangeCount",
                      value: "1",
                      cooldown: "PT5M"
                    },
                    metricTrigger: {
                      metricName: "CpuPercentage",
                      metricNamespace: "microsoft.web/serverfarms",
                      metricResourceUri: resourceId,
                      operator: "LessThan",
                      statistic: "Average",
                      threshold: 30,
                      timeAggregation: "Average",
                      timeGrain: "PT1M",
                      timeWindow: "PT10M"
                    }
                  }
                ]
              }],
              enabled: true,
              targetResourceUri: resourceId
            }
          }
          await webClient.webApps.beginUpdate(resourceGroup, resourceName, autoscaleSettings)
          result = { message: 'Autoscale enabled with CPU-based rules' }
        }
        break

      default:
        return res.status(400).json({ message: 'Unsupported action' })
    }

    if (!result) {
      return res.status(400).json({ message: 'Action not applicable for this resource type' })
    }

    res.status(200).json(result)
  } catch (error) {
    console.error('Error applying recommendation:', error)
    res.status(500).json({ 
      message: 'Failed to apply recommendation',
      error: error.message 
    })
  }
}

async function getOptimalVMSize(computeClient, resourceGroup, vm) {
  const currentSize = vm.hardwareProfile.vmSize
  const sizes = await computeClient.virtualMachines.listAvailableSizes(resourceGroup, vm.name)
  
  // Get a size with slightly lower specs
  const currentSizeDetails = sizes.find(s => s.name === currentSize)
  if (!currentSizeDetails) return null

  const smallerSizes = sizes.filter(s => 
    s.numberOfCores <= currentSizeDetails.numberOfCores &&
    s.memoryInMB <= currentSizeDetails.memoryInMB &&
    s.name !== currentSize
  )

  // Sort by cores and memory to find the next size down
  smallerSizes.sort((a, b) => 
    b.numberOfCores - a.numberOfCores || 
    b.memoryInMB - a.memoryInMB
  )

  return smallerSizes[0]?.name
}

function getOptimalAppServiceTier(currentSku) {
  const tiers = {
    'P3V3': 'P2V3',
    'P2V3': 'P1V3',
    'P1V3': 'S3',
    'S3': 'S2',
    'S2': 'S1',
    'S1': 'B3',
    'B3': 'B2',
    'B2': 'B1'
  }
  return tiers[currentSku]
} 