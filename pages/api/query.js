import { DefaultAzureCredential } from "@azure/identity"
import { LogsQueryClient } from "@azure/monitor-query"
import { ComputeManagementClient } from "@azure/arm-compute"
import { CostManagementClient } from "@azure/arm-costmanagement"
import { MonitorClient } from "@azure/arm-monitor"
import { ResourceManagementClient } from "@azure/arm-resources"
import { WebSiteManagementClient } from "@azure/arm-appservice"

const mockAIResponse = (query) => {
  const q = query.toLowerCase()
  if (q.includes('cpu usage')) {
    return "The CPU usage of your production VM is currently at 75%"
  } 
  if (q.includes('alerts')) {
    return "Here are the last 5 critical alerts:\n- High Memory Usage (VM-PROD1)\n- Failed Backup (DB-02)\n- Network Timeout (APP-SVC-3)\n- SSL Certificate Expiring (WAF-01)\n- Disk Space Critical (STORAGE-05)"
  }
  if (q.includes('cost')) {
    return "Your current month's Azure spending is $12,450, which is 15% higher than last month"
  }
  return "I understand you're asking about Azure infrastructure. Could you be more specific about what you'd like to know?"
}

const extractQuery = (query) => {
  const q = query.toLowerCase()
  
  if (q.includes('cost') || q.includes('spending') || q.includes('budget')) {
    return { type: 'cost', action: 'overview' }
  }
  
  if (q.includes('performance') || q.includes('cpu') || q.includes('memory')) {
    return { type: 'monitor', action: 'performance' }
  }

  if (q.includes('errors') || q.includes('failures') || q.includes('failed')) {
    return { type: 'monitor', action: 'errors' }
  }
  
  if (q.includes('alert') || q.includes('warning')) {
    return { type: 'monitor', action: 'alerts' }
  }
  
  const restartMatch = q.match(/restart\s+(?:vm\s+)?([^\s]+)\s+(?:in|from)\s+(?:resource group\s+)?([^\s]+)/i)
  if (restartMatch) {
    return {
      type: 'vm',
      action: 'restart',
      vmName: restartMatch[1],
      resourceGroup: restartMatch[2]
    }
  }
  
  // App Service scaling
  const scaleMatch = q.match(/scale\s+(?:app|service)\s+([^\s]+)\s+(?:to|by)\s+(\d+)/i)
  if (scaleMatch) {
    return {
      type: 'appservice',
      action: 'scale',
      appName: scaleMatch[1],
      instances: parseInt(scaleMatch[2])
    }
  }

  // Resource listing
  if (q.includes('list') && q.includes('resources')) {
    return { type: 'resource', action: 'list' }
  }
  
  return null
}

const getCostOptimizations = (costData) => {
  const suggestions = []
  const totalCost = costData.reduce((sum, d) => sum + parseFloat(d.cost), 0)
  
  // Find expensive resource groups (>20% of total)
  costData.forEach(d => {
    const percentage = (parseFloat(d.cost) / totalCost) * 100
    if (percentage > 20) {
      suggestions.push(
        `⚠️ Resource group "${d.resourceGroup}" accounts for ${percentage.toFixed(1)}% of total costs. Consider:
• Reviewing unused resources
• Implementing auto-shutdown for dev/test VMs
• Using reserved instances for predictable workloads`
      )
    }
  })

  // General suggestions if costs are high
  if (totalCost > 10000) {
    suggestions.push(
      `💡 General cost optimization tips:
• Enable Azure Advisor for cost recommendations
• Review and delete unused resources
• Consider moving to PaaS services where possible
• Implement resource tagging for better cost tracking`
    )
  }

  return suggestions.length ? '\n\nOptimization Suggestions:\n' + suggestions.join('\n\n') : ''
}

const getMonitoringData = async (client, action) => {
  const timespan = { duration: 'P1D' }
  
  if (action === 'performance') {
    const result = await client.queryWorkspace(
      process.env.AZURE_WORKSPACE_ID,
      `Perf
      | where TimeGenerated > ago(1h)
      | where ObjectName == "Processor" or ObjectName == "Memory"
      | summarize avg(CounterValue) by ObjectName, CounterName
      | order by ObjectName asc`,
      timespan
    )

    if (!result.tables?.[0]?.rows?.length) {
      return "No performance data available for the last hour."
    }

    return `📊 Last hour's performance metrics:\n${
      result.tables[0].rows.map(row => 
        `• ${row[0]} ${row[1]}: ${Math.round(row[2])}%`
      ).join('\n')
    }`
  }

  if (action === 'errors') {
    const result = await client.queryWorkspace(
      process.env.AZURE_WORKSPACE_ID,
      `AzureActivity 
      | where TimeGenerated > ago(24h)
      | where Level == "Error" or Status contains "Failed"
      | project TimeGenerated, ResourceGroup, OperationName, Status
      | top 5 by TimeGenerated desc`,
      timespan
    )

    if (!result.tables?.[0]?.rows?.length) {
      return "✅ No errors found in the last 24 hours!"
    }

    return `⚠️ Recent errors:\n${
      result.tables[0].rows.map(row => 
        `• ${new Date(row[0]).toLocaleString()}: ${row[2]} in ${row[1]} (${row[3]})`
      ).join('\n')
    }`
  }
}

const getAlertData = async (client) => {
  const alerts = await client.activityLogAlerts.listBySubscriptionId()
  const activeAlerts = []
  
  for await (const alert of alerts) {
    if (alert.enabled) {
      activeAlerts.push({
        name: alert.name,
        description: alert.description,
        condition: alert.condition?.allOf?.[0]?.equals || 'Custom condition',
        severity: alert.severity || 'Unknown',
        status: alert.status || 'Active'
      })
    }
  }

  if (!activeAlerts.length) {
    return "✅ No active alerts configured."
  }

  return `🚨 Active Alert Rules:\n${
    activeAlerts.map(alert => 
      `• ${alert.name} (${alert.severity})\n  ${alert.description || 'No description'}`
    ).join('\n\n')
  }`
}

const handleResourceAction = async (action) => {
  const credential = new DefaultAzureCredential()
  const client = new ResourceManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID)
  const resources = await client.resources.list()
  const groupedResources = {}
  
  for await (const resource of resources) {
    const type = resource.type.split('/').pop()
    if (!groupedResources[type]) {
      groupedResources[type] = []
    }
    groupedResources[type].push(resource.name)
  }

  return `📊 Azure Resources:\n${
    Object.entries(groupedResources)
      .map(([type, names]) => 
        `\n${type} (${names.length}):\n${
          names.map(name => `• ${name}`).join('\n')
        }`
      ).join('\n')
  }`
}

const handleAppServiceAction = async (action) => {
  const credential = new DefaultAzureCredential()
  const client = new WebSiteManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID)
  
  if (action.action === 'scale') {
    const sites = await client.webApps.list()
    const app = Array.from(sites).find(s => 
      s.name.toLowerCase() === action.appName.toLowerCase()
    )
    
    if (!app) {
      return `❌ App "${action.appName}" not found`
    }

    await client.webApps.updateConfiguration(
      app.resourceGroup,
      app.name,
      {
        numberOfWorkers: action.instances
      }
    )

    return `✅ Scaled ${action.appName} to ${action.instances} instances`
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Method not allowed' })
  }

  const { query } = req.body
  if (!query?.trim()) {
    return res.status(400).json({ reply: 'Query is required' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const action = extractQuery(query)

    if (action) {
      switch (action.type) {
        case 'resource':
          return res.status(200).json({ 
            reply: await handleResourceAction(action) 
          })
        
        case 'appservice':
          return res.status(200).json({ 
            reply: await handleAppServiceAction(action) 
          })
          
        case 'monitor': {
          const logsClient = new LogsQueryClient(credential)
          
          if (action.action === 'alerts') {
            const monitorClient = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID)
            const alertData = await getAlertData(monitorClient)
            return res.status(200).json({ reply: alertData })
          }
          
          const monitorData = await getMonitoringData(logsClient, action.action)
          return res.status(200).json({ reply: monitorData })
        }

        case 'cost': {
          const costClient = new CostManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID)
          const today = new Date()
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
          const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

          const costQuery = {
            type: 'ActualCost',
            timeframe: 'Custom',
            timePeriod: {
              from: firstDay.toISOString(),
              to: lastDay.toISOString()
            },
            dataset: {
              granularity: 'Monthly',
              aggregation: {
                totalCost: { name: 'Cost', function: 'Sum' }
              },
              grouping: [
                { type: 'Dimension', name: 'ResourceGroup' }
              ]
            }
          }

          const scope = `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}`
          const result = await costClient.query.usage(scope, costQuery)

          const costData = result.rows.map(row => ({
            resourceGroup: row[1],
            cost: row[0].toFixed(2)
          }))

          const total = costData.reduce((sum, d) => sum + parseFloat(d.cost), 0)
          const optimizations = getCostOptimizations(costData)

          return res.status(200).json({
            reply: `💰 Current month's costs:\n${
              costData.map(d => `• ${d.resourceGroup}: $${d.cost}`).join('\n')
            }\n\n📊 Total: $${total.toFixed(2)}${optimizations}`
          })
        }

        case 'vm': {
          const computeClient = new ComputeManagementClient(
            credential,
            process.env.AZURE_SUBSCRIPTION_ID
          )

          await computeClient.virtualMachines.beginRestartAndWait(
            action.resourceGroup,
            action.vmName
          )

          return res.status(200).json({
            reply: `✅ Successfully restarted VM ${action.vmName} in ${action.resourceGroup}`
          })
        }
      }
    }

    // Default query for failed activities
    const logsClient = new LogsQueryClient(credential)
    const result = await logsClient.queryWorkspace(
      process.env.AZURE_WORKSPACE_ID,
      `AzureActivity 
      | where ActivityStatus == 'Failed' 
      | project TimeGenerated, ResourceGroup, ResourceProviderValue, OperationName, Properties
      | top 5 by TimeGenerated desc`,
      { duration: "P1D" }
    )

    if (result.tables?.[0]?.rows?.length > 0) {
      const formattedResults = result.tables[0].rows.map(row => ({
        time: new Date(row[0]).toLocaleString(),
        resourceGroup: row[1],
        provider: row[2],
        operation: row[3],
        details: row[4]
      }))

      res.status(200).json({ 
        reply: "Recent failed activities:\n" + 
          formattedResults.map(r => 
            `• ${r.time}: ${r.operation} in ${r.resourceGroup}`
          ).join("\n")
      })
    } else {
      res.status(200).json({ 
        reply: "Good news! No failed activities found in the last 24 hours." 
      })
    }
  } catch (error) {
    console.error("Azure Error:", error)
    res.status(500).json({ 
      reply: "Sorry, I encountered an error while processing your request. Please try again." 
    })
  }
} 