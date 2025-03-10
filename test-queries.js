// Simple script to test API queries
const axios = require('axios');

// List of queries to test
const queriesToTest = [
  "What's my current Azure spending?",
  "Show CPU usage for my VMs",
  "List my web apps",
  "Show cost breakdown by service"
];

async function testQuery(query) {
  console.log(`\n\n=======================================`);
  console.log(`TESTING QUERY: "${query}"`);
  console.log(`=======================================`);
  
  try {
    const response = await axios.post('http://localhost:3000/api/query', {
      messages: [
        {
          role: 'user',
          content: query
        }
      ]
    });
    
    // Print message content
    console.log('\nRESPONSE MESSAGE:');
    console.log(response.data.message.substring(0, 200) + '...');
    
    // Print data structure
    console.log('\nDATA STRUCTURE:');
    if (response.data.azureData) {
      console.log(`Type: ${response.data.azureData.type}`);
      if (response.data.azureData.noData) {
        console.log('No Data Available');
      } else if (response.data.azureData.error) {
        console.log(`Error: ${response.data.azureData.message}`);
      } else if (response.data.azureData.data) {
        console.log('Data Available:');
        if (response.data.azureData.type === 'costs') {
          console.log(`- Total Cost: ${response.data.azureData.data.total}`);
          console.log(`- Projected: ${response.data.azureData.data.projected}`);
          if (response.data.azureData.data.byService) {
            console.log(`- Services: ${response.data.azureData.data.byService.length}`);
          }
        } else if (response.data.azureData.type === 'metrics') {
          console.log(`- Resources: ${response.data.azureData.data.length}`);
        }
      }
    } else {
      console.log('No Azure data included in response');
    }
    
    return true;
  } catch (error) {
    console.error(`Error testing query: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    return false;
  }
}

async function runTests() {
  console.log('Starting API query tests...');
  
  for (const query of queriesToTest) {
    await testQuery(query);
  }
  
  console.log('\nAll tests completed!');
}

runTests(); 