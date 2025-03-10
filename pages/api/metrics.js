import { getMetrics } from '../../src/utils/telemetry';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, since } = req.query;
    const filter = {};
    
    if (name) filter.name = name;
    if (since) filter.since = parseInt(since);

    const metrics = getMetrics(filter);

    // Calculate high-level statistics
    const stats = {
      totalRequests: 0,
      successRate: 0,
      averageLatency: 0,
      errorRate: 0,
      rateLimit: {
        exceeded: 0,
        total: 0
      }
    };

    metrics.metrics.forEach(metric => {
      if (metric.name === 'request_received') stats.totalRequests++;
      if (metric.name === 'request_completed') {
        stats.averageLatency = (stats.averageLatency * stats.successRate + metric.tags.duration) / (stats.successRate + 1);
        stats.successRate++;
      }
      if (metric.name === 'request_error') stats.errorRate++;
      if (metric.name === 'rate_limit_exceeded') stats.rateLimit.exceeded++;
    });

    stats.successRate = stats.successRate / stats.totalRequests;
    stats.errorRate = stats.errorRate / stats.totalRequests;
    stats.rateLimit.total = stats.totalRequests;

    return res.status(200).json({
      stats,
      ...metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    return res.status(500).json({ 
      error: 'Error fetching metrics',
      details: error.message
    });
  }
} 