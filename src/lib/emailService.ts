/**
 * Email notification service
 * Handles sending email notifications using the email-notification worker
 */

import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const EMAIL_WORKER_URL = 'https://email-notification-worker.aladynjr.workers.dev';

// Base notification interface
interface BaseNotificationData {
  type: 'new_issue' | 'new_response';
  projectId: string;
  projectName: string;
  issueId: string;
  issueTitle: string;
  recipients: Array<{
    email: string;
    name?: string;
  }>;
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
 * Fetches all users who have participated in a thread (author and responders)
 * and returns their unique user IDs and emails if they are authenticated users
 * 
 * @param threadId ID of the thread
 * @param currentUserId ID of the current user (to exclude from notifications)
 * @returns Promise resolving to array of unique recipient objects with email and name
 */
export const getThreadParticipants = async (
  threadId: string,
  currentUserId: string | null
): Promise<Array<{email: string; name?: string}>> => {
  try {
    const recipients: Array<{email: string; name?: string; userId: string; timestamp?: Date}> = [];
    const processedUserIds = new Set<string>();
    
    // Get the thread data to find the author
    const threadDoc = await getDoc(doc(db, 'threads', threadId));
    if (!threadDoc.exists()) {
      console.error(`Thread ${threadId} not found`);
      return [];
    }
    
    const threadData = threadDoc.data();
    const threadTimestamp = threadData.createdAt?.toDate() || new Date(0);
    
    // Add thread author if they are an authenticated user
    if (threadData.authorId && threadData.authorId !== currentUserId) {
      processedUserIds.add(threadData.authorId);
      
      // Get user data
      const userDoc = await getDoc(doc(db, 'users', threadData.authorId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.email) {
          recipients.push({
            userId: threadData.authorId,
            email: userData.email,
            name: userData.displayName || 'Thread Author',
            timestamp: threadTimestamp
          });
        }
      }
    }
    
    // Add project owner if they're not the current user
    const projectDoc = await getDoc(doc(db, 'projects', threadData.projectId));
    if (projectDoc.exists()) {
      const projectData = projectDoc.data();
      if (projectData.ownerId && 
          projectData.ownerId !== currentUserId && 
          !processedUserIds.has(projectData.ownerId)) {
        
        processedUserIds.add(projectData.ownerId);
        
        // Get project owner data
        const ownerDoc = await getDoc(doc(db, 'users', projectData.ownerId));
        if (ownerDoc.exists()) {
          const ownerData = ownerDoc.data();
          if (ownerData.email) {
            recipients.push({
              userId: projectData.ownerId,
              email: ownerData.email,
              name: ownerData.displayName || 'Project Owner',
              timestamp: threadTimestamp // Give project owner same timestamp as thread creation
            });
          }
        }
      }
    }
    
    // Find all responses to this thread
    const responsesQuery = query(
      collection(db, 'responses'),
      where('threadId', '==', threadId)
    );
    
    const responsesSnapshot = await getDocs(responsesQuery);
    
    // Create an array of responses with their timestamps
    const responses = responsesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        authorId: data.authorId,
        timestamp: data.createdAt?.toDate() || new Date(0)
      };
    });
    
    // Sort responses by timestamp (newest first)
    responses.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Process each response (taking only the 5 most recent ones)
    for (const response of responses.slice(0, 5)) {
      // Skip responses from the current user or already processed users
      if (response.authorId && 
          response.authorId !== currentUserId && 
          !processedUserIds.has(response.authorId)) {
        
        processedUserIds.add(response.authorId);
        
        // Get user data
        const userDoc = await getDoc(doc(db, 'users', response.authorId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.email) {
            recipients.push({
              userId: response.authorId,
              email: userData.email,
              name: userData.displayName || 'Thread Participant',
              timestamp: response.timestamp
            });
          }
        }
      }
    }
    
    // Sort recipients by timestamp (newest first) and take only the 5 most recent
    recipients.sort((a, b) => {
      const aTime = a.timestamp?.getTime() || 0;
      const bTime = b.timestamp?.getTime() || 0;
      return bTime - aTime;
    });
    
    const limitedRecipients = recipients.slice(0, 5);
    
    // Remove the userId and timestamp properties before returning
    return limitedRecipients.map(({ email, name }) => ({ email, name }));
  } catch (error) {
    console.error('Error fetching thread participants:', error);
    return [];
  }
};

/**
 * Send email notification when a new issue is created or a response is added
 * 
 * @param data Notification data 
 * @returns Promise that resolves with the response
 */
export const sendNewIssueNotification = async (data: NotificationData): Promise<{success: boolean; message: string}> => {
  try {
    // Don't send if there are no recipients
    if (!data.recipients || data.recipients.length === 0) {
      return { 
        success: false, 
        message: 'No recipients specified for notification' 
      };
    }
    
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