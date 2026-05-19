interface AvatarImageProps {
  src?: string | null;
  initials: string;
  color: string;
  alt?: string;
  className?: string;
  onImageError?: () => void;
}

export default function AvatarImage({
  src,
  initials,
  color,
  alt = '',
  className = 'w-9 h-9',
  onImageError,
}: AvatarImageProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${className} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          if (onImageError) onImageError();
          // On image error, fallback to initials
          (e.target as HTMLImageElement).style.display = 'none';
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = `${className} flex-shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white`;
            fallback.style.backgroundColor = color;
            fallback.textContent = initials;
            parent.appendChild(fallback);
          }
        }}
      />
    );
  }

  return (
    <div
      className={`${className} flex-shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}