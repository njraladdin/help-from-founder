import { useState, useEffect } from 'react';
import { onValue } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getUserStatusRef, formatLastSeen } from '../lib/presenceService';

interface FounderPresenceIndicatorProps {
  userId: string;
}

const FounderPresenceIndicator = ({ userId }: FounderPresenceIndicatorProps) => {
  const [onlineStatus, setOnlineStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [lastActive, setLastActive] = useState<Date | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Set up listener for real-time status
    const statusRef = getUserStatusRef(userId);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setOnlineStatus(data.state || 'offline');
        if (data.lastActive) {
          setLastActive(new Date(data.lastActive));
        }
      } else {
        // If no real-time data exists, fall back to Firestore lastSeen
        const fetchLastSeen = async () => {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData.lastSeen) {
                setLastActive(userData.lastSeen.toDate());
                setOnlineStatus('offline');
              }
            }
          } catch (error) {
            console.error('Error fetching lastSeen:', error);
          }
        };
        
        fetchLastSeen();
      }
    });

    // Clean up listener on unmount
    return () => unsubscribe();
  }, [userId]);

  if (onlineStatus === 'unknown') {
    return null; // Don't show anything if we don't have status yet
  }

  return (
    <div className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100">
      {onlineStatus === 'online' ? (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
          <span className="text-xs text-green-600 font-light">Online</span>
        </>
      ) : (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 mr-1.5"></span>
          <span className="text-xs text-gray-500 font-light">
            {lastActive ? formatLastSeen(lastActive) : 'Unknown'}
          </span>
        </>
      )}
    </div>
  );
};

export default FounderPresenceIndicator; 