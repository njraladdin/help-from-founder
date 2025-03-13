#!/usr/bin/env node

/**
 * Test script to send a response notification through the email notification worker
 * Run with: node test-response.js
 */

const https = require('https');

// Specific recipient email
const recipientEmail = 'aladynjr@gmail.com';

// Worker URL
const WORKER_URL = 'https://email-notification-worker.aladynjr.workers.dev';
const ENDPOINT = '/api/send-email'; // This endpoint is defined in the wrangler.jsonc

// Test notification data
const testData = {
  type: 'new_response',
  projectId: 'test-project',
  projectName: 'Test Project',
  issueId: 'test-issue-' + Date.now(),
  issueTitle: 'Test Issue for Response',
  responseContent: 'This is a test response to verify the email notification worker is functioning correctly for responses.\n\nIf you received this email, the worker is working as expected for response notifications!',
  responseAuthor: 'Test Responder',
  founderEmail: recipientEmail,
  userName: 'Test Script',
  createdAt: new Date().toISOString(),
  issueUrl: 'https://helpfromfounder.com/test-project/test-issue'
};

// Prepare request data
const data = JSON.stringify(testData);

console.log(`Sending test response notification to: ${recipientEmail}`);
console.log(`Worker URL: ${WORKER_URL}${ENDPOINT}`);
console.log('Request body:', JSON.stringify(testData, null, 2));

// Parse URL to get hostname
const url = new URL(WORKER_URL);

// Prepare request options
const options = {
  hostname: url.hostname,
  port: 443,
  path: ENDPOINT,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

// Create and send request
const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
  
  let responseData = '';
  
  // Collect response data
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  // Process response when complete
  res.on('end', () => {
    console.log('Raw response:', responseData);
    try {
      if (responseData && responseData.trim() && responseData.trim()[0] === '{') {
        const parsedData = JSON.parse(responseData);
        console.log('Response from worker:');
        console.log(JSON.stringify(parsedData, null, 2));
        
        if (parsedData.success) {
          console.log('\n✅ Test successful! Response notification email sent to aladynjr@gmail.com');
        } else {
          console.log('\n❌ Test failed. See error details above.');
        }
      } else {
        console.log('\n❌ Non-JSON response received.');
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

// Send data
req.write(data);
req.end(); 