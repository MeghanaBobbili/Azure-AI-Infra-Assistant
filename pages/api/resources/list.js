import { DefaultAzureCredential } from "@azure/identity"
import { ResourceManagementClient } from "@azure/arm-resources"
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
    const client = new ResourceManagementClient(
      credential,
      process.env.AZURE_SUBSCRIPTION_ID
    )

    // Get all resource groups
    const resourceGroups = []
    for await (const group of client.resourceGroups.list()) {
      const resources = []
      
      // Get resources in each resource group
      for await (const resource of client.resources.listByResourceGroup(group.name)) {
        resources.push({
          id: resource.id,
          name: resource.name,
          type: resource.type,
          location: resource.location,
          tags: resource.tags || {},
          provisioningState: resource.provisioningState
        })
      }

      resourceGroups.push({
        id: group.id,
        name: group.name,
        location: group.location,
        tags: group.tags || {},
        resourceCount: resources.length,
        resources: resources
      })
    }

    return res.status(200).json({
      resourceGroups,
      total: resourceGroups.reduce((acc, group) => acc + group.resourceCount, 0)
    })

  } catch (error) {
    console.error('Error fetching resources:', error)
    return res.status(500).json({ 
      message: 'Failed to fetch resources',
      error: error.message 
    })
  }
} 