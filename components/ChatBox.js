import { useState } from 'react'
import { MessageSender } from '../src/types/chat'

export default function ChatBox() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    setIsLoading(true)
    setMessages(prev => [...prev, { 
      sender: MessageSender.USER, 
      text: input 
    }])
    setInput('')

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input })
      })
      const data = await res.json()
      
      setMessages(prev => [...prev, { 
        sender: MessageSender.ASSISTANT, 
        text: data.reply 
      }])
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { 
        sender: MessageSender.ASSISTANT, 
        text: "Sorry, I encountered an error. Please try again." 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="chat-container">
      <h1 className="chat-header">Azure AI Infrastructure Assistant</h1>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`message ${
              msg.sender === MessageSender.USER 
                ? 'user-message' 
                : 'assistant-message'
            }`}
          >
            <div className="font-semibold mb-1">
              {msg.sender === MessageSender.USER ? '👤 You' : '🤖 Assistant'}
            </div>
            <div className="whitespace-pre-wrap">{msg.text}</div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-gray-400 text-center py-8">
            Ask me anything about your Azure infrastructure!
          </div>
        )}
      </div>
      
      <div className="flex gap-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          className="chat-input"
          placeholder="Ask about your Azure infrastructure..."
          disabled={isLoading}
        />
        <button 
          onClick={handleSend}
          className="chat-button"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  )
} 