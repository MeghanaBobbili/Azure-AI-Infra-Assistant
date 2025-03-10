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

// Initialize Azure clients
let credential, monitorClient, resourceClient, computeClient, webClient, costClient, logsClient;

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await initializeClients();
    
    const { messages } = req.body;
    const userMessage = messages[messages.length - 1].content.toLowerCase();
    let azureData = null;
    let errorDetails = null;

    try {
      // List all resources
      if (userMessage.includes('list') && userMessage.includes('resource')) {
        try {
          const resources = [];
          console.log('Fetching resources...');
          
          // Get all resource groups first
          const resourceGroups = [];
          for await (const group of resourceClient.resourceGroups.list()) {
            resourceGroups.push(group.name);
          }
          console.log(`Found ${resourceGroups.length} resource groups`);
          
          // Get resources from each resource group
          for (const groupName of resourceGroups) {
            try {
              for await (const resource of resourceClient.resources.listByResourceGroup(groupName)) {
                resources.push({
                  name: resource.name,
                  type: resource.type,
                  location: resource.location,
                  resourceGroup: groupName,
                  id: resource.id,
                  tags: resource.tags || {},
                  provisioningState: resource.provisioningState,
                  createdTime: resource.createdTime
                });
              }
            } catch (groupError) {
              console.warn(`Error listing resources in group ${groupName}:`, groupError.message);
            }
          }
          
          console.log(`Found ${resources.length} total resources`);
          
          // Sort resources by type and name
          resources.sort((a, b) => {
            if (a.type === b.type) {
              return a.name.localeCompare(b.name);
            }
            return a.type.localeCompare(b.type);
          });
          
          azureData = {
            type: 'resources',
            data: resources,
            count: resources.length,
            resourceGroups: resourceGroups.length
          };
        } catch (resourceError) {
          console.error('Error listing resources:', resourceError);
          azureData = {
            type: 'resources',
            data: [],
            count: 0,
            error: resourceError.message
          };
        }
      }
      
      // Cost data
      else if (userMessage.includes('spending') || userMessage.includes('cost')) {
        const scope = `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}`;
        const costData = await getResourceCosts(scope);
        
        azureData = {
          type: 'costs',
          data: {
            total: costData.totalCost.toFixed(2),
            projected: costData.projectedCost.toFixed(2),
            byService: costData.rows.map(row => ({
              name: row[0],
              cost: row[1].toFixed(2),
              percentage: costData.totalCost > 0 ? ((row[1] / costData.totalCost) * 100).toFixed(1) : "0"
            }))
          },
          error: costData.error
        };
      }
      
      // CPU/Usage data
      else if (userMessage.includes('cpu') || userMessage.includes('usage')) {
        const resourceGroups = [];
        for await (const group of resourceClient.resourceGroups.list()) {
          resourceGroups.push(group.name);
        }
        
        const vmsPromises = resourceGroups.map(group => 
          computeClient.virtualMachines.list(group).catch(err => {
            console.warn(`Error listing VMs in group ${group}:`, err.message);
            return [];
          })
        );
        
        const vmLists = await Promise.all(vmsPromises);
        const allVMs = vmLists.flat().filter(vm => vm && vm.id);
        
        if (allVMs.length === 0) {
          azureData = {
            type: 'metrics',
            data: [],
            message: 'No virtual machines found'
          };
        } else {
          const timespan = 'PT24H';
          const metricsPromises = allVMs.map(vm => 
            getResourceMetrics(
              { 
                id: vm.id, 
                name: vm.name, 
                type: 'Microsoft.Compute/virtualMachines' 
              }, 
              timespan
            ).catch(err => {
              console.warn(`Error fetching metrics for ${vm.name}:`, err.message);
              return null;
            })
          );
          
          const metricsResults = await Promise.all(metricsPromises);
          const validMetrics = metricsResults.filter(m => m !== null);
          
          azureData = {
            type: 'metrics',
            data: validMetrics,
            count: validMetrics.length
          };
        }
      }
      
    } catch (dataError) {
      console.error('Error fetching Azure data:', dataError);
      errorDetails = dataError.message;
    }

    // Always return a valid response structure
    return res.status(200).json({
      message: messages[messages.length - 1].content,
      azureData: azureData || { 
        type: 'error',
        error: true, 
        message: errorDetails || 'No data available'
      }
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      message: 'Error processing request',
      error: error.message,
      azureData: {
        type: 'error',
        error: true,
        message: error.message
      }
    });
  }
} 