/**
 * Utilities for transferring anonymous user data to authenticated users
 */
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { getAnonymousUserId, clearAnonymousUserData } from './userUtils';

/**
 * Transfers all data (threads and responses) from an anonymous user to an authenticated user
 * 
 * @param userId The authenticated user's ID
 * @returns Promise that resolves when the transfer is complete
 */
export const transferAnonymousUserData = async (userId: string): Promise<{success: boolean; message: string}> => {
  try {
    const anonymousId = getAnonymousUserId();
    
    // If no anonymous ID exists, nothing to transfer
    if (!anonymousId) {
      return { success: true, message: 'No anonymous data to transfer' };
    }
    
    const batch = writeBatch(db);
    let transferCount = 0;
    
    // Transfer threads
    const threadsQuery = query(
      collection(db, 'threads'),
      where('anonymousId', '==', anonymousId)
    );
    
    const threadsSnapshot = await getDocs(threadsQuery);
    
    threadsSnapshot.forEach(threadDoc => {
      const threadRef = doc(db, 'threads', threadDoc.id);
      batch.update(threadRef, {
        authorId: userId,
        anonymousId: null // Remove anonymous ID
      });
      transferCount++;
    });
    
    // Transfer responses
    const responsesQuery = query(
      collection(db, 'responses'),
      where('anonymousId', '==', anonymousId)
    );
    
    const responsesSnapshot = await getDocs(responsesQuery);
    
    responsesSnapshot.forEach(responseDoc => {
      const responseRef = doc(db, 'responses', responseDoc.id);
      batch.update(responseRef, {
        authorId: userId,
        anonymousId: null // Remove anonymous ID
      });
      transferCount++;
    });
    
    // If no data to transfer
    if (transferCount === 0) {
      return { success: true, message: 'No anonymous data found to transfer' };
    }
    
    // Commit the batch update
    await batch.commit();
    
    // Clear anonymous user data from localStorage
    clearAnonymousUserData();
    
    // Dispatch an event to notify the UI about the successful transfer
    if (transferCount > 0) {
      const event = new CustomEvent('dataTransferred', {
        detail: {
          success: true,
          message: `Successfully transferred ${transferCount} items to your account`
        }
      });
      window.dispatchEvent(event);
    }
    
    return { 
      success: true, 
      message: `Successfully transferred ${transferCount} items to your account` 
    };
  } catch (error) {
    console.error('Error transferring anonymous user data:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error during data transfer' 
    };
  }
}; 