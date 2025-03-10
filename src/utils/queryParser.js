import axios from 'axios';

// Intent definitions
export const INTENTS = {
  COST: {
    VM: 'cost_vm',
    STORAGE: 'cost_storage',
    GENERAL: 'cost_general'
  },
  PERFORMANCE: {
    VM: 'performance_vm',
    GENERAL: 'performance_general'
  },
  RESOURCES: {
    LIST: 'resources_list',
    DETAILS: 'resources_details'
  },
  UNKNOWN: 'unknown'
};

// Keywords mapping to intents
const KEYWORDS = {
  cost: {
    general: ['cost', 'spend', 'bill', 'charge', 'expense', 'pricing'],
    vm: ['vm cost', 'virtual machine cost', 'compute cost'],
    storage: ['storage cost', 'disk cost']
  },
  performance: {
    general: ['performance', 'metrics', 'monitoring', 'health'],
    vm: ['vm performance', 'cpu usage', 'memory usage']
  },
  resources: {
    list: ['list', 'show', 'get', 'what', 'resources'],
    details: ['details', 'information', 'about']
  }
};

// Match keywords in query
function matchKeywords(query, keywordList) {
  return keywordList.some(keyword => 
    query.toLowerCase().includes(keyword.toLowerCase())
  );
}

// Detect intent from query
export function detectIntent(query) {
  // Cost intents
  if (matchKeywords(query, KEYWORDS.cost.vm)) {
    return INTENTS.COST.VM;
  }
  if (matchKeywords(query, KEYWORDS.cost.storage)) {
    return INTENTS.COST.STORAGE;
  }
  if (matchKeywords(query, KEYWORDS.cost.general)) {
    return INTENTS.COST.GENERAL;
  }

  // Performance intents
  if (matchKeywords(query, KEYWORDS.performance.vm)) {
    return INTENTS.PERFORMANCE.VM;
  }
  if (matchKeywords(query, KEYWORDS.performance.general)) {
    return INTENTS.PERFORMANCE.GENERAL;
  }

  // Resource intents
  if (matchKeywords(query, KEYWORDS.resources.list)) {
    return INTENTS.RESOURCES.LIST;
  }
  if (matchKeywords(query, KEYWORDS.resources.details)) {
    return INTENTS.RESOURCES.DETAILS;
  }

  return INTENTS.UNKNOWN;
}

// Refine prompt based on intent
export function refinePrompt(query, intent) {
  switch (intent) {
    case INTENTS.COST.VM:
      return 'You are an Azure cost analyst. Help analyze VM costs and suggest optimizations.';
    
    case INTENTS.COST.STORAGE:
      return 'You are an Azure cost analyst. Help analyze storage costs and suggest optimizations.';
    
    case INTENTS.COST.GENERAL:
      return 'You are an Azure cost analyst. Help analyze overall costs and suggest optimizations.';
    
    case INTENTS.PERFORMANCE.VM:
      return 'You are an Azure performance expert. Help analyze VM metrics and suggest improvements.';
    
    case INTENTS.PERFORMANCE.GENERAL:
      return 'You are an Azure performance expert. Help analyze system metrics and suggest improvements.';
    
    case INTENTS.RESOURCES.LIST:
      return 'You are an Azure resource manager. Help list and organize Azure resources.';
    
    case INTENTS.RESOURCES.DETAILS:
      return 'You are an Azure resource expert. Help provide detailed information about Azure resources.';
    
    default:
      return 'You are an Azure infrastructure assistant. Help the user with their Azure-related query.';
  }
}

// Process query through OpenAI
export async function processWithOpenAI(query, messages, azureData = null) {
  const systemMessage = {
    role: 'system',
    content: 'You are an Azure infrastructure assistant. Help with Azure-related queries.'
  };

  const contextMessage = azureData ? {
    role: 'system',
    content: `Current Azure data: ${JSON.stringify(azureData)}`
  } : null;

  const response = await axios.post(
    process.env.AZURE_OPENAI_ENDPOINT,
    {
      messages: [
        systemMessage,
        ...(contextMessage ? [contextMessage] : []),
        ...messages,
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 1000
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY
      }
    }
  );

  return response.data.choices[0].message.content;
} 