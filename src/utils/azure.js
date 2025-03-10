import { DefaultAzureCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { ComputeManagementClient } from "@azure/arm-compute";
import { WebSiteManagementClient } from "@azure/arm-appservice";
import { CostManagementClient } from "@azure/arm-costmanagement";
import { MonitorClient } from "@azure/arm-monitor";
import { LogsQueryClient } from "@azure/monitor-query";
import { INTENTS } from './queryParser';
import axios from 'axios';
import { LRUCache } from 'lru-cache';

let credential, monitorClient, resourceClient, computeClient, webClient, costClient, logsClient;

// Cache configuration
const cache = new LRUCache({
  max: 500, // Maximum items
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true
});

// Error types
const AzureErrors = {
  AUTH: 'AZURE_AUTH_ERROR',
  RATE_LIMIT: 'AZURE_RATE_LIMIT',
  RESOURCE_NOT_FOUND: 'AZURE_RESOURCE_NOT_FOUND',
  INVALID_REQUEST: 'AZURE_INVALID_REQUEST',
  UNKNOWN: 'AZURE_UNKNOWN_ERROR'
};

class AzureError extends Error {
  constructor(type, message, originalError = null) {
    super(message);
    this.type = type;
    this.originalError = originalError;
  }
}

async function initializeClients() {
  if (!credential) {
    credential = new DefaultAzureCredential();
    resourceClient = new ResourceManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    computeClient = new ComputeManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    webClient = new WebSiteManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    costClient = new CostManagementClient(credential);
    monitorClient = new MonitorClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    logsClient = new LogsQueryClient(credential);
  }
}

async function getResourceCosts(scope) {
  const cacheKey = `costs-${scope}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const token = await credential.getToken("https://management.azure.com/.default");
    
    // Ensure scope is properly formatted
    const subscriptionScope = `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}`;
    
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];
    
    const response = await axios.post(
      `https://management.azure.com${subscriptionScope}/providers/Microsoft.CostManagement/query`,
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

    const totalCost = response.data.rows.reduce((sum, row) => sum + row[1], 0);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const daysPassed = today.getDate();
    const projectedCost = (totalCost / daysPassed) * daysInMonth;

    const result = {
      totalCost,
      projectedCost,
      rows: response.data.rows,
      error: null,
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    const azureError = new AzureError(
      error.response?.status === 429 ? AzureErrors.RATE_LIMIT :
      error.response?.status === 401 ? AzureErrors.AUTH :
      AzureErrors.UNKNOWN,
      error.message,
      error
    );
    
    console.error('Cost data error:', {
      type: azureError.type,
      message: azureError.message,
      scope,
      timestamp: new Date().toISOString()
    });

    throw azureError;
  }
}

async function getResourceMetrics(resource, timespan) {
  const cacheKey = `metrics-${resource.id}-${timespan}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const metrics = await monitorClient.metrics.list(
      resource.id,
      {
        timespan,
        interval: 'PT1H',
        metricnames: 'Percentage CPU,Available Memory Bytes,Network In,Network Out',
        aggregation: 'Average'
      }
    );

    const result = {
      resourceName: resource.name,
      resourceType: resource.type,
      metrics: metrics.value.map(metric => ({
        name: metric.name.value,
        data: metric.timeseries[0].data.map(point => ({
          timestamp: point.timeStamp,
          value: point.average || 0
        }))
      })),
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    const azureError = new AzureError(
      error.response?.status === 404 ? AzureErrors.RESOURCE_NOT_FOUND :
      error.response?.status === 429 ? AzureErrors.RATE_LIMIT :
      AzureErrors.UNKNOWN,
      `Failed to fetch metrics for ${resource.name}: ${error.message}`,
      error
    );

    console.error('Metrics error:', {
      type: azureError.type,
      message: azureError.message,
      resourceId: resource.id,
      timestamp: new Date().toISOString()
    });

    return null;
  }
}

export async function getAzureData(intent) {
  await initializeClients();

  try {
    switch (intent) {
      case INTENTS.COST.VM:
      case INTENTS.COST.STORAGE:
      case INTENTS.COST.GENERAL: {
        const scope = `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}`;
        const costData = await getResourceCosts(scope);
        return {
          type: 'costs',
          data: costData
        };
      }

      case INTENTS.PERFORMANCE.VM:
      case INTENTS.PERFORMANCE.GENERAL: {
        const resourceGroups = [];
        for await (const group of resourceClient.resourceGroups.list()) {
          resourceGroups.push(group.name);
        }
        
        const vmsPromises = resourceGroups.map(group => 
          computeClient.virtualMachines.list(group)
        );
        
        const vmLists = await Promise.all(vmsPromises);
        const allVMs = vmLists.flat();
        
        if (allVMs.length === 0) {
          return {
            type: 'metrics',
            data: [],
            message: 'No virtual machines found'
          };
        }

        const timespan = 'PT24H';
        const metricsPromises = allVMs.map(vm => 
          getResourceMetrics(vm, timespan)
        );
        
        const metrics = await Promise.all(metricsPromises);
        return {
          type: 'metrics',
          data: metrics.filter(m => m !== null)
        };
      }

      case INTENTS.RESOURCES.LIST: {
        const resources = [];
        const resourceGroups = [];
        
        for await (const group of resourceClient.resourceGroups.list()) {
          resourceGroups.push(group.name);
        }

        for (const groupName of resourceGroups) {
          for await (const resource of resourceClient.resources.listByResourceGroup(groupName)) {
            resources.push({
              name: resource.name,
              type: resource.type,
              location: resource.location,
              resourceGroup: groupName,
              id: resource.id,
              tags: resource.tags || {},
              provisioningState: resource.provisioningState
            });
          }
        }

        return {
          type: 'resources',
          data: resources,
          count: resources.length
        };
      }

      default:
        return null;
    }
  } catch (error) {
    console.error('Error fetching Azure data:', error);
    return {
      type: 'error',
      error: true,
      message: error.message
    };
  }
} 