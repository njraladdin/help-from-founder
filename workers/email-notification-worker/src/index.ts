/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
// Import email templates
import { 
	EmailNotificationRequest,
	createHtmlTemplate, 
	createPlainTextTemplate 
} from './email-templates';
// Import SendGrid client instead of SendPulse
import { 
	EmailOptions, 
	sendEmail 
} from './sendgrid-client';

// Define environment interface
export interface Env {
	// Environment variables
	SEND_EMAIL_PATH: string;
	// SendGrid API key (set using wrangler)
	SENDGRID_API_KEY?: string;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors({
	origin: '*', // Update with actual allowed origins in production
	allowMethods: ['POST', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
	maxAge: 86400, // 24 hours
}));

// Health check endpoint
app.get('/', (c) => {
	return c.json({
		status: 'ok',
		message: 'Email notification worker is running'
	});
});

// For debugging: Route that shows all registered routes
app.get('/debug/routes', (c) => {
	// Get the environment variables
	const vars = {
		SEND_EMAIL_PATH: c.env.SEND_EMAIL_PATH
	};
  
	return c.json({
		message: 'These are the registered routes for this worker',
		routes: app.routes,
		vars
	});
});

// Email sending endpoint - Fixed with a static route
app.post('/api/send-email', async (c) => {
	try {
		// Validate API credentials
		if (!c.env.SENDGRID_API_KEY) {
			throw new Error('SendGrid API key not configured');
		}

		// Parse request body
		const data = await c.req.json();
		
		// Validate type field exists
		if (!data.type) {
			return c.json({
				success: false,
				message: 'Missing required field: type'
			}, 400);
		}
		
		// Validate type is valid
		if (data.type !== 'new_issue' && data.type !== 'new_response') {
			return c.json({
				success: false,
				message: `Invalid notification type: ${data.type}`
			}, 400);
		}
		
		// Cast to the correct type
		const notification = data as EmailNotificationRequest;
		
		// Validate required fields based on notification type
		const baseRequiredFields = ['projectId', 'projectName', 'issueId', 'issueTitle', 'recipients'];
		
		// Check base required fields
		for (const field of baseRequiredFields) {
			if (!notification[field as keyof typeof notification]) {
				return c.json({
					success: false,
					message: `Missing required field: ${field}`
				}, 400);
			}
		}
		
		// Validate recipients array
		if (!Array.isArray(notification.recipients) || notification.recipients.length === 0) {
			return c.json({
				success: false,
				message: 'Recipients must be a non-empty array'
			}, 400);
		}
		
		// Validate recipient emails
		for (const recipient of notification.recipients) {
			if (!recipient.email) {
				return c.json({
					success: false,
					message: 'Each recipient must have an email address'
				}, 400);
			}
		}
		
		// Check type-specific required fields
		if (notification.type === 'new_issue') {
			if (!notification.issueContent) {
				return c.json({
					success: false,
					message: 'Missing required field: issueContent'
				}, 400);
			}
		} else if (notification.type === 'new_response') {
			if (!notification.responseContent || !notification.responseAuthor) {
				return c.json({
					success: false,
					message: 'Missing required fields for response notification'
				}, 400);
			}
		}

		// Create email subject based on notification type
		let subject = '';
		if (notification.type === 'new_issue') {
			subject = `New Issue: ${notification.issueTitle} - ${notification.projectName}`;
		} else if (notification.type === 'new_response') {
			subject = `New Response on Issue: ${notification.issueTitle} - ${notification.projectName}`;
		}
		
		// Create HTML and text content once
		const htmlContent = createHtmlTemplate(notification);
		const textContent = createPlainTextTemplate(notification);
		
		// Track any errors
		const errors: Array<{recipient: string; error: string}> = [];
		
		// Send individual emails to each recipient to preserve privacy
		const emailPromises = notification.recipients.map(async (recipient) => {
			try {
				// Create individual email options for this recipient
				const emailOptions: EmailOptions = {
					html: htmlContent,
					text: textContent,
					subject: subject,
					from: {
						name: "Help From Founder",
						email: "contact@helpfromfounder.space"
					},
					to: [{
						name: recipient.name || "User",
						email: recipient.email
					}]
				};
				
				// Send the email using SendGrid
				await sendEmail(
					c.env.SENDGRID_API_KEY as string,
					emailOptions
				);
				
				return { success: true, recipient: recipient.email };
			} catch (error) {
				// Record error but don't throw
				const errorMessage = error instanceof Error 
					? error.message || 'Unknown error' 
					: String(error);
				errors.push({ recipient: recipient.email, error: errorMessage });
				return { success: false, recipient: recipient.email, error: errorMessage };
			}
		});
		
		// Wait for all emails to be sent
		const results = await Promise.all(emailPromises);
		const successCount = results.filter(r => r.success).length;
		
		// If all emails were sent successfully
		if (successCount === notification.recipients.length) {
			return c.json({
				success: true,
				message: `Email notifications sent successfully to ${successCount} recipients`
			});
		}
		
		// If some emails failed
		return c.json({
			success: successCount > 0,
			message: `Sent ${successCount} of ${notification.recipients.length} notifications`,
			errors: errors
		}, errors.length === notification.recipients.length ? 500 : 207);
		
	} catch (error) {
		console.error('Error sending email:', error);
		return c.json({
			success: false,
			message: 'Failed to send email notification',
			error: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// Also add the dynamic route that uses the environment variable for backward compatibility
app.post(({ env }) => env.SEND_EMAIL_PATH, async (c) => {
	console.log('Dynamic route called:', c.env.SEND_EMAIL_PATH);
	// Forward to the static route handler
	return app.fetch(new Request(new URL('/api/send-email', c.req.url), c.req), c.env, c.executionCtx);
});

// Export the Cloudflare Worker
export default app;
