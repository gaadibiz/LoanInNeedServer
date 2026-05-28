#!/usr/bin/env node

/**
 * Simple script to test the healthcheck endpoint locally
 * Usage: node scripts/test-healthcheck.js [port]
 */

const http = require('http');

const PORT = process.env.PORT || process.argv[2] || 5000;
const HOST = '127.0.0.1';

const options = {
  hostname: HOST,
  port: PORT,
  path: '/',
  method: 'GET',
  timeout: 5000
};

console.log(`Testing healthcheck endpoint at http://${HOST}:${PORT}/`);
console.log('─'.repeat(50));

const req = http.request(options, (res) => {
  let data = '';

  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Status Message: ${res.statusMessage}`);
  console.log(`Headers:`, res.headers);
  console.log('─'.repeat(50));

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Response Body:');
      console.log(JSON.stringify(json, null, 2));
      console.log('─'.repeat(50));

      if (res.statusCode === 200 && json.status === 'healthy') {
        console.log('✅ Healthcheck PASSED - Server is healthy!');
        process.exit(0);
      } else {
        console.log('❌ Healthcheck FAILED - Unexpected response');
        process.exit(1);
      }
    } catch (error) {
      console.log('Response Body (raw):');
      console.log(data);
      console.log('─'.repeat(50));
      console.log('❌ Healthcheck FAILED - Invalid JSON response');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Healthcheck FAILED - Connection error:');
  console.error(`   ${error.message}`);
  console.log('─'.repeat(50));
  console.log('💡 Make sure the server is running:');
  console.log(`   npm run start`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Healthcheck FAILED - Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();

