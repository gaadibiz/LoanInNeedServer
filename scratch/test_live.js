const axios = require('axios');

async function triggerLive() {
  try {
    const url = 'https://lionfish-app-mg3te.ondigitalocean.app/api/los/applications/25/trigger';
    console.log(`Triggering POST ${url}`);
    const res = await axios.post(url, null, {
      headers: { 'Authorization': 'Key paromita$432' },
      timeout: 30000
    });
    console.log("Success! Data:");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Failed:");
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}
triggerLive();
