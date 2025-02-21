import { getAzureClient } from '../../src/lib/azure'

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
    // First try Azure Monitor query for real data
    if (query.toLowerCase().includes('critical alerts')) {
      const client = getAzureClient()
      const result = await client.queryWorkspace(
        process.env.AZURE_WORKSPACE_ID,
        `AzureActivity 
        | where ActivityStatus == 'Failed' 
        | top 5 by TimeGenerated desc`,
        { duration: 'P1D' }
      )
      return res.status(200).json({ 
        reply: `Found ${result.status} critical alerts in the last 24 hours.`
      })
    }

    // Fall back to mock responses
    const mockResponse = mockAIResponse(query)
    res.status(200).json({ reply: mockResponse })

  } catch (error) {
    console.error('Azure Query Error:', error)
    res.status(500).json({ 
      reply: 'Failed to process query. Please try again later.'
    })
  }
} 