import { useState, useEffect } from 'react'

export default function ApprovalDialog({ action, onApprove, onDeny }) {
  const [timeLeft, setTimeLeft] = useState(30) // 30 second timeout
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          onDeny()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [onDeny])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Approval Required</h2>
        
        <div className="mb-4">
          <p className="text-gray-600">
            The following action requires approval:
          </p>
          <pre className="bg-gray-100 p-2 rounded mt-2 overflow-auto">
            {JSON.stringify(action, null, 2)}
          </pre>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Auto-denying in {timeLeft} seconds
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onDeny}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Deny
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
} 