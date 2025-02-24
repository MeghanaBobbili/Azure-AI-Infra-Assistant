import { useState, useEffect, useRef } from 'react'
import { MessageSender } from '../src/types/chat'
import ApprovalDialog from './ApprovalDialog'
import NotificationToast from './NotificationToast'
import MetricsChart from './MetricsChart'
import { Line, Bar } from 'react-chartjs-2'
import { FiCpu, FiHardDrive, FiWifi, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi'

let Chart;
if (typeof window !== 'undefined') {
  import('chart.js/auto').then(module => {
    Chart = module.default;
  });
}

const MetricsCard = ({ title, value, unit, icon: Icon, trend, type }) => {
  const getColorClass = () => {
    if (type === 'cpu' && value > 80) return 'bg-red-50 border-red-200'
    if (type === 'cpu' && value > 60) return 'bg-yellow-50 border-yellow-200'
    return 'bg-green-50 border-green-200'
  }

  return (
    <div className={`p-4 rounded-lg border ${getColorClass()} transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Icon className="w-6 h-6 text-gray-600" />
          <div>
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
            <p className="text-2xl font-bold">
              {value}
              <span className="text-sm font-normal ml-1">{unit}</span>
            </p>
          </div>
        </div>
        {trend && (
          <span className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}

const ResourceMetrics = ({ resource }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
          {resource.resourceName}
        </h2>
        <span className="text-sm text-gray-500">{resource.resourceType}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {resource.metrics.map((metric, index) => {
          const latestValue = metric.data[metric.data.length - 1]?.value || 0
          const previousValue = metric.data[metric.data.length - 2]?.value || 0
          const trend = ((latestValue - previousValue) / previousValue * 100).toFixed(1)

          let icon, unit, formattedValue
          switch (metric.name) {
            case 'Percentage CPU':
              icon = FiCpu
              unit = '%'
              formattedValue = latestValue.toFixed(1)
              break
            case 'Available Memory Bytes':
              icon = FiHardDrive
              unit = 'GB'
              formattedValue = (latestValue / 1024 / 1024 / 1024).toFixed(1)
              break
            default:
              icon = FiWifi
              unit = 'MB/s'
              formattedValue = (latestValue / 1024 / 1024).toFixed(1)
          }

          return (
            <MetricsCard
              key={index}
              title={metric.name}
              value={formattedValue}
              unit={unit}
              icon={icon}
              trend={trend}
              type={metric.name.toLowerCase().includes('cpu') ? 'cpu' : 'other'}
            />
          )
        })}
      </div>

      <div className="space-y-6">
        {resource.metrics.map((metric, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-4">{metric.name} - Last 24 Hours</h3>
            <div className="h-48">
              <Line
                data={{
                  labels: metric.data.map(d => new Date(d.timestamp).toLocaleTimeString()),
                  datasets: [{
                    label: metric.name,
                    data: metric.data.map(d => d.value),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          let value = context.raw
                          if (metric.name.includes('Bytes')) {
                            value = (value / 1024 / 1024 / 1024).toFixed(2) + ' GB'
                          } else if (metric.name.includes('Network')) {
                            value = (value / 1024 / 1024).toFixed(2) + ' MB/s'
                          } else {
                            value = value.toFixed(2) + '%'
                          }
                          return value
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: metric.name }
                    }
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {resource.recommendations && (
        <div className="mt-6 space-y-2">
          {resource.recommendations.map((rec, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              {rec.type === 'warning' ? (
                <FiAlertTriangle className="text-yellow-500" />
              ) : (
                <FiCheckCircle className="text-green-500" />
              )}
              <span>{rec.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatBox() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const chartRefs = useRef({})
  const [pendingApproval, setPendingApproval] = useState(null)
  const [notification, setNotification] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const [metricsData, setMetricsData] = useState(null)

  // Example questions for different categories
  const exampleQuestions = {
    infrastructure: [
      "How do I set up a Virtual Network with multiple subnets?",
      "What's the best way to connect on-premises to Azure?",
      "How can I implement disaster recovery for my VMs?"
    ],
    security: [
      "How do I implement role-based access control?",
      "What are the best practices for securing Azure Storage?",
      "How can I monitor security threats in Azure?"
    ],
    cost: [
      "How can I optimize my Azure costs?",
      "What are Azure reserved instances?",
      "How do I set up cost alerts?"
    ],
    performance: [
      "How do I scale an App Service?",
      "What's the best way to monitor Azure SQL performance?",
      "How can I improve AKS cluster performance?"
    ]
  }

  // Load conversation history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatHistory')
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages))
    }
  }, [])

  // Save conversation history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(messages.slice(-50))) // Keep last 50 messages
    }
  }, [messages])

  // Voice Recognition Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      window.recognition = recognition
    }
  }, [])

  const handleVoiceInput = () => {
    if (isListening) {
      window.recognition?.stop()
    } else {
      window.recognition?.start()
    }
    setIsListening(!isListening)
  }

  const handleQuery = async (query) => {
    setInput(query)
    await handleSubmit()
  }

  // Add function to handle actions that require approval
  const handleActionWithApproval = async (action) => {
    setPendingApproval(action)
    
    try {
      if (action.type === 'scale') {
        const scaleAction = await new Promise((resolve) => {
          setPendingApproval({
            title: 'Scale Resources',
            message: 'Do you want to apply the recommended scaling changes?',
            resources: action.data,
            onApprove: () => resolve(true),
            onDeny: () => resolve(false)
          })
        })

        if (scaleAction) {
          for (const resource of action.data) {
            if (resource.recommendation !== 'no change') {
              try {
                const newSize = getNewSize(resource.currentSize, resource.recommendation)
                await fetch('/api/resources/scale', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    resourceId: resource.resourceId,
                    action: resource.recommendation,
                    size: newSize
                  })
                })
              } catch (error) {
                console.error(`Failed to scale ${resource.name}:`, error)
              }
            }
          }

          setNotification({
            message: 'Scaling operations completed',
            type: 'success'
          })
        }
      } else {
        // Normal query handling
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [...messages, { role: 'user', content: action.query }] })
        })

        const data = await response.json()
        
        // Handle metrics data if present
        if (data.data) {
          setMetricsData(data.data)
        }

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message,
          metrics: data.data 
        }])
      }
    } catch (error) {
      console.error('Error querying assistant:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try rephrasing your question about Azure infrastructure.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // Modify handleSubmit to check for actions requiring approval
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Check if action requires approval
      if (input.toLowerCase().includes('restart') || 
          input.toLowerCase().includes('scale') || 
          input.toLowerCase().includes('delete')) {
        
        const result = await handleActionWithApproval({
          query: input,
          type: 'dangerous_action'
        })

        if (result) {
          setMessages(prev => [...prev, { role: 'assistant', content: result.reply }])
        }
      } else {
        // Normal query handling
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [...messages, userMessage] })
        })

        const data = await response.json()
        
        // Handle metrics data if present
        if (data.data) {
          setMetricsData(data.data)
        }

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message,
          metrics: data.data 
        }])
      }
    } catch (error) {
      console.error('Error querying assistant:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try rephrasing your question about Azure infrastructure.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Add function to render charts
  const renderChart = (chartConfig, messageId) => {
    if (!chartConfig || !chartRefs.current[messageId]) return

    const ctx = chartRefs.current[messageId].getContext('2d')
    const existingChart = Chart.getChart(ctx)
    if (existingChart) {
      existingChart.destroy()
    }

    new Chart(ctx, chartConfig)
  }

  // Add effect to render charts when messages update
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.visualization) {
        renderChart(msg.visualization, msg.id)
      }
    })
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const QuickActions = () => (
    <div className="quick-actions grid grid-cols-2 gap-2 mb-4">
      <button 
        onClick={() => handleQuery("Show alerts")}
        className="p-2 bg-blue-100 hover:bg-blue-200 rounded"
      >
        🔔 Show Alerts
      </button>
      <button 
        onClick={() => handleQuery("List resources")}
        className="p-2 bg-blue-100 hover:bg-blue-200 rounded"
      >
        📋 List Resources
      </button>
      <button 
        onClick={() => handleQuery("Show current month costs")}
        className="p-2 bg-blue-100 hover:bg-blue-200 rounded"
      >
        💰 Cost Overview
      </button>
      <button 
        onClick={() => handleQuery("Show performance metrics")}
        className="p-2 bg-blue-100 hover:bg-blue-200 rounded"
      >
        📊 Performance
      </button>
    </div>
  )

  // Update the renderMetricsChart function in ChatBox component
  const renderMetricsChart = (metrics) => {
    if (!metrics) return null
    
    return (
      <div className="mt-4 space-y-6">
        {metrics.map((resource, index) => (
          <ResourceMetrics key={index} resource={resource} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-4">
            <p className="font-medium">Welcome to Azure Infrastructure Assistant!</p>
            <p className="mt-2">Ask me anything about:</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(exampleQuestions).map(([category, questions]) => (
                <div key={category} className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium capitalize mb-2">{category}</h3>
                  <ul className="space-y-2">
                    {questions.map((q, i) => (
                      <li key={i}>
                        <button
                          onClick={() => handleQuery(q)}
                          className="text-left text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 shadow-sm text-gray-800'
                }`}
              >
                <div className="prose prose-sm max-w-none space-y-4">
                  {message.content.split('```').map((part, i) => {
                    if (i % 2 === 0) {
                      return (
                        <div 
                          key={i} 
                          className="whitespace-pre-wrap leading-relaxed"
                          style={{ fontSize: '15px' }}
                        >
                          {part}
                        </div>
                      )
                    } else {
                      const [lang, ...code] = part.split('\n')
                      return (
                        <div key={i} className="relative group">
                          <pre className={`language-${lang} rounded-lg bg-gray-800 p-4 my-2`}>
                            <code className="text-gray-100 text-sm font-mono">{code.join('\n')}</code>
                          </pre>
                          <button
                            onClick={() => navigator.clipboard.writeText(code.join('\n'))}
                            className="absolute top-2 right-2 bg-gray-700 text-gray-300 px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </button>
                        </div>
                      )
                    }
                  })}
                </div>
                {message.metrics && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {renderMetricsChart(message.metrics)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-4">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about Azure infrastructure..."
            className="flex-1 border rounded-lg p-2 resize-none"
            rows="2"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`px-4 py-2 rounded-lg ${
              isLoading || !input.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Send
          </button>
        </div>
      </form>

      {pendingApproval && (
        <ApprovalDialog
          action={pendingApproval}
          onApprove={pendingApproval.onApprove}
          onDeny={pendingApproval.onDeny}
        />
      )}

      {notification && (
        <NotificationToast
          {...notification}
          onClose={() => setNotification(null)}
        />
      )}

      {metricsData && renderMetricsChart(metricsData)}
    </div>
  )
} 