import { LRUCache } from 'lru-cache';

// Metrics storage
const metricsCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60 // 1 hour
});

// Circuit breaker states
const circuitStates = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half-open'
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.state = circuitStates.CLOSED;
    this.failures = 0;
    this.lastFailureTime = null;
    this.successThreshold = options.successThreshold || 2;
    this.successes = 0;
  }

  async execute(fn) {
    if (this.state === circuitStates.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = circuitStates.HALF_OPEN;
      } else {
        throw new Error(`Circuit breaker for ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    if (this.state === circuitStates.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.reset();
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = circuitStates.OPEN;
    }
  }

  reset() {
    this.failures = 0;
    this.successes = 0;
    this.state = circuitStates.CLOSED;
    this.lastFailureTime = null;
  }
}

// Create circuit breakers for different services
const circuitBreakers = {
  azure: new CircuitBreaker('azure', { failureThreshold: 5, resetTimeout: 30000 }),
  openai: new CircuitBreaker('openai', { failureThreshold: 3, resetTimeout: 15000 })
};

// Metrics collection
function recordMetric(name, value, tags = {}) {
  const timestamp = Date.now();
  const key = `${name}-${timestamp}`;
  
  metricsCache.set(key, {
    name,
    value,
    tags,
    timestamp
  });
}

// Request tracking
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Telemetry for API calls
async function trackApiCall(service, operation, fn) {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();

  try {
    // Execute with circuit breaker
    const result = await circuitBreakers[service].execute(fn);
    
    // Record success metric
    recordMetric(`${service}_${operation}_success`, 1, {
      correlationId,
      duration: Date.now() - startTime
    });
    
    return result;
  } catch (error) {
    // Record failure metric
    recordMetric(`${service}_${operation}_failure`, 1, {
      correlationId,
      errorType: error.type || 'unknown',
      duration: Date.now() - startTime
    });
    
    throw error;
  }
}

// Get metrics for monitoring
function getMetrics(filter = {}) {
  const metrics = Array.from(metricsCache.entries())
    .map(([_, value]) => value)
    .filter(metric => {
      if (filter.name && !metric.name.includes(filter.name)) return false;
      if (filter.since && metric.timestamp < filter.since) return false;
      return true;
    });

  return {
    metrics,
    summary: summarizeMetrics(metrics)
  };
}

function summarizeMetrics(metrics) {
  const summary = {};
  
  metrics.forEach(metric => {
    if (!summary[metric.name]) {
      summary[metric.name] = {
        count: 0,
        sum: 0,
        avg: 0,
        min: Infinity,
        max: -Infinity
      };
    }
    
    const stats = summary[metric.name];
    stats.count++;
    stats.sum += metric.value;
    stats.avg = stats.sum / stats.count;
    stats.min = Math.min(stats.min, metric.value);
    stats.max = Math.max(stats.max, metric.value);
  });
  
  return summary;
}

export {
  trackApiCall,
  generateCorrelationId,
  recordMetric,
  getMetrics,
  circuitBreakers
}; 