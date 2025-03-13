#!/usr/bin/env node

/**
 * Simple test script to check if the worker is responding
 * Run with: node test-health.js
 */

const https = require('https');

// Worker URL
const WORKER_URL = 'https://email-notification-worker.aladynjr.workers.dev';

console.log(`Checking worker health: ${WORKER_URL}`);

// Parse URL to get hostname
const url = new URL(WORKER_URL);

// Prepare request options
const options = {
  hostname: url.hostname,
  port: 443,
  path: '/',
  method: 'GET'
};

// Create and send request
const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let responseData = '';
  
  // Collect response data
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  // Process response when complete
  res.on('end', () => {
    console.log('Raw response:', responseData);
    try {
      if (responseData) {
        const parsedData = JSON.parse(responseData);
        console.log('Response from worker:');
        console.log(JSON.stringify(parsedData, null, 2));
        
        if (parsedData.status === 'ok') {
          console.log('\n✅ Worker is healthy and responding!');
        } else {
          console.log('\n⚠️ Worker responded but may have issues.');
        }
      } else {
        console.log('\n❌ Empty response received.');
      }
    } catch (e) {
      console.error('Error parsing response:', e);
    }
  });
});

// Handle errors
req.on('error', (error) => {
  console.error('Error sending request:', error);
});

// End the request (no data for GET)
req.end(); 