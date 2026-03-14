const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';
const REPORT_FILE = 'Backend_API_Test_Report.html';

const endpointsToTest = [
    { name: 'Health Check', method: 'GET', url: '/' },
    { name: 'Request Phone OTP', method: 'POST', url: '/api/auth/phone/request-otp', data: { phone: '9999999999', countryCode: '+91' } },
    { name: 'Verify Phone OTP (Dev Bypass)', method: 'POST', url: '/api/auth/phone/verify-otp', data: { phone: '9999999999', code: '261102' } },
];

async function runTests() {
    let htmlContent = `
    <html>
      <head>
        <title>Backend API Test Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; }
          .pass { color: green; font-weight: bold; }
          .fail { color: red; font-weight: bold; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f4f4f4; }
        </style>
      </head>
      <body>
        <h1>LoanInNeed Backend API Test Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <tr>
            <th>Endpoint Name</th>
            <th>Method</th>
            <th>URL</th>
            <th>Status</th>
            <th>Response Code</th>
            <th>Message</th>
          </tr>
  `;

    for (const endpoint of endpointsToTest) {
        try {
            const startTime = Date.now();
            let response;
            if (endpoint.method === 'GET') {
                response = await axios.get(`${BASE_URL}${endpoint.url}`);
            } else if (endpoint.method === 'POST') {
                response = await axios.post(`${BASE_URL}${endpoint.url}`, endpoint.data || {});
            }

            htmlContent += `
        <tr>
          <td>${endpoint.name}</td>
          <td>${endpoint.method}</td>
          <td>${endpoint.url}</td>
          <td class="pass">PASS</td>
          <td>${response.status}</td>
          <td>OK (${Date.now() - startTime}ms)</td>
        </tr>
      `;
        } catch (error) {
            const status = error.response ? error.response.status : 'N/A';
            const errorMessage = error.response && error.response.data ? JSON.stringify(error.response.data) : error.message;
            htmlContent += `
        <tr>
          <td>${endpoint.name}</td>
          <td>${endpoint.method}</td>
          <td>${endpoint.url}</td>
          <td class="fail">FAIL</td>
          <td>${status}</td>
          <td>${errorMessage}</td>
        </tr>
      `;
        }
    }

    htmlContent += `
        </table>
      </body>
    </html>
  `;

    fs.writeFileSync(REPORT_FILE, htmlContent);
    console.log(`Report generated successfully at ${REPORT_FILE}`);
}

runTests();
