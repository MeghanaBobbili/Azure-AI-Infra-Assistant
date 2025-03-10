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
import { getAzureData } from '../../src/utils/azure'
import rateLimit from 'express-rate-limit'
import { trackApiCall, generateCorrelationId, recordMetric } from '../../src/utils/telemetry'
import { detectIntent, refinePrompt, processWithOpenAI, INTENTS } from '../../src/utils/queryParser'

// Initialize Azure clients
let credential, monitorClient, resourceClient, computeClient, webClient, costClient, logsClient;

// Rate limiting setup
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

async function initializeClients() {
  if (!credential) {
    credential = new DefaultAzureCredential();
    monitorClient = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    resourceClient = new ResourceManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    computeClient = new ComputeManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    webClient = new WebSiteManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    costClient = new CostManagementClient(credential);
    logsClient = new LogsQueryClient(credential);
  }
}

async function getResourceMetrics(resource, timespan, interval = 'PT1H') {
  const supportedTypes = [
    'Microsoft.Compute/virtualMachines',
    'Microsoft.Web/sites'
  ];
  
  if (!supportedTypes.includes(resource.type)) {
    return null;
  }

  try {
    const metrics = await monitorClient.metrics.list(
      resource.id,
      {
        timespan,
        interval,
        metricnames: resource.type === 'Microsoft.Compute/virtualMachines' 
          ? 'Percentage CPU,Available Memory Bytes' 
          : 'CpuPercentage,MemoryPercentage'
      }
    );

    if (!metrics.value?.length) return null;

    // Transform metrics into the expected format
    const metricsData = {
      resourceName: resource.name,
      resourceType: resource.type,
      metrics: {
        cpu: {
          current: metrics.value.find(m => 
            m.name.value === (resource.type === 'Microsoft.Compute/virtualMachines' 
              ? 'Percentage CPU' 
              : 'CpuPercentage')
          )?.timeseries[0]?.data.slice(-1)[0]?.average || 0,
          history: metrics.value.find(m => 
            m.name.value === (resource.type === 'Microsoft.Compute/virtualMachines' 
              ? 'Percentage CPU' 
              : 'CpuPercentage')
          )?.timeseries[0]?.data.map(point => point.average || 0) || []
        },
        memory: {
          current: metrics.value.find(m => 
            m.name.value === (resource.type === 'Microsoft.Compute/virtualMachines' 
              ? 'Available Memory Bytes' 
              : 'MemoryPercentage')
          )?.timeseries[0]?.data.slice(-1)[0]?.average || 0,
          history: metrics.value.find(m => 
            m.name.value === (resource.type === 'Microsoft.Compute/virtualMachines' 
              ? 'Available Memory Bytes' 
              : 'MemoryPercentage')
          )?.timeseries[0]?.data.map(point => point.average || 0) || []
        }
      },
      timestamps: metrics.value[0]?.timeseries[0]?.data.map(point => point.timeStamp) || []
    };

    return metricsData;
  } catch (error) {
    console.warn(`Could not fetch metrics for ${resource.name}:`, error.message);
    return null;
  }
}

async function getResourceCosts(scope) {
  try {
    const token = await credential.getToken("https://management.azure.com/.default");
    
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];
    
    const response = await axios.post(
      `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query`,
      {
        type: "ActualCost",
        timeframe: "Custom",
        timePeriod: {
          from: `${startDateStr}T00:00:00Z`,
          to: `${endDateStr}T23:59:59Z`
        },
        dataset: {
          granularity: "None",
          aggregation: {
            totalCost: {
              name: "Cost",
              function: "Sum"
            }
          },
          grouping: [
            {
              type: "Dimension",
              name: "ServiceName"
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json"
        },
        params: {
          "api-version": "2023-08-01"
        }
      }
    );

    // Debug logging
    console.log('Cost API Response:', JSON.stringify(response.data, null, 2));

    if (!response.data?.properties?.rows) {
      console.log('No rows found in cost data');
      return {
        rows: [],
        totalCost: 0,
        dailyAverage: 0,
        projectedCost: 0
      };
    }

    const rows = response.data.properties.rows;
    let total = 0;
    const processedRows = rows.map(row => {
      const serviceName = String(row[0] || "Unknown Service");
      const cost = parseFloat(row[1] || 0);
      
      if (!isNaN(cost)) {
        total += cost;
      }
      
      return [serviceName, cost];
    });

    const dailyAvg = total / 30;
    const projected = dailyAvg * 30;

    return {
      rows: processedRows,
      totalCost: total,
      dailyAverage: dailyAvg,
      projectedCost: projected
    };
  } catch (error) {
    console.error('Error fetching costs:', error.response?.data || error.message);
    return {
      rows: [],
      totalCost: 0,
      dailyAverage: 0,
      projectedCost: 0,
      error: error.message
    };
  }
}

async function callWithRetry(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  let delay = initialDelay;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.response?.data?.error?.code === '429') {
        // Get retry delay from error message or use exponential backoff
        const retryAfter = parseInt(error.response.headers['retry-after']) || (delay / 1000);
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
        
        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        
        // Increase delay for next potential retry
        delay *= 2;
        continue;
      }
      
      // If it's not a rate limit error, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

// Request validation
function validateRequest(req) {
  const { messages, intent, action } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Invalid messages format');
  }
  
  if (action && !['scale', 'restart', 'stop', 'start'].includes(action.type)) {
    throw new Error('Invalid action type');
  }
  
  return true;
}

