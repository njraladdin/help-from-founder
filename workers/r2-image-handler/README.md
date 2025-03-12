# R2 Image Handler Worker

This Cloudflare Worker handles image uploads and serving for project logos.

## Features

- Generate pre-signed URLs for secure image uploads
- Direct image upload through the worker
- Serve images from Cloudflare R2 storage
- CORS support for cross-origin requests

## Setup

1. Create a Cloudflare account if you don't have one
2. Create an R2 bucket named `helpfromfounder-bucket` in your Cloudflare dashboard
3. Install Wrangler CLI: `npm install -g wrangler`
4. Login to Cloudflare: `wrangler login`

## Configuration

### Environment Variables

The worker uses the following environment variables:

- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS
- `ACCOUNT_ID`: Your Cloudflare account ID

### Setting Up Secrets

The worker requires two secrets to be set up for R2 authentication:

1. **Find your Cloudflare Account ID**:
   - Log in to your Cloudflare dashboard
   - Your Account ID is in the URL: `https://dash.cloudflare.com/{account-id}`
   - Or go to Account Home to see it displayed

2. **Generate R2 API Tokens**:
   - Go to the R2 section in your Cloudflare dashboard
   - Click on "Manage R2 API Tokens"
   - Create a new API token with "Object Read & Write" permissions
   - Save both the Access Key ID and Secret Access Key

3. **Set up the secrets using Wrangler CLI**:
   ```bash
   # Navigate to your worker directory
   cd workers/r2-image-handler
   
   # Set the ACCESS_KEY_ID secret
   npx wrangler secret put ACCESS_KEY_ID --name r2-image-handler
   # When prompted, enter your R2 Access Key ID
   
   # Set the SECRET_ACCESS_KEY secret
   npx wrangler secret put SECRET_ACCESS_KEY --name r2-image-handler
   # When prompted, enter your R2 Secret Access Key
   ```

4. **Update wrangler.jsonc**:
   - Make sure your `wrangler.jsonc` file has the correct Account ID:
   ```json
   "vars": {
     "ALLOWED_ORIGINS": "http://localhost:5173,https://your-domain.com",
     "ACCOUNT_ID": "your-cloudflare-account-id"
   }
   ```

## Deployment

1. Install dependencies: `npm install`
2. Deploy the worker: `npx wrangler deploy`
3. After deployment, update your frontend `.env` file with the worker URL:
   ```
   VITE_WORKER_URL=https://r2-image-handler.your-subdomain.workers.dev
   ```

## Local Development

1. Run the worker locally: `npm run start`
2. The worker will be available at `http://localhost:8787`

## API Endpoints

### Generate Upload URL (Legacy)

```
POST /api/images/upload-url
```

Request body:
```json
{
  "fileType": "image/png"
}
```

Response:
```json
{
  "success": true,
  "uploadUrl": "https://...",
  "key": "unique-file-key.png"
}
```

### Direct Upload (Recommended)

```
POST /api/images/upload
```

Request body (multipart/form-data):
```
file: [binary image data]
```

Response:
```json
{
  "success": true,
  "key": "unique-file-key.png"
}
```

### Serve Image

```
GET /api/images/:key
```

Returns the image file with appropriate caching headers.

## Troubleshooting

### CORS Issues
If you encounter CORS issues when using the presigned URL approach, consider:

1. Using the direct upload endpoint (`/api/images/upload`) instead
2. Configuring CORS in your R2 bucket settings with the following policy:
```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### Authentication Issues
If you see "Resolved credential object is not valid" errors:

1. Make sure you've set up the secrets correctly using `wrangler secret put`
2. Verify that your R2 API tokens have the correct permissions
3. Check that your Account ID is correct in the wrangler.jsonc file
