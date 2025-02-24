import { DefaultAzureCredential } from "@azure/identity"
import { CostManagementClient } from "@azure/arm-costmanagement"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const client = new CostManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID)

    // Simpler query for testing
    const queryParams = {
      type: 'ActualCost',
      timeframe: 'MonthToDate',
      dataset: {
        granularity: 'Daily',
        aggregation: {
          totalCost: {
            name: 'Cost',
            function: 'Sum'
          }
        }
      }
    }

    const scope = `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}`
    
    try {
      console.log('Fetching cost data...')
      const result = await client.query.usage(scope, queryParams)
      console.log('Cost data result:', JSON.stringify(result, null, 2))

      if (!result.rows || result.rows.length === 0) {
        console.log('No cost data found')
        return res.status(200).json({
          costs: [],
          total: 0,
          message: "No cost data available yet. This could be because:\n" +
            "• Your subscription is new or free tier\n" +
            "• No billable resources have been deployed\n" +
            "• Cost data takes 24-48 hours to appear\n" +
            "• The current billing period hasn't closed"
        })
      }

      // Basic data processing with proper date formatting
      const costs = result.rows.map(row => {
        // Parse YYYYMMDD format from Azure
        const dateNum = row[1].toString()
        const year = parseInt(dateNum.slice(0, 4))
        const month = parseInt(dateNum.slice(4, 6)) - 1 // Months are 0-based
        const day = parseInt(dateNum.slice(6, 8))
        
        const date = new Date(year, month, day)

        return {
          cost: parseFloat(row[0] || 0),
          date: date.toISOString().split('T')[0],
          currency: row[2] || 'USD'
        }
      }).sort((a, b) => new Date(a.date) - new Date(b.date))

      const total = costs.reduce((sum, item) => sum + item.cost, 0)
      const avgDailyCost = total / costs.length

      // Use the actual dates from the cost data
      const startDate = new Date(costs[0].date)
      const endDate = new Date(costs[costs.length - 1].date)

      // Calculate top resources (in this case, by date since we don't have resource info)
      const topResources = costs.map(cost => ({
        name: new Date(cost.date).toLocaleDateString(),
        type: 'Daily Usage',
        cost: cost.cost,
        percentage: ((cost.cost / total) * 100).toFixed(1)
      })).sort((a, b) => b.cost - a.cost)

      return res.status(200).json({
        daily: {
          dates: costs.map(c => {
            const d = new Date(c.date)
            return d.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
            })
          }),
          costs: costs.map(c => c.cost),
          average: avgDailyCost
        },
        monthly: {
          total: total,
          trend: 0
        },
        forecast: {
          total: avgDailyCost * 30,
          budget: avgDailyCost * 30 * 1.2
        },
        costs,
        topResources,
        total: total.toFixed(6),
        currency: costs[0]?.currency || 'USD',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      })

    } catch (queryError) {
      console.error('Error querying cost data:', queryError)
      return res.status(200).json({
        costs: [],
        total: 0,
        message: `Cost data query failed: ${queryError.message}`,
        error: queryError.message
      })
    }

  } catch (error) {
    console.error('Error initializing cost client:', error)
    return res.status(200).json({
      costs: [],
      total: 0,
      message: "Unable to access cost data. Please verify Azure permissions.",
      error: error.message
    })
  }
} 