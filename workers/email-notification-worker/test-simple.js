#!/usr/bin/env node

/**
 * Ultra-simple test script using fetch API
 * Run with: node test-simple.js
 */

// Specific recipient email - configured to send to aladynjr@gmail.com
const email = 'aladynjr@gmail.com';

// Test data with timestamp to make each test unique
const testData = {
  projectId: "test-project",
  projectName: "Test Project",
  issueId: `test-issue-${Date.now()}`,
  issueTitle: "Test Email via Fetch API",
  issueContent: "This is a test message from the test-simple.js script. If you can read this, the worker is successfully sending emails!",
  founderEmail: email,
  userName: "Simple Test Script",
  createdAt: new Date().toISOString(),
  issueUrl: "https://helpfromfounder.com/test-project/test-issue"
};

console.log(`Sending test email to: ${email}`);
console.log('Test data:', JSON.stringify(testData, null, 2));

// Use the fetch API to send request to the worker
fetch('https://email-notification-worker.aladynjr.workers.dev/api/send-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData),
})
.then(response => {
  console.log(`Response status: ${response.status} ${response.statusText}`);
  
  // Try to parse JSON response
  return response.text().then(text => {
    if (!text) {
      console.log('Empty response received');
      return null;
    }
    
    console.log('Raw response:', text);
    
    try {
      // Try to parse as JSON if it looks like JSON
      if (text.trim()[0] === '{') {
        return JSON.parse(text);
      } else {
        return text;
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      return text;
    }
  });
})
.then(data => {
  if (data && typeof data === 'object' && data.success) {
    console.log('\n✅ SUCCESS! Email sent to', email);
  } else {
    console.log('\n❌ FAILED to send email. See response above.');
  }
})
.catch(error => {
  console.error('Request error:', error);
}); 