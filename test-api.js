// Simple script to test a single API query
const fetch = require('node-fetch');

// The query to test
const query = "What's my current Azure spending?";

async function testApi() {
  try {
    console.log(`Testing query: "${query}"`);
    
    const response = await fetch('http://localhost:3000/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: query
          }
        ]
      })
    });
    
    const data = await response.json();
    
    console.log('\n----- RESPONSE DATA -----');
    console.log(`Status: ${response.status}`);
    console.log(`Message: ${data.message.substring(0, 200)}...`);
    
    if (data.azureData) {
      console.log('\n----- AZURE DATA -----');
      console.log(`Type: ${data.azureData.type}`);
      
      if (data.azureData.type === 'costs') {
        if (data.azureData.data) {
          console.log(`Total Cost: $${data.azureData.data.total}`);
          console.log(`Projected: $${data.azureData.data.projected}`);
          
          if (data.azureData.data.byService) {
            console.log('\nServices:');
            data.azureData.data.byService.forEach(service => {
              console.log(`- ${service.name}: $${service.cost} (${service.percentage}%)`);
            });
          }
        } else if (data.azureData.noData) {
          console.log('No cost data available');
        }
      }
    } else {
      console.log('No Azure data in response');
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testApi(); 