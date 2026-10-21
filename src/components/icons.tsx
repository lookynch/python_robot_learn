const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

export const PathIcon = () => (
  <svg {...base}>
    <path d="M5 20 L10 13 L15 10 L19 4" />
    <circle cx="5" cy="20" r="1.8" />
    <circle cx="10" cy="13" r="1.6" />
    <circle cx="19" cy="4" r="1.6" />
  </svg>
);
export const ReviewIcon = () => (
  <svg {...base}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
    <path d="M12 8v4l3 2" />
  </svg>
);
export const PlayIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9l3 3-3 3" />
    <path d="M12 15h5" />
  </svg>
);
export const ProfileIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const BackIcon = () => (
  <svg {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const AiIcon = () => (
  <svg {...base}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);
