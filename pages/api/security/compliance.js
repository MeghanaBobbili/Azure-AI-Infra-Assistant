import { DefaultAzureCredential } from "@azure/identity"
import { SecurityCenter } from "@azure/arm-security"
import { MonitorClient } from "@azure/arm-monitor"

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const credential = new DefaultAzureCredential()
    const securityClient = new SecurityCenter(credential, process.env.AZURE_SUBSCRIPTION_ID)
    const scope = `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}`

    // Get security assessments
    let assessments = []
    try {
      const assessmentsList = await securityClient.assessments.list(scope)
      for await (const assessment of assessmentsList) {
        assessments.push({
          name: assessment.displayName || assessment.name,
          description: assessment.metadata?.description || '',
          severity: assessment.metadata?.severity || 'Low',
          status: assessment.status?.code || 'Unknown',
          category: assessment.metadata?.category || 'General'
        })
      }
    } catch (error) {
      console.warn('Security assessments not available:', error.message)
      assessments = [{
        name: 'Security Assessment',
        description: 'Azure Defender is required for detailed security assessment',
        severity: 'Info',
        status: 'Not Available',
        category: 'Security'
      }]
    }

    // Get compliance standards
    let compliance = []
    try {
      const complianceResults = await securityClient.regulatoryCompliance.list()
      for await (const standard of complianceResults) {
        compliance.push({
          name: standard.name,
          description: standard.description || 'Compliance standard',
          status: standard.state || 'Unknown',
          progress: Math.round((standard.passedControls / 
            (standard.passedControls + standard.failedControls)) * 100) || 0
        })
      }
    } catch (error) {
      console.warn('Compliance data not available:', error.message)
      compliance = [{
        name: 'Compliance Standards',
        description: 'Enable Azure Defender to view compliance standards',
        status: 'Not Available',
        progress: 0
      }]
    }

    // Calculate security score
    const securityScore = assessments.length ? 
      Math.round((assessments.filter(a => a.status === 'Healthy').length / assessments.length) * 100) : 0

    res.status(200).json({
      score: securityScore,
      assessments,
      compliance,
      vulnerabilities: [], // Requires Azure Defender
      metrics: {
        history: null // Remove metrics for now since they're not available
      }
    })

  } catch (error) {
    console.error('Error fetching security data:', error)
    res.status(200).json({
      score: 0,
      assessments: [{
        name: 'Security Center Access',
        description: 'Unable to access security data. Please verify Azure permissions.',
        severity: 'Info',
        status: 'Error',
        category: 'Access'
      }],
      compliance: [],
      vulnerabilities: [],
      metrics: { history: null }
    })
  }
} 