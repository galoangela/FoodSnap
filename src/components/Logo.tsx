import { useState } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

export function Logo({ size = 'md', showWordmark = true }: LogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const iconSizes = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-14 h-14 rounded-2xl',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <div
        className={`${iconSizes[size]} overflow-hidden border border-[#E6DFD3] bg-[#FFF5EC] flex items-center justify-center shrink-0`}
      >
        {!imgFailed ? (
          <img
            src="/src/assets/images/foodsnap_logo_emblem_1795192226770.jpg"
            alt="FoodSnap logo emblem"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            viewBox="0 0 36 36"
            className="w-6 h-6"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="5"
              y="5"
              width="26"
              height="26"
              rx="7"
              stroke="#5A6558"
              strokeWidth="2"
            />
            <circle cx="21" cy="18" r="6" fill="#F58A4B" />
            <path
              d="M11 23C11 16 15 12 20 12C20 17 16 22 11 23Z"
              fill="#6BBF7B"
            />
          </svg>
        )}
      </div>
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight text-[#1E241E] ${textSizes[size]}`}
        >
          Food<span className="text-[#D95D24]">Snap</span>
        </span>
      )}
    </div>
  );
}
