const axios = require('axios');

async function testApi() {
  console.log('Testing DigitalOcean API for Loan Applications...');
  
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();

  const url = `https://lionfish-app-mg3te.ondigitalocean.app/api/loans/export?from=${from.toISOString()}&to=${to.toISOString()}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': 'Key paromita$432' // standard export API key from .env
      }
    });

    console.log('✅ API Request Succeeded!');
    console.log('Status Code:', response.status);
    console.log('Data returned:', response.data.data ? response.data.data.length + ' applications' : response.data);
    if (response.data.data && response.data.data.length > 0) {
      console.log('App 1:', JSON.stringify(response.data.data[0], null, 2));
    }
  } catch (err) {
    console.error('❌ API Request Failed!');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

testApi();
