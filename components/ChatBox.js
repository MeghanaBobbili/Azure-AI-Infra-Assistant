import { useState, useEffect, useRef } from 'react'
import { MessageSender } from '../src/types/chat'
import ApprovalDialog from './ApprovalDialog'
import NotificationToast from './NotificationToast'
import MetricsChart from './MetricsChart'
import { Line, Bar } from 'react-chartjs-2'
import { FiCpu, FiHardDrive, FiWifi, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi'
import { processQuery } from '../src/utils/queryParser'

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

const AlertCard = ({ alert }) => (
  <div className={`p-4 rounded-lg border border-red-200 bg-red-50 mb-2`}>
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium text-red-800">{alert.message}</h4>
        <p className="text-sm text-red-600">
          {new Date(alert.timestamp).toLocaleString()}
        </p>
      </div>
      <span className="px-2 py-1 rounded text-sm font-medium bg-red-100 text-red-800">
        {alert.severity}
      </span>
    </div>
  </div>
)

const LogEntry = ({ log }) => (
  <div className={`p-4 rounded-lg border border-yellow-200 bg-yellow-50 mb-2`}>
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium text-yellow-800">{log.message}</h4>
        <p className="text-sm text-yellow-600">
          {new Date(log.timestamp).toLocaleString()}
        </p>
      </div>
      <span className="px-2 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800">
        {log.level}
      </span>
    </div>
  </div>
)

export default function ChatBox() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const chartRefs = useRef({})
  const [pendingApproval, setPendingApproval] = useState(null)
  const [notification, setNotification] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const [metricsData, setMetricsData] = useState(null)
  const [azureData, setAzureData] = useState(null)

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
    try {
      setIsLoading(true);
      setIsTyping(true);
      
      // Process query through our parsing layer
      const processedQuery = await processQuery(query, messages);
      
      if (!processedQuery.success) {
        throw new Error(processedQuery.error);
      }

      // Add user message
      setMessages(prev => [...prev, { 
        role: 'user', 
        content: query,
        timestamp: new Date().toISOString()
      }]);

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: query }],
          intent: processedQuery.intent,
          refinedPrompt: processedQuery.refinedPrompt
        })
      });

      const data = await response.json();
      
      if (data.requiresApproval) {
        setPendingApproval(data.action);
        return;
      }

      // Add assistant message with Azure data
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        azureData: data.azureData,
        intent: processedQuery.intent,
        timestamp: new Date().toISOString()
      }]);

      // Update Azure data state if present
      if (data.azureData) {
        setAzureData(data.azureData);
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        error: true,
        timestamp: new Date().toISOString()
      }]);
      setNotification({
        type: 'error',
        message: 'Failed to get response. Please try again.'
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      scrollToBottom();
    }
  };

  const handleActionWithApproval = async (action) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages],
          action: action
        })
      });

      const data = await response.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        azureData: data.azureData,
        timestamp: new Date().toISOString()
      }]);

      if (data.azureData) {
        setAzureData(data.azureData);
      }

      setNotification({
        type: 'success',
        message: `Successfully executed ${action.type} operation`
      });

    } catch (error) {
      console.error('Error executing action:', error);
      setNotification({
        type: 'error',
        message: `Failed to execute ${action.type} operation`
      });
    } finally {
      setPendingApproval(null);
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const query = input;
    setInput('');
    await handleQuery(query);
  };

  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    const hasAzureData = message.azureData && !message.azureData.error;
    
    return (
      <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[80%] ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-100'} rounded-lg px-4 py-2`}>
          {/* Message content */}
          <div className="whitespace-pre-line text-sm">
            {message.content}
          </div>
          
          {/* Azure Data Display */}
          {hasAzureData && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              {message.azureData.type === 'metrics' && (
                <div className="space-y-4">
                  {message.azureData.data.map((resource, i) => (
                    <ResourceMetrics key={i} resource={resource} />
                  ))}
                </div>
              )}
              
              {message.azureData.type === 'costs' && message.azureData.data && (
                <div className="space-y-2">
                  <div className="font-medium">Cost Summary</div>
                  <div>Total: ${message.azureData.data.total}</div>
                  <div>Projected: ${message.azureData.data.projected}</div>
                  {message.azureData.data.byService && (
                    <div className="mt-2">
                      <div className="font-medium">Services:</div>
                      <ul className="list-disc pl-5 mt-1">
                        {message.azureData.data.byService.map((service, i) => (
                          <li key={i}>
                            {service.name}: ${service.cost} ({service.percentage}%)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {message.azureData.type === 'resources' && (
                <div className="space-y-2">
                  <div className="font-medium">Resources ({message.azureData.count})</div>
                  <div className="max-h-60 overflow-y-auto">
                    <ul className="list-disc pl-5">
                      {message.azureData.data.map((resource, i) => (
                        <li key={i} className="mb-2">
                          <div>{resource.name}</div>
                          <div className="text-xs text-gray-500">
                            {resource.type} | {resource.location}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Timestamp */}
          <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

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

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Azure Assistant</h2>
        <div className="flex items-center space-x-2">
          {isListening && (
            <span className="text-sm text-blue-500">Listening...</span>
          )}
          <button
            onClick={() => setMessages([])}
            className="text-gray-500 hover:text-gray-700"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="mb-4">How can I help you with Azure today?</p>
            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
              {Object.entries(exampleQuestions).map(([category, questions]) => (
                <div key={category} className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-medium mb-2 capitalize">{category}</h3>
                  <ul className="space-y-2">
                    {questions.map((q, i) => (
                      <li key={i}>
                        <button
                          onClick={() => handleQuery(q)}
                          className="text-sm text-left text-blue-500 hover:text-blue-700"
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
          messages.map((message, index) => renderMessage(message, index))
        )}
        {isTyping && (
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about Azure..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`p-2 rounded-lg ${isListening ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            🎤
          </button>
        </form>
      </div>

      {/* Approval Dialog */}
      {pendingApproval && (
        <ApprovalDialog
          action={pendingApproval}
          onApprove={handleActionWithApproval}
          onCancel={() => setPendingApproval(null)}
        />
      )}

      {/* Notification Toast */}
      {notification && (
        <NotificationToast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  )
} 