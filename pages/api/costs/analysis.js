import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { accessToken, subscriptionId } = session
    
    if (!subscriptionId) {
      return res.status(400).json({ 
        message: 'No subscription ID found in session. Please ensure you have access to an Azure subscription.'
      })
    }

    // Get current date and start of month
    const endDate = new Date()
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

    // Get usage details directly from Azure Management API
    const usageDetails = []
    try {
      const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2021-10-01`
      console.log('Calling Azure API:', url)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'ActualCost',
          timeframe: 'Custom',
          timePeriod: {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          },
          dataSet: {
            granularity: 'Daily',
            aggregation: {
              totalCost: {
                name: 'Cost',
                function: 'Sum'
              }
            },
            grouping: [
              {
                type: 'Dimension',
                name: 'ResourceGroupName'
              },
              {
                type: 'Dimension',
                name: 'ResourceType'
              }
            ]
          }
        })
      })

      console.log('Response status:', response.status)
      const responseText = await response.text()
      console.log('Response body:', responseText)

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${responseText}`)
      }

      const data = JSON.parse(responseText)
      console.log('Columns:', JSON.stringify(data.properties.columns, null, 2))
      console.log('Rows:', JSON.stringify(data.properties.rows, null, 2))
      
      // Transform cost management data into our format
      for (const row of data.properties?.rows || []) {
        console.log('Processing row:', row)
        const [cost, dateNum, resourceGroup, resourceType, currency] = row
        
        // Parse YYYYMMDD format
        const year = Math.floor(dateNum / 10000)
        const month = Math.floor((dateNum % 10000) / 100) - 1 // JS months are 0-based
        const day = dateNum % 100
        const date = new Date(year, month, day)
        
        const item = {
          date: date.toISOString(),
          resourceGroup: resourceGroup || 'Unassigned',
          resourceType: resourceType || 'Other',
          cost: Number(cost) || 0,
          currency: currency || 'USD'
        }
        console.log('Transformed item:', item)
        usageDetails.push(item)
      }

      console.log('Total items:', usageDetails.length)
    } catch (error) {
      console.error('Error fetching usage details:', error)
      console.error('Access Token:', accessToken)
      throw error
    }

    // Calculate totals and daily averages
    const total = usageDetails.reduce((sum, item) => sum + (Number(item.cost) || 0), 0)
    const dailyAverage = total / ((endDate - startDate) / (1000 * 60 * 60 * 24))

    // Group by resource group
    const costByResourceGroup = usageDetails.reduce((acc, item) => {
      const rg = item.resourceGroup || 'Unassigned'
      acc[rg] = (acc[rg] || 0) + (Number(item.cost) || 0)
      return acc
    }, {})

    // Group by resource type
    const costByServiceType = usageDetails.reduce((acc, item) => {
      const type = item.resourceType || 'Other'
      acc[type] = (acc[type] || 0) + (Number(item.cost) || 0)
      return acc
    }, {})

    // Calculate forecast based on daily average
    const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate()
    const forecastTotal = dailyAverage * daysInMonth

    return res.status(200).json({
      total: total.toFixed(2),
      dailyAverage: dailyAverage.toFixed(2),
      forecastTotal: forecastTotal.toFixed(2),
      currency: usageDetails[0]?.currency || 'USD',
      costByResourceGroup,
      costByServiceType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      usageDetails: usageDetails.slice(0, 100) // Limit to last 100 entries
    })

  } catch (error) {
    console.error('Error fetching cost data:', error)
    return res.status(500).json({ 
      message: 'Failed to fetch cost data',
      error: error.message 
    })
  }
} 