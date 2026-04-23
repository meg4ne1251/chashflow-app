import type { CSSProperties } from 'react';

/**
 * Monoline icon set used by the new design system.
 * Ported from new_UI/icons.jsx.
 */
export type IconName =
  | 'dashboard'
  | 'list'
  | 'swap'
  | 'tag'
  | 'card'
  | 'folder'
  | 'bookmark'
  | 'repeat'
  | 'chart'
  | 'wallet'
  | 'piggy'
  | 'settings'
  | 'bell'
  | 'search'
  | 'plus'
  | 'filter'
  | 'calendar'
  | 'chev-r'
  | 'chev-l'
  | 'chev-d'
  | 'chev-u'
  | 'edit'
  | 'trash'
  | 'more'
  | 'arrow-up-r'
  | 'arrow-dn-r'
  | 'camera'
  | 'mic'
  | 'yen'
  | 'check'
  | 'x'
  | 'menu'
  | 'target'
  | 'sparkle'
  | 'trend-up'
  | 'trend-dn'
  | 'receipt'
  | 'clock'
  | 'coffee'
  | 'shopping'
  | 'bus'
  | 'home'
  | 'film'
  | 'bank'
  | 'cash'
  | 'watch'
  | 'plane'
  | 'command'
  | 'logout'
  | 'user'
  | 'sun'
  | 'moon'
  | 'auto';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
  'aria-hidden'?: boolean;
}

export function Icon({
  name,
  size = 16,
  stroke = 1.6,
  className,
  style,
  title,
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
    role: title ? 'img' : undefined,
    'aria-hidden': title ? undefined : ariaHidden,
    'aria-label': title,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case 'list':
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="4" cy="6" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="18" r="1" />
        </svg>
      );
    case 'swap':
      return (
        <svg {...props}>
          <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
        </svg>
      );
    case 'tag':
      return (
        <svg {...props}>
          <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <circle cx="7" cy="7" r="1.5" />
        </svg>
      );
    case 'card':
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M6 15h4" />
        </svg>
      );
    case 'folder':
      return (
        <svg {...props}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case 'bookmark':
      return (
        <svg {...props}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'repeat':
      return (
        <svg {...props}>
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 4 4 5-7" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...props}>
          <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <circle cx="16" cy="13.5" r="1.2" />
        </svg>
      );
    case 'piggy':
      return (
        <svg {...props}>
          <path d="M19 9c1.5 0 2 1 2 2v3c0 1-1 2-2 2l-1 .5L17 18h-2l-.5-1.5h-5L9 18H7l-1-1.5C4 16 3 14 3 12s2-5 6-5h6c2 0 4 1 4 2zM7 10v.01" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...props}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...props}>
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case 'chev-r':
      return (
        <svg {...props}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case 'chev-l':
      return (
        <svg {...props}>
          <path d="m15 6-6 6 6 6" />
        </svg>
      );
    case 'chev-d':
      return (
        <svg {...props}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case 'chev-u':
      return (
        <svg {...props}>
          <path d="m18 15-6-6-6 6" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...props}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...props}>
          <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'more':
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="12" cy="19" r="1.4" />
        </svg>
      );
    case 'arrow-up-r':
      return (
        <svg {...props}>
          <path d="M7 17 17 7M7 7h10v10" />
        </svg>
      );
    case 'arrow-dn-r':
      return (
        <svg {...props}>
          <path d="M7 7l10 10M17 7v10H7" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...props}>
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case 'mic':
      return (
        <svg {...props}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
        </svg>
      );
    case 'yen':
      return (
        <svg {...props}>
          <path d="M5 4l7 9 7-9M7 13h10M7 17h10M12 13v8" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case 'x':
      return (
        <svg {...props}>
          <path d="M6 6l12 12M6 18 18 6" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'target':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
        </svg>
      );
    case 'trend-up':
      return (
        <svg {...props}>
          <path d="m3 17 6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      );
    case 'trend-dn':
      return (
        <svg {...props}>
          <path d="m3 7 6 6 4-4 8 8" />
          <path d="M14 17h7v-7" />
        </svg>
      );
    case 'receipt':
      return (
        <svg {...props}>
          <path d="M4 2h16v20l-3-2-3 2-2-2-2 2-3-2-3 2z" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'coffee':
      return (
        <svg {...props}>
          <path d="M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />
          <path d="M17 10h2a2 2 0 0 1 0 4h-2" />
          <path d="M7 4v2M11 4v2M15 4v2" />
        </svg>
      );
    case 'shopping':
      return (
        <svg {...props}>
          <path d="M3 6h2l2.5 12a2 2 0 0 0 2 1.6h7a2 2 0 0 0 2-1.6L21 9H6" />
          <circle cx="9" cy="22" r="1" />
          <circle cx="18" cy="22" r="1" />
        </svg>
      );
    case 'bus':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="13" rx="2" />
          <path d="M4 11h16M7 17v2M17 17v2" />
          <circle cx="8" cy="14.5" r="1" />
          <circle cx="16" cy="14.5" r="1" />
        </svg>
      );
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case 'film':
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="18" rx="2" />
          <path d="M2 7h4M18 7h4M2 12h20M2 17h4M18 17h4" />
        </svg>
      );
    case 'bank':
      return (
        <svg {...props}>
          <path d="M3 10 12 4l9 6" />
          <path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18" />
        </svg>
      );
    case 'cash':
      return (
        <svg {...props}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 10v.01M18 14v.01" />
        </svg>
      );
    case 'watch':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="6" />
          <path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 9v3l2 1.5" />
        </svg>
      );
    case 'plane':
      return (
        <svg {...props}>
          <path d="m21 11-9 5L3 11l3-2 4 1 6-5 2 1-3 4 4 1z" />
        </svg>
      );
    case 'command':
      return (
        <svg {...props}>
          <path d="M9 9V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v3M9 15v3a3 3 0 1 1-3-3h12a3 3 0 1 1-3 3v-3M9 9h6v6H9z" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
      );
    case 'user':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...props}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'auto':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12a9 9 0 0 1 9-9" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export default Icon;