export default async function handler(req, res) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Apply rate limiting
  try {
    await new Promise((resolve, reject) => {
      limiter(req, res, (result) => {
        if (result instanceof Error) reject(result);
        resolve(result);
      });
    });
  } catch (error) {
    recordMetric('rate_limit_exceeded', 1, { correlationId });
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(error.resetTime / 1000),
      correlationId
    });
  }

  if (req.method !== 'POST') {
    recordMetric('invalid_method', 1, { correlationId, method: req.method });
    return res.status(405).json({ error: 'Method not allowed', correlationId });
  }

  try {
    // Validate request
    validateRequest(req);
    
    await initializeClients();
    const { messages, query } = req.body;

    // Detect intent from the last user message
    const lastUserMessage = messages[messages.length - 1].content;
    const intent = detectIntent(lastUserMessage);
    const refinedPrompt = refinePrompt(lastUserMessage, intent);

    // Record request metrics
    recordMetric('request_received', 1, {
      correlationId,
      intent,
      messageCount: messages.length
    });

    // Get Azure data based on intent
    let azureData = null;
    if (intent !== INTENTS.UNKNOWN) {
      azureData = await trackApiCall('azure', 'get_data', async () => {
        const azureDataPromise = getAzureData(intent);
        const azureTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Azure data timeout')), 15000)
        );
        return Promise.race([azureDataPromise, azureTimeout]);
      });
    }

    // Process with OpenAI
    const openaiResponse = await trackApiCall('openai', 'completion', async () => {
      const makeRequest = () => processWithOpenAI(lastUserMessage, messages, azureData);
      return callWithRetry(makeRequest);
    });

    // Record completion metrics
    recordMetric('request_completed', 1, {
      correlationId,
      duration: Date.now() - startTime,
      intent,
      hasAzureData: !!azureData
    });

    // Check if response requires approval
    const requiresApproval = checkIfRequiresApproval(openaiResponse, intent);
    const action = requiresApproval ? extractAction(openaiResponse, intent) : null;

    return res.status(200).json({
      message: openaiResponse,
      azureData,
      intent,
      requiresApproval,
      action,
      correlationId,
      metrics: {
        duration: Date.now() - startTime,
        intent
      }
    });

  } catch (error) {
    // Record error metrics
    recordMetric('request_error', 1, {
      correlationId,
      errorType: error.type || 'UNKNOWN',
      duration: Date.now() - startTime
    });

    console.error('API error:', {
      correlationId,
      message: error.message,
      type: error.type || 'UNKNOWN',
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    const statusCode = 
      error.type === 'AZURE_AUTH_ERROR' ? 401 :
      error.type === 'AZURE_RATE_LIMIT' ? 429 :
      error.type === 'AZURE_RESOURCE_NOT_FOUND' ? 404 :
      error.type === 'AZURE_INVALID_REQUEST' ? 400 : 500;

    return res.status(statusCode).json({ 
      error: 'Error processing request',
      type: error.type || 'UNKNOWN',
      details: error.message,
      retryable: statusCode === 429 || statusCode === 500,
      correlationId
    });
  }
}

function checkIfRequiresApproval(response, intent) {
  const approvalKeywords = [
    'scale', 'restart', 'stop', 'start', 'delete',
    'update', 'modify', 'change', 'remove', 'create'
  ];

  return approvalKeywords.some(keyword => 
    response.toLowerCase().includes(keyword)
  );
}

function extractAction(response, intent) {
  // Extract action details from the response based on intent
  // This is a simplified version - you'll want to make this more robust
  const action = {
    type: intent,
    resource: null,
    details: {}
  };

  // Extract resource name if present
  const resourceMatch = response.match(/resource ["'](.+?)["']/i);
  if (resourceMatch) {
    action.resource = resourceMatch[1];
  }

  return action;
}

async function handleAction(action) {
  // Implement action handling logic here
  // This should integrate with your Azure management APIs
  
  try {
    // Example implementation
    switch (action.type) {
      case 'scale':
        // Handle scaling
        break;
      case 'restart':
        // Handle restart
        break;
      default:
        throw new Error('Unsupported action type');
    }

    return {
      success: true,
      message: `Successfully executed ${action.type} operation`,
      details: action
    };

  } catch (error) {
    console.error('Action handling error:', error);
    return {
      success: false,
      error: error.message,
      details: action
    };
  }
} 