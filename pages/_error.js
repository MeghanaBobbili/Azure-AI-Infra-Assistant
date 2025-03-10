import React from 'react'
import Layout from '../components/Layout'

function Error({ statusCode }) {
  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <svg 
            className="w-16 h-16 mx-auto text-red-500 mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>

          <h1 className="text-2xl font-bold mb-4">
            {statusCode
              ? `An error ${statusCode} occurred on server`
              : 'An error occurred on client'}
          </h1>
          
          <p className="mb-4 text-gray-600">
            We apologize for the inconvenience. Please try again later or contact support if the issue persists.
          </p>
          
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </Layout>
  )
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error 