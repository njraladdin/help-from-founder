import { onValue, ref, onDisconnect, serverTimestamp, set } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';
import { rtdb, auth, db } from './firebase';

/**
 * Manages user presence (online/offline status) and last seen timestamps.
 * Uses Firebase Realtime Database for efficient real-time status tracking and
 * syncs the last activity timestamp to Firestore for persistence.
 */
export const initPresenceTracking = () => {
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in
      const uid = user.uid;
      
      // Create database references
      const userStatusRef = ref(rtdb, `/status/${uid}`);
      const connectedRef = ref(rtdb, '.info/connected');
      
      // When we lose or gain connection, update the status in RTDB
      onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
          // We're connected (or reconnected)!

          // Set up our online presence
          const onlineStatus = {
            state: 'online',
            lastActive: serverTimestamp()
          };
          
          // If we lose connection, update lastActive and change state to offline
          onDisconnect(userStatusRef)
            .update({
              state: 'offline',
              lastActive: serverTimestamp()
            })
            .then(() => {
              // Update our online status
              set(userStatusRef, onlineStatus);
              
              // Also update Firestore with the current timestamp for permanent storage
              updateLastSeen(uid);
            });
        }
      });
    }
  });
};

/**
 * Updates the lastSeen field in the user's Firestore document
 */
export const updateLastSeen = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      lastSeen: firestoreTimestamp()
    });
  } catch (error) {
    console.error('Error updating last seen timestamp:', error);
  }
};

/**
 * Get a reference to a user's status in the Realtime Database
 */
export const getUserStatusRef = (userId: string) => {
  return ref(rtdb, `/status/${userId}`);
};

/**
 * Format the relative time since last seen
 */
export const formatLastSeen = (timestamp: Date | null): string => {
  if (!timestamp) return 'Never';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
}; 