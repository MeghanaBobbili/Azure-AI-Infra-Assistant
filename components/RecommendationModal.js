import React from 'react'

export default function RecommendationModal({ recommendation, onClose, onAction, isActionInProgress }) {
  if (!recommendation) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Recommendation Details</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Impact Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              recommendation.impact === 'high' ? 'bg-red-100 text-red-800' :
              recommendation.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {recommendation.impact.toUpperCase()} Impact
            </span>
            {recommendation.potentialSavings > 0 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                Potential Savings: ${recommendation.potentialSavings}/month
              </span>
            )}
          </div>

          {/* Title and Description */}
          <div>
            <h3 className="text-lg font-medium mb-2">{recommendation.title}</h3>
            <p className="text-gray-600">{recommendation.description}</p>
          </div>

          {/* Resource Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium">Resource Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Resource Name</p>
                <p className="font-medium">{recommendation.resource}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Resource Type</p>
                <p className="font-medium">{recommendation.resourceType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium capitalize">{recommendation.category}</p>
              </div>
              {recommendation.actionDescription && (
                <div>
                  <p className="text-sm text-gray-500">Recommended Action</p>
                  <p className="font-medium">{recommendation.actionDescription}</p>
                </div>
              )}
            </div>
          </div>

          {/* Implementation Impact */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Implementation Impact</h4>
            <ul className="list-disc list-inside space-y-2 text-blue-700">
              {recommendation.category === 'cost' && (
                <>
                  <li>Reduce monthly costs through automated resource optimization</li>
                  <li>Improve resource utilization efficiency</li>
                  <li>Maintain performance while minimizing waste</li>
                </>
              )}
              {recommendation.category === 'performance' && (
                <>
                  <li>Enhance application responsiveness</li>
                  <li>Improve user experience</li>
                  <li>Optimize resource allocation</li>
                </>
              )}
              {recommendation.category === 'security' && (
                <>
                  <li>Strengthen security posture</li>
                  <li>Reduce potential vulnerabilities</li>
                  <li>Enhance compliance with best practices</li>
                </>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <a
              href={recommendation.actionLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-blue-600 hover:text-blue-800"
            >
              View in Portal
            </a>
            {recommendation.action && (
              <button
                onClick={() => onAction(recommendation)}
                disabled={isActionInProgress}
                className={`px-4 py-2 rounded-md text-white ${
                  isActionInProgress
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isActionInProgress ? (
                  <div className="flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Optimizing...
                  </div>
                ) : (
                  'Apply Optimization'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 