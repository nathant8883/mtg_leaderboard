import React from 'react';

interface PodAvatarProps {
  podName: string;
  customImage?: string | null;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * PodAvatar component with fallback logic:
 * 1. Custom pod image (uploaded by pod admin) - highest priority
 * 2. Pod Pal logo - default fallback
 */
const PodAvatar: React.FC<PodAvatarProps> = ({
  podName,
  customImage,
  size = 'medium',
  className = '',
}) => {
  // Determine which image to use
  const imageSrc = customImage || '/logo.png';

  // Size classes
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-12 h-12',
    large: 'w-20 h-20',
  };

  const sizeClass = sizeClasses[size] || sizeClasses.medium;

  // Base classes for the avatar container
  const baseClasses = `${sizeClass} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`;

  return (
    <div className={`${baseClasses} bg-gradient-purple border-2 border-[#2C2E33]`}>
      <img
        src={imageSrc}
        alt={`${podName}'s image`}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default PodAvatar;
