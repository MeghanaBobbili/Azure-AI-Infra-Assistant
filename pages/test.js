import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useMsal } from '@azure/msal-react';
import Head from 'next/head';
import Link from 'next/link';

export default function TestPage() {
  const { data: session, status } = useSession();
  const { accounts } = useMsal();
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Check for authentication in either NextAuth or MSAL
  const isAuthenticated = (status === 'authenticated' && session) || (accounts && accounts.length > 0);
  const isLoading = status === 'loading';
  
  const queries = [
    "What's my current Azure spending?",
    "Show CPU usage for my VMs",
    "List my web apps",
    "Show cost breakdown by service",
    "Show critical security alerts",
    "Check resource health status",
    "Show recent web app logs",
    "List resources with high CPU usage",
    "Show failed deployments in last 24 hours",
    "List resources with pending updates",
    "List all my Azure resources"
  ];
  
  async function runTests() {
    setIsRunning(true);
    setTestResults([]);
    
    for (const query of queries) {
      try {
        const start = new Date();
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: query
              }
            ]
          })
        });
        
        const data = await response.json();
        const end = new Date();
        const duration = end - start;
        
        setTestResults(prev => [...prev, {
          query,
          duration: `${duration}ms`,
          status: response.status,
          message: data.message,
          azureData: data.azureData,
          success: true
        }]);
      } catch (error) {
        setTestResults(prev => [...prev, {
          query,
          error: error.message,
          success: false
        }]);
      }
    }
    
    setIsRunning(false);
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="mb-4">Checking authentication status</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="mb-4">You need to be signed in to run API tests.</p>
          <button
            onClick={() => signIn('azure-ad')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Sign In with Azure AD
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>Azure Assistant API Tests</title>
      </Head>
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Azure Assistant API Tests</h1>
        <p className="mb-4">Run tests to see how the API responds to different queries.</p>
        
        <button 
          onClick={runTests}
          disabled={isRunning}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
        
        <Link href="/" className="ml-4 text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </div>
      
      {testResults.length > 0 && (
        <div className="space-y-8">
          {testResults.map((result, index) => (
            <div key={index} className="border rounded-lg p-4 bg-white shadow">
              <h2 className="text-lg font-bold mb-2">Query: "{result.query}"</h2>
              
              {result.success ? (
                <>
                  <div className="mb-2 text-sm text-gray-500">
                    Status: {result.status} | Duration: {result.duration}
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="font-medium mb-1">Response:</h3>
                    <div className="p-3 bg-gray-100 rounded text-sm max-h-32 overflow-y-auto whitespace-pre-line">
                      {result.message.replace(/###/g, '').replace(/\*\*/g, '').replace(/---/g, '').replace(/```[^`]*```/g, '')}
                    </div>
                  </div>
                  
                  {result.azureData ? (
                    <div>
                      <h3 className="font-medium mb-1">Azure Data:</h3>
                      <div className="p-3 bg-gray-100 rounded text-sm max-h-64 overflow-y-auto">
                        <div><strong>Type:</strong> {result.azureData.type}</div>
                        
                        {result.azureData.type === 'costs' && result.azureData.data && (
                          <div className="mt-2">
                            <div><strong>Total:</strong> ${result.azureData.data.total}</div>
                            <div><strong>Projected:</strong> ${result.azureData.data.projected}</div>
                            
                            {result.azureData.data.byService && (
                              <div className="mt-2">
                                <strong>Services:</strong>
                                <ul className="list-disc pl-5 mt-1">
                                  {result.azureData.data.byService.map((service, i) => (
                                    <li key={i}>
                                      {service.name}: ${service.cost} ({service.percentage}%)
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {result.azureData.type === 'metrics' && (
                          <div>
                            <strong>Resources:</strong> {result.azureData.data.length}
                          </div>
                        )}
                        
                        {result.azureData.type === 'resources' && (
                          <div>
                            <div><strong>Total Resources:</strong> {result.azureData.count}</div>
                            <div className="mt-2">
                              <strong>Resources:</strong>
                              <ul className="list-disc pl-5 mt-1">
                                {result.azureData.data.map((resource, i) => (
                                  <li key={i} className="mb-2">
                                    <div><strong>Name:</strong> {resource.name}</div>
                                    <div><strong>Type:</strong> {resource.type}</div>
                                    <div><strong>Location:</strong> {resource.location}</div>
                                    <div><strong>Resource Group:</strong> {resource.resourceGroup}</div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                        
                        {result.azureData.noData && (
                          <div className="text-yellow-600">No data available</div>
                        )}
                        
                        {result.azureData.error && (
                          <div className="text-red-500">Error: {result.azureData.message}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-600">No Azure data in response</div>
                  )}
                </>
              ) : (
                <div className="text-red-500">
                  Error: {result.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context) {
  return {
    props: {}
  };
} 