import ChatBox from '../components/ChatBox'
import Layout from '../components/Layout'

export default function Home() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Azure Infrastructure Assistant</h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <ChatBox />
        </div>
      </div>
    </Layout>
  )
} 