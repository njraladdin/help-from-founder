/**
 * Email notification service
 * Handles sending email notifications using the email-notification worker
 */

const EMAIL_WORKER_URL = 'https://email-notification-worker.aladynjr.workers.dev';

// Base notification interface
interface BaseNotificationData {
  type: 'new_issue' | 'new_response';
  projectId: string;
  projectName: string;
  issueId: string;
  issueTitle: string;
  founderEmail: string;
  userName?: string;
  createdAt?: string;
  issueUrl?: string;
}

// Issue notification interface
interface IssueNotificationData extends BaseNotificationData {
  type: 'new_issue';
  issueContent: string;
}

// Response notification interface
interface ResponseNotificationData extends BaseNotificationData {
  type: 'new_response';
  responseContent: string;
  responseAuthor: string;
}

// Union type for all notification types
export type NotificationData = IssueNotificationData | ResponseNotificationData;

/**
 * Send email notification when a new issue is created
 * 
 * @param data Notification data 
 * @returns Promise that resolves with the response
 */
export const sendNewIssueNotification = async (data: NotificationData): Promise<{success: boolean; message: string}> => {
  try {
    const response = await fetch(`${EMAIL_WORKER_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Error sending email notification:', result);
      return { 
        success: false, 
        message: result.message || 'Failed to send email notification' 
      };
    }
    
    return {
      success: true,
      message: 'Email notification sent successfully'
    };
  } catch (error) {
    console.error('Error sending email notification:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error sending notification'
    };
  }
}; 