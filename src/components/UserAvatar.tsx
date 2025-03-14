import React from 'react';

interface UserAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Function to generate consistent colors from strings (Apple-like)
const stringToColor = (str: string): string => {
  const colors = [
    '#FF2D55', // Pink
    '#5856D6', // Purple
    '#007AFF', // Blue
    '#34C759', // Green
    '#FF9500', // Orange
    '#AF52DE', // Purple
    '#5AC8FA', // Light Blue
    '#FF3B30', // Red
    '#4CD964', // Green
    '#FFCC00', // Yellow
  ];
  
  // Simple hash function to get a consistent index
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to pick a color
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const UserAvatar: React.FC<UserAvatarProps> = ({ name, size = 'md', className = '' }) => {
  // Safely handle empty names
  const displayName = name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const backgroundColor = stringToColor(displayName);
  
  // Determine size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };
  
  return (
    <div 
      className={`rounded-full flex items-center justify-center text-white font-medium overflow-hidden ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor }}
    >
      {initial}
    </div>
  );
};

export default UserAvatar; 