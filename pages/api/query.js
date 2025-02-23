import { DefaultAzureCredential } from "@azure/identity"
import { LogsQueryClient } from "@azure/monitor-query"

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
    const client = new LogsQueryClient(credential)

    // Test query to fetch recent failed activities
    const result = await client.queryWorkspace(
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
    console.error("Azure Query Error Details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      response: error.response ? error.response.data : null,
    });
    res.status(500).json({ reply: "Failed to connect to Azure Monitor." });
  }
} 