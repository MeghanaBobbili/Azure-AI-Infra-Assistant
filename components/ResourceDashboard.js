import { useState, useEffect } from 'react'
import MetricsChart from './MetricsChart'

export default function ResourceDashboard() {
  const [resourceData, setResourceData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchResourceData = async () => {
      try {
        const res = await fetch('/api/resources/status')
        const data = await res.json()
        
        // Ensure resources have a status
        const processedData = {
          ...data,
          resources: data.resources.map(resource => ({
            ...resource,
            status: resource.status || 'Unknown'
          }))
        }
        
        setResourceData(processedData)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch resource data:', err)
        setError('Failed to fetch resource data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchResourceData()
    const interval = setInterval(fetchResourceData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Debug logging
  useEffect(() => {
    if (resourceData?.resources) {
      console.log('Available statuses:', 
        [...new Set(resourceData.resources.map(r => r.status))]
      )
      console.log('Current filter:', statusFilter)
      console.log('Filtered resources count:', 
        resourceData.resources.filter(r => 
          statusFilter === 'All' || r.status === statusFilter
        ).length
      )
    }
  }, [resourceData, statusFilter])

  if (isLoading) {
    return <div className="text-center py-4">Loading resource data...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
  }

  const filteredResources = resourceData?.resources?.filter(resource => {
    const matchesSearch = searchTerm === '' || 
      resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.resourceGroup.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = 
      statusFilter === 'All' || 
      (statusFilter === 'Unknown' && (!resource.status || resource.status === 'Unknown')) ||
      resource.status === statusFilter

    return matchesSearch && matchesStatus
  }) || []

  // Calculate stats based on filtered resources
  const stats = {
    total: filteredResources.length,
    healthy: filteredResources.filter(r => r.status === 'Healthy').length,
    warning: filteredResources.filter(r => r.status === 'Warning').length,
    critical: filteredResources.filter(r => r.status === 'Critical').length,
    unknown: filteredResources.filter(r => !r.status || r.status === 'Unknown').length
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Resource Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600">Total Resources</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-600">Healthy</h3>
            <p className="text-3xl font-bold text-green-700 mt-1">{stats.healthy}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-600">Warning</h3>
            <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.warning}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-600">Critical</h3>
            <p className="text-3xl font-bold text-red-700 mt-1">{stats.critical}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600">Unknown</h3>
            <p className="text-3xl font-bold text-gray-700 mt-1">{stats.unknown}</p>
          </div>
        </div>
      </div>

      {/* Resource Groups */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Resource Groups</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resourceData?.resourceGroups?.map((group, index) => (
            <div key={index} className="border rounded-lg p-4">
              <h3 className="font-medium">{group.name}</h3>
              <div className="mt-2 text-sm text-gray-600">
                <p>Location: {group.location}</p>
                <p>Resources: {group.resourceCount}</p>
              </div>
              {Object.keys(group.tags).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(group.tags).map(([key, value]) => (
                    <span key={key} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resources List with Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Resources</h2>
          <div className="flex space-x-4">
            <input
              type="text"
              placeholder="Search resources..."
              className="border rounded-lg px-4 py-2"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-4 py-2"
            >
              <option value="All">All Status</option>
              <option value="Healthy">Healthy</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
        </div>

        {/* Resources List */}
        <div className="space-y-4">
          {filteredResources.length > 0 ? (
            filteredResources.map((resource, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{resource.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{resource.type}</p>
                    <p className="text-sm text-gray-600">Group: {resource.resourceGroup}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {resource.availability && (
                      <span className="text-sm text-gray-600">
                        {resource.availability}% uptime
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      resource.status === 'Healthy' ? 'bg-green-100 text-green-800' :
                      resource.status === 'Warning' ? 'bg-yellow-100 text-yellow-800' :
                      resource.status === 'Critical' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {resource.status}
                    </span>
                  </div>
                </div>
                {Object.keys(resource.tags).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(resource.tags).map(([key, value]) => (
                      <span key={key} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No resources found matching the current filters
            </div>
          )}
        </div>
      </div>

      {/* Last updated timestamp */}
      <div className="text-sm text-gray-500 text-center">
        Last updated: {new Date(resourceData?.timestamp).toLocaleString()}
      </div>
    </div>
  )
} 