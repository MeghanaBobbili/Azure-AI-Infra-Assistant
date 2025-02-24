import Layout from '../components/Layout'
import ResourceOptimization from '../components/ResourceOptimization'
import ResourceHealthMonitor from '../components/ResourceHealthMonitor'

export default function Resources() {
  return (
    <Layout>
      <div className="space-y-8">
        <ResourceOptimization />
        <ResourceHealthMonitor />
      </div>
    </Layout>
  )
} 