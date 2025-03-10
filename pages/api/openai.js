import axios from 'axios';

async function callWithRetry(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  let delay = initialDelay;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.response?.data?.error?.code === '429') {
        // Get retry delay from error message or use exponential backoff
        const retryAfter = parseInt(error.response.headers['retry-after']) || (delay / 1000);
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
        
        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        
        // Increase delay for next potential retry
        delay *= 2;
        continue;
      }
      
      // If it's not a rate limit error, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const makeRequest = () => axios.post(
      process.env.AZURE_OPENAI_ENDPOINT,
      {
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: null
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_API_KEY
        }
      }
    );

    const response = await callWithRetry(makeRequest);

    return res.status(200).json({
      message: response.data.choices[0].message.content,
      usage: response.data.usage
    });

  } catch (error) {
    console.error('Azure OpenAI API error:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Error processing request',
      details: error.response?.data?.error?.message || error.message 
    });
  }
} 