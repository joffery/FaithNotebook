type ProfileAvatarProps = {
  displayName?: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
};

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
};

const getInitials = (displayName?: string | null) => {
  const cleaned = displayName?.trim();
  if (!cleaned) return '?';

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

export function ProfileAvatar({ displayName, avatarUrl, size = 'sm' }: ProfileAvatarProps) {
  const initials = getInitials(displayName);

  if (avatarUrl?.trim()) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || 'Profile photo'}
        className={`${sizeClasses[size]} rounded-full object-cover border border-[#c49a5c]/20 bg-white`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border border-[#c49a5c]/20 bg-[#c49a5c]/12 text-[#8c6430] flex items-center justify-center font-semibold`}
      aria-label={displayName || 'Profile'}
    >
      {initials}
    </div>
  );
}
