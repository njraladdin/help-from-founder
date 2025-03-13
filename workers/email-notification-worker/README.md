# Email Notification Worker

This Cloudflare Worker handles sending email notifications to project founders when new issues or questions are submitted.

## Features

- Sends notification emails using SendPulse API
- Configurable email templates
- CORS support for cross-origin requests

## Setup

1. Create a SendPulse account if you don't have one
2. Obtain your API credentials from the SendPulse dashboard
3. Install Wrangler CLI: `npm install -g wrangler`
4. Login to Cloudflare: `wrangler login`

## Configuration

### Environment Variables

The worker uses the following environment variables:

- `SEND_EMAIL_PATH`: API endpoint path for sending emails (default: `/api/send-email`)

### Setting Up Secrets

The worker requires two secrets to be set up for SendPulse authentication:

1. **Create a SendPulse Account and Get API Credentials**:
   - Log in to your SendPulse dashboard
   - Navigate to "Settings" > "API"
   - Create a new REST API key if you don't have one
   - Copy both the User ID and Secret Key

2. **Set up the secrets using Wrangler CLI**:
   ```bash
   # Navigate to your worker directory
   cd workers/email-notification-worker
   
   # Set the SENDPULSE_API_USER_ID secret
   npx wrangler secret put SENDPULSE_API_USER_ID --name email-notification-worker
   # When prompted, enter your SendPulse User ID
   
   # Set the SENDPULSE_API_SECRET secret
   npx wrangler secret put SENDPULSE_API_SECRET --name email-notification-worker
   # When prompted, enter your SendPulse Secret Key
   ```

## Deployment

1. Install dependencies: `npm install`
2. Deploy the worker: `npx wrangler deploy`
3. After deployment, update your frontend `.env` file with the worker URL:
   ```
   VITE_EMAIL_WORKER_URL=https://email-notification-worker.your-subdomain.workers.dev
   ```

## Local Development

1. Run the worker locally: `npx wrangler dev`
2. The worker will be available at `http://localhost:8787`

## API Endpoints

### Health Check

```
GET /
```

Response:
```json
{
  "status": "ok",
  "message": "Email notification worker is running"
}
```

### Send Email Notification

```
POST /api/send-email
```

Request body:
```json
{
  "projectId": "project-id",
  "projectName": "Project Name",
  "issueId": "issue-id",
  "issueTitle": "Issue Title",
  "issueContent": "Issue Content",
  "founderEmail": "founder@example.com"
}
```

Response:
```json
{
  "success": true,
  "message": "Email notification sent successfully"
}
```

## Troubleshooting

### Authentication Issues
If you see authentication errors when trying to send emails:

1. Make sure you've set up the secrets correctly using `wrangler secret put`
2. Verify that your SendPulse API credentials are valid and have not expired
3. Check that you're using the correct User ID and Secret Key from the SendPulse dashboard 