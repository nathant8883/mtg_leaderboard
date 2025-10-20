import React from 'react';

interface PlayerAvatarProps {
  playerName: string;
  customAvatar?: string | null;
  picture?: string | null;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * PlayerAvatar component with fallback logic:
 * 1. Custom avatar (uploaded by user) - highest priority
 * 2. Google profile picture - fallback
 * 3. First letter of name - final fallback
 */
const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  playerName,
  customAvatar,
  picture,
  size = 'medium',
  className = '',
}) => {
  // Determine which avatar to use
  const avatarSrc = customAvatar || picture;

  // Size classes
  const sizeClasses = {
    small: 'w-10 h-10 text-lg',
    medium: 'w-12 h-12 text-xl',
    large: 'w-20 h-20 text-[32px]',
  };

  const sizeClass = sizeClasses[size] || sizeClasses.medium;

  // Base classes for the avatar container
  const baseClasses = `${sizeClass} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`;

  if (avatarSrc) {
    // Show image avatar
    return (
      <div className={`${baseClasses} bg-gradient-purple border-2 border-[#2C2E33]`}>
        <img
          src={avatarSrc}
          alt={`${playerName}'s avatar`}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback to first letter
  const firstLetter = playerName.charAt(0).toUpperCase();

  return (
    <div className={`${baseClasses} bg-gradient-purple text-white font-bold`}>
      {firstLetter}
    </div>
  );
};

export default PlayerAvatar;
