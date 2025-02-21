import { DefaultAzureCredential } from '@azure/identity'
import { LogsQueryClient } from '@azure/monitor-query'

export const getAzureClient = () => {
  const credential = new DefaultAzureCredential()
  return new LogsQueryClient(credential)
}

export const queryLogs = async (query) => {
  const client = getAzureClient()
  const result = await client.queryWorkspace(
    process.env.AZURE_WORKSPACE_ID,
    query,
    { duration: 'P1D' }
  )
  return result
} 