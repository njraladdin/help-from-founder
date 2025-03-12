interface ProjectAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  imageUrl?: string;
}

const ProjectAvatar = ({ name, size = 'md', imageUrl }: ProjectAvatarProps) => {
  // Get the first two letters of the name
  const getFirstTwoLetters = (name: string) => {
    return name.trim().substring(0, 2).toUpperCase();
  };

  // Generate a deterministic background color based on project name
  const getBackgroundColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    
    // Use the string to generate a deterministic index
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Determine size class
  const sizeClass = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl'
  }[size];

  // If we have an image URL, display the image
  if (imageUrl) {
    return (
      <img 
        src={imageUrl} 
        alt={name} 
        className={`${sizeClass} rounded-full object-cover`}
        title={name}
      />
    );
  }

  // Otherwise, display the fallback avatar with initials
  return (
    <div 
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-medium ${getBackgroundColor(name)}`}
      title={name}
    >
      {getFirstTwoLetters(name)}
    </div>
  );
};

export default ProjectAvatar; 