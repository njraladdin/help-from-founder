// Define notification types
export type NotificationType = 'new_issue' | 'new_response';

// Base notification request interface
export interface BaseNotificationRequest {
  type: NotificationType;
  projectId: string;
  projectName: string;
  issueId: string;
  issueTitle: string;
  founderEmail: string;
  userName?: string; // Optional submitter name
  createdAt?: string; // Optional timestamp
  issueUrl?: string; // Optional URL to the issue
}

// Email notification request interface for new issues
export interface IssueNotificationRequest extends BaseNotificationRequest {
  type: 'new_issue';
  issueContent: string;
}

// Email notification request interface for responses
export interface ResponseNotificationRequest extends BaseNotificationRequest {
  type: 'new_response';
  responseContent: string;
  responseAuthor: string;
}

// Union type for all notification types
export type EmailNotificationRequest = IssueNotificationRequest | ResponseNotificationRequest;

/**
 * Creates an HTML email template based on notification type
 * 
 * @param notification The notification data
 * @returns HTML string for the email
 */
export function createHtmlTemplate(notification: EmailNotificationRequest): string {
  switch (notification.type) {
    case 'new_issue':
      return createIssueNotificationTemplate(notification);
    case 'new_response':
      return createResponseNotificationTemplate(notification);
    default:
      // This should never happen due to TypeScript's exhaustive checking
      throw new Error(`Unknown notification type: ${notification.type}`);
  }
}

/**
 * Creates a plain text email template based on notification type
 * 
 * @param notification The notification data
 * @returns Plain text string for the email
 */
export function createPlainTextTemplate(notification: EmailNotificationRequest): string {
  switch (notification.type) {
    case 'new_issue':
      return createIssueTextTemplate(notification);
    case 'new_response':
      return createResponseTextTemplate(notification);
    default:
      // This should never happen due to TypeScript's exhaustive checking
      throw new Error(`Unknown notification type: ${notification.type}`);
  }
}

/**
 * Creates an HTML email template for issue notifications
 * 
 * @param notification The notification data
 * @returns HTML string for the email
 */
function createIssueNotificationTemplate(notification: IssueNotificationRequest): string {
  const date = notification.createdAt 
    ? new Date(notification.createdAt).toLocaleString() 
    : new Date().toLocaleString();
  
  const userName = notification.userName || 'Anonymous user';
  const issueLink = notification.issueUrl 
    ? `<p><a href="${notification.issueUrl}" style="color: #3b82f6; text-decoration: underline;">View Issue</a></p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Issue on ${notification.projectName}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #3b82f6; color: white; padding: 10px 20px; border-radius: 4px 4px 0 0; }
        .content { border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 4px 4px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        pre { background: #f7f7f7; padding: 10px; border-radius: 4px; overflow: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Issue: ${notification.issueTitle}</h2>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>A new issue has been submitted to your project <strong>${notification.projectName}</strong> by ${userName} on ${date}.</p>
          
          <h3>Issue Details:</h3>
          <p><strong>Title:</strong> ${notification.issueTitle}</p>
          <p><strong>Content:</strong></p>
          <pre>${notification.issueContent}</pre>
          
          ${issueLink}
          
          <p>Thank you for using Help From Founder!</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Creates an HTML email template for response notifications
 * 
 * @param notification The notification data
 * @returns HTML string for the email
 */
function createResponseNotificationTemplate(notification: ResponseNotificationRequest): string {
  const date = notification.createdAt 
    ? new Date(notification.createdAt).toLocaleString() 
    : new Date().toLocaleString();
  
  const issueLink = notification.issueUrl 
    ? `<p><a href="${notification.issueUrl}" style="color: #3b82f6; text-decoration: underline;">View Response</a></p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Response on ${notification.issueTitle}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #3b82f6; color: white; padding: 10px 20px; border-radius: 4px 4px 0 0; }
        .content { border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 4px 4px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        pre { background: #f7f7f7; padding: 10px; border-radius: 4px; overflow: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Response on Issue: ${notification.issueTitle}</h2>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>A new response has been posted to an issue in your project <strong>${notification.projectName}</strong> by ${notification.responseAuthor} on ${date}.</p>
          
          <h3>Response Details:</h3>
          <p><strong>Issue:</strong> ${notification.issueTitle}</p>
          <p><strong>Response:</strong></p>
          <pre>${notification.responseContent}</pre>
          
          ${issueLink}
          
          <p>Thank you for using Help From Founder!</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Creates a plain text version of the issue email for clients that don't support HTML
 * 
 * @param notification The notification data
 * @returns Plain text string for the email
 */
function createIssueTextTemplate(notification: IssueNotificationRequest): string {
  const date = notification.createdAt 
    ? new Date(notification.createdAt).toLocaleString() 
    : new Date().toLocaleString();
  
  const userName = notification.userName || 'Anonymous user';
  
  return `
New Issue: ${notification.issueTitle}

Hello,

A new issue has been submitted to your project "${notification.projectName}" by ${userName} on ${date}.

Issue Details:
Title: ${notification.issueTitle}
Content: 
${notification.issueContent}

${notification.issueUrl ? `View Issue: ${notification.issueUrl}` : ''}

Thank you for using Help From Founder!

---
This is an automated message. Please do not reply to this email.
  `;
}

/**
 * Creates a plain text version of the response email for clients that don't support HTML
 * 
 * @param notification The notification data
 * @returns Plain text string for the email
 */
function createResponseTextTemplate(notification: ResponseNotificationRequest): string {
  const date = notification.createdAt 
    ? new Date(notification.createdAt).toLocaleString() 
    : new Date().toLocaleString();
  
  return `
New Response on Issue: ${notification.issueTitle}

Hello,

A new response has been posted to an issue in your project "${notification.projectName}" by ${notification.responseAuthor} on ${date}.

Response Details:
Issue: ${notification.issueTitle}
Response: 
${notification.responseContent}

${notification.issueUrl ? `View Response: ${notification.issueUrl}` : ''}

Thank you for using Help From Founder!

---
This is an automated message. Please do not reply to this email.
  `;
} 