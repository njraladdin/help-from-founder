import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import DataTransferNotification from './DataTransferNotification';

// Event name for data transfer notification
const DATA_TRANSFER_EVENT = 'dataTransferred';

const Layout = () => {
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    // Create a function to handle the custom event
    const handleDataTransfer = (event: CustomEvent) => {
      setNotification(event.detail.message || 'Your data has been transferred successfully');
    };

    // Add event listener for data transfer events
    window.addEventListener(DATA_TRANSFER_EVENT, handleDataTransfer as EventListener);

    // Clean up the event listener
    return () => {
      window.removeEventListener(DATA_TRANSFER_EVENT, handleDataTransfer as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <Footer />
      
      {notification && (
        <DataTransferNotification 
          message={notification} 
          onClose={() => setNotification(null)} 
        />
      )}
    </div>
  );
};

export default Layout; 