import { useState, useEffect } from 'react'
import MetricsChart from './MetricsChart'

export default function SecurityComplianceDashboard() {
  const [securityData, setSecurityData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        const res = await fetch('/api/security/compliance')
        const data = await res.json()
        setSecurityData(data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch security data:', err)
        setError('Failed to fetch security data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSecurityData()
  }, [])

  if (isLoading) {
    return <div className="text-center py-4">Loading security analysis...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* Overall Security Score */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Security Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <h3 className="text-sm font-medium opacity-90">Overall Security Score</h3>
            <p className="text-3xl font-bold mt-1">
              {securityData?.score || 0}%
            </p>
            <div className="mt-2 h-2 bg-blue-400 bg-opacity-30 rounded-full">
              <div 
                className="h-2 bg-white rounded-full transition-all duration-500"
                style={{ width: `${securityData?.score || 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600">Critical Issues</h3>
            <p className="text-3xl font-bold text-red-600 mt-1">
              {securityData?.assessments?.filter(a => a.severity === 'Critical').length || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Require immediate attention</p>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600">Compliance Status</h3>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {securityData?.compliance?.filter(c => c.status === 'Compliant').length || 0}/{securityData?.compliance?.length || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Standards met</p>
          </div>
        </div>
      </div>

      {/* Security Assessments */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Security Assessments</h2>
        <div className="space-y-4">
          {securityData?.assessments?.map((assessment, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{assessment.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{assessment.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  assessment.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                  assessment.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                  assessment.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {assessment.severity}
                </span>
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  assessment.status === 'Healthy' ? 'bg-green-500' :
                  assessment.status === 'Warning' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                <span className="text-gray-600">{assessment.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Standards */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Compliance Standards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {securityData?.compliance?.map((standard, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{standard.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{standard.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  standard.status === 'Compliant' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {standard.status}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{standard.progress}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div 
                    className="h-2 bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${standard.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vulnerabilities */}
      {securityData?.vulnerabilities?.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Vulnerability Assessment</h2>
          <div className="space-y-4">
            {securityData.vulnerabilities.map((vuln, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{vuln.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{vuln.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    vuln.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                    vuln.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {vuln.severity}
                  </span>
                </div>
                <div className="mt-3 flex items-center text-sm">
                  <span className="text-gray-600">{vuln.category}</span>
                  <span className="mx-2">•</span>
                  <span className="text-gray-600">{vuln.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 