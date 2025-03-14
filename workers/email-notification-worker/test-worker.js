#!/usr/bin/env node

/**
 * Simple test script to send a real email through the email notification worker
 * Run with: node test-worker.js
 */

const https = require('https');

// Test recipient emails
const primaryEmail = 'aladynjr@gmail.com';
const secondaryEmail = 'aladdintemp61@gmail.com'; // Using email alias for testing
const thirdEmail = 'jihednajjar2022@gmail.com'; // Third test recipient

// Worker URL
const WORKER_URL = 'https://email-notification-worker.aladynjr.workers.dev';
const ENDPOINT = '/api/send-email'; // This endpoint is defined in the wrangler.jsonc

// Test notification data - this simulates a new issue with multiple recipients
const testData = {
  type: 'new_issue',
  projectId: 'test-project',
  projectName: 'Test Project',
  issueId: 'test-issue-' + Date.now(),
  issueTitle: 'Test Email from Worker',
  issueContent: 'This is a test issue created to verify the email notification worker is functioning correctly.\n\nIf you received this email, the worker is working as expected!\n\nEach recipient now receives their own individual email to protect privacy.',
  recipients: [
    {
      email: primaryEmail,
      name: 'Project Owner'
    },
    {
      email: secondaryEmail,
      name: 'Thread Participant'
    },
    {
      email: thirdEmail,
      name: 'Another Participant'
    }
  ],
  userName: 'Test Script',
  createdAt: new Date().toISOString(),
  issueUrl: 'https://helpfromfounder.com/test-project/test-issue'
};

// Test data for a response notification to all thread participants
const responseTestData = {
  type: 'new_response',
  projectId: 'test-project',
  projectName: 'Test Project',
  issueId: 'test-issue-' + Date.now(),
  issueTitle: 'Test Thread for Response',
  responseContent: 'This is a test response to verify the multi-recipient email notifications are working correctly.\n\nIf you received this email, the worker is correctly handling private notifications to all thread participants!\n\nRecipients cannot see each other\'s email addresses now.',
  responseAuthor: 'Test Responder',
  recipients: [
    {
      email: primaryEmail,
      name: 'Project Owner'
    },
    {
      email: secondaryEmail, 
      name: 'Thread Participant'
    },
    {
      email: thirdEmail,
      name: 'Another Participant'
    }
  ],
  createdAt: new Date().toISOString(),
  issueUrl: 'https://helpfromfounder.com/test-project/test-issue'
};

// Choose which test to run (uncomment one)
// const data = JSON.stringify(testData);  // Test new issue notification
const data = JSON.stringify(responseTestData);  // Test response notification

console.log('PRIVACY UPDATE: Emails are now sent individually to each recipient to protect privacy');
console.log(`Sending test email to multiple recipients: ${primaryEmail}, ${secondaryEmail}, and ${thirdEmail}`);
console.log(`Worker URL: ${WORKER_URL}${ENDPOINT}`);
console.log('Request body:', JSON.stringify(JSON.parse(data), null, 2));

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
          console.log('\n✅ Test successful! Email sent to multiple recipients');
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