import { DefaultAzureCredential } from "@azure/identity"
import { LogsQueryClient } from "@azure/monitor-query"
import { ComputeManagementClient } from "@azure/arm-compute"
import { CostManagementClient } from "@azure/arm-costmanagement"
import { MonitorClient } from "@azure/arm-monitor"
import { ResourceManagementClient } from "@azure/arm-resources"
import { WebSiteManagementClient } from "@azure/arm-appservice"
import axios from 'axios'
import { Chart } from 'chart.js/auto'
import * as armResourceHealth from "@azure/arm-resourcehealth"
import { SecurityCenter } from "@azure/arm-security"
import { OpenAIClient } from "@azure/openai"

// Initialize the OpenAI Client
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { messages } = req.body
    const userMessage = messages[messages.length - 1].content.toLowerCase()

    // Initialize Azure clients
    const credential = new DefaultAzureCredential()
    const monitorClient = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID)
    const resourceClient = new ResourceManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID)

    // Check if the query is about resource metrics
    if (userMessage.includes('cpu') || userMessage.includes('memory') || userMessage.includes('performance')) {
      // Get all resources
      const resources = []
      for await (const resource of resourceClient.resources.list()) {
        resources.push(resource)
      }

      // Get metrics for the last 24 hours
      const now = new Date()
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const metricsData = []
      for (const resource of resources) {
        try {
          const metrics = await monitorClient.metrics.list(
            resource.id,
            {
              timespan: `${startTime.toISOString()}/${now.toISOString()}`,
              interval: 'PT1H',
              metricnames: 'Percentage CPU,Available Memory Bytes,Network In Total,Network Out Total'
            }
          )

          if (metrics.value && metrics.value.length > 0) {
            metricsData.push({
              resourceName: resource.name,
              resourceType: resource.type,
              metrics: metrics.value.map(metric => ({
                name: metric.name.value,
                data: metric.timeseries[0]?.data.map(point => ({
                  timestamp: point.timeStamp,
                  value: point.average || 0
                })) || []
              }))
            })
          }
        } catch (error) {
          console.warn(`Could not fetch metrics for ${resource.name}:`, error.message)
        }
      }

      // Format the metrics data for response
      let metricsResponse = "Here are the current resource metrics:\n\n"
      metricsData.forEach(resource => {
        metricsResponse += `📊 ${resource.resourceName} (${resource.resourceType}):\n`
        resource.metrics.forEach(metric => {
          const latestValue = metric.data[metric.data.length - 1]?.value || 0
          if (metric.name === 'Percentage CPU') {
            metricsResponse += `- CPU Usage: ${latestValue.toFixed(2)}%\n`
          } else if (metric.name === 'Available Memory Bytes') {
            metricsResponse += `- Available Memory: ${(latestValue / 1024 / 1024 / 1024).toFixed(2)} GB\n`
          } else if (metric.name.includes('Network')) {
            metricsResponse += `- ${metric.name}: ${(latestValue / 1024 / 1024).toFixed(2)} MB/s\n`
          }
        })
        metricsResponse += '\n'
      })

      // Add performance recommendations
      metricsResponse += "\nRecommendations:\n"
      metricsData.forEach(resource => {
        const cpuMetric = resource.metrics.find(m => m.name === 'Percentage CPU')
        if (cpuMetric) {
          const avgCpu = cpuMetric.data.reduce((sum, point) => sum + point.value, 0) / cpuMetric.data.length
          if (avgCpu > 80) {
            metricsResponse += `⚠️ ${resource.resourceName} is experiencing high CPU usage. Consider scaling up or out.\n`
          } else if (avgCpu < 20) {
            metricsResponse += `💡 ${resource.resourceName} is underutilized. Consider scaling down to optimize costs.\n`
          }
        }
      })

      return res.status(200).json({
        message: metricsResponse,
        role: "assistant",
        data: metricsData
      })
    }

    // Check for scaling commands
    if (userMessage.includes('scale down') || userMessage.includes('scale up')) {
      const resources = []
      for await (const resource of resourceClient.resources.list()) {
        if (resource.type.includes('virtualMachines') || resource.type.includes('sites')) {
          resources.push(resource)
        }
      }

      // Get current metrics to make scaling recommendations
      const metricsData = await Promise.all(resources.map(async (resource) => {
        try {
          const metrics = await monitorClient.metrics.list(
            resource.id,
            {
              timespan: `${startTime.toISOString()}/${now.toISOString()}`,
              interval: 'PT1H',
              metricnames: 'Percentage CPU'
            }
          )

          return {
            resource,
            metrics: metrics.value
          }
        } catch (error) {
          console.warn(`Could not fetch metrics for ${resource.name}:`, error.message)
          return { resource, metrics: [] }
        }
      }))

      // Generate scaling recommendations
      const recommendations = metricsData.map(({ resource, metrics }) => {
        const cpuMetric = metrics.find(m => m.name.value === 'Percentage CPU')
        const avgCpu = cpuMetric?.timeseries[0]?.data.reduce((sum, point) => sum + (point.average || 0), 0) / 
          (cpuMetric?.timeseries[0]?.data.length || 1)

        return {
          resourceId: resource.id,
          name: resource.name,
          type: resource.type,
          currentSize: resource.sku?.name || 'Unknown',
          avgCpu: avgCpu || 0,
          recommendation: avgCpu < 20 ? 'scale down' : avgCpu > 80 ? 'scale up' : 'no change'
        }
      })

      return res.status(200).json({
        message: `Here are the scaling recommendations based on current usage:\n\n${
          recommendations.map(r => 
            `📊 ${r.name} (${r.type}):\n` +
            `- Current Size: ${r.currentSize}\n` +
            `- Avg CPU: ${r.avgCpu.toFixed(1)}%\n` +
            `- Recommendation: ${r.recommendation}\n`
          ).join('\n')
        }`,
        role: "assistant",
        data: recommendations,
        requiresApproval: true,
        action: 'scale'
      })
    }

    // Enhanced system message with more Azure knowledge
    const systemMessage = {
      role: "system",
      content: `You are an Azure Infrastructure Assistant, an expert in Azure cloud services and infrastructure management.

Key Areas of Expertise:
- Resource Management: Azure Resource Manager, resource groups, subscriptions, management groups
- Compute: VMs, App Services, Container Instances, AKS, Functions
- Networking: VNets, NSGs, Load Balancers, Application Gateway, ExpressRoute
- Storage: Blob, Files, Disks, Data Lake
- Security: Azure AD, Key Vault, Security Center, Sentinel
- Monitoring: Monitor, Log Analytics, Application Insights
- Cost Management: Budgets, Cost Analysis, Reserved Instances, Hybrid Benefits

Response Guidelines:
1. For implementation questions:
   - Provide Azure CLI commands or Azure PowerShell scripts
   - Include ARM template snippets when relevant
   - Show Portal navigation steps
   - Reference Bicep examples for IaC

2. For architecture questions:
   - Suggest Well-Architected Framework best practices
   - Consider scalability, security, and cost optimization
   - Provide relevant Azure architecture patterns
   - Include service limits and quotas

3. For troubleshooting:
   - List common diagnostic steps
   - Reference relevant Azure metrics and logs
   - Suggest monitoring solutions
   - Include links to troubleshooting guides

4. Always include:
   - Azure-specific terminology
   - Service naming conventions
   - Region considerations
   - Cost implications
   - Security best practices

Format code blocks with appropriate syntax highlighting:
- Azure CLI: \`\`\`bash
- PowerShell: \`\`\`powershell
- ARM/Bicep: \`\`\`json or \`\`\`bicep
- YAML: \`\`\`yaml

If unsure, ask for clarification about:
- Azure environment context
- Scale requirements
- Compliance needs
- Budget constraints`
    }

    // Regular chatbot response for non-metric queries
    const response = await axios.post(
      process.env.AZURE_OPENAI_ENDPOINT,
      {
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_API_KEY
        }
      }
    )

    res.status(200).json({
      message: response.data.choices[0].message.content,
      role: "assistant"
    })

  } catch (error) {
    console.error('Error processing query:', error)
    res.status(200).json({
      message: "I encountered an error fetching the data. Please try again in a moment.",
      role: "assistant",
      error: true
    })
  }
} 