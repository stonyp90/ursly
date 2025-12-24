/**
 * Cyberpunk-themed SVG icons for the VFS
 * Neon glowing icons with futuristic design
 */
import React from 'react';
import './CyberpunkIcons.css';

interface IconProps {
  size?: number;
  color?: string;
  glow?: boolean;
  className?: string;
}

// Storage icons
export const IconLocalDrive: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 14h16" />
    <circle cx="17" cy="17" r="1.5" fill={color} />
    <path d="M8 9h4" />
  </svg>
);

export const IconFolder: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
    <path d="M3 10h18" opacity="0.5" />
  </svg>
);

export const IconCloud: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    <path d="M12 12v4M10 14l2-2 2 2" opacity="0.5" />
  </svg>
);

export const IconNetwork: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M10 6.5h4M17.5 10v4M14 17.5h-4M6.5 14v-4" opacity="0.5" />
  </svg>
);

export const IconServer: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="3" y="4" width="18" height="6" rx="1" />
    <rect x="3" y="14" width="18" height="6" rx="1" />
    <circle cx="17" cy="7" r="1" fill={color} />
    <circle cx="17" cy="17" r="1" fill={color} />
    <path d="M7 7h4M7 17h4" opacity="0.5" />
  </svg>
);

export const IconDatabase: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M20 5v14c0 1.66-3.58 3-8 3s-8-1.34-8-3V5" />
    <path d="M20 12c0 1.66-3.58 3-8 3s-8-1.34-8-3" opacity="0.5" />
  </svg>
);

export const IconStar: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <polygon
      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
      fill={color}
      fillOpacity="0.2"
    />
  </svg>
);

export const IconTag: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <circle cx="7" cy="7" r="1.5" fill={color} />
  </svg>
);

export const IconDesktop: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const IconDocuments: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8M8 17h5" opacity="0.5" />
  </svg>
);

export const IconDownloads: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const IconPictures: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" fill={color} />
    <polyline points="21 15 16 10 5 21" opacity="0.5" />
  </svg>
);

export const IconMusic: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const IconVolumes: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="3" y="8" width="18" height="8" rx="1" />
    <path d="M3 12h18" opacity="0.5" />
    <circle cx="17" cy="10" r="1" fill={color} />
    <circle cx="17" cy="14" r="1" fill={color} />
    <path d="M7 10h4M7 14h4" opacity="0.3" />
  </svg>
);

export const IconHome: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" opacity="0.5" />
  </svg>
);

export const IconLink: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

export const IconCube: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" opacity="0.5" />
    <line x1="12" y1="22.08" x2="12" y2="12" opacity="0.5" />
  </svg>
);

// ===== FILE TYPE ICONS =====

// Generic file icon with cyberpunk corner accent
export const IconFile: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    {/* Circuit line accent */}
    <path d="M8 14h8" opacity="0.4" />
    <path d="M8 17h5" opacity="0.3" />
  </svg>
);

// Video file - play button with scanlines
export const IconVideo: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon video ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    {/* Play triangle */}
    <polygon points="10 8 16 12 10 16" fill={color} fillOpacity="0.3" />
    {/* Scanlines */}
    <line x1="2" y1="8" x2="22" y2="8" opacity="0.15" />
    <line x1="2" y1="12" x2="22" y2="12" opacity="0.1" />
    <line x1="2" y1="16" x2="22" y2="16" opacity="0.15" />
  </svg>
);

// Audio file - waveform
export const IconAudio: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon audio ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.3" />
    {/* Waveform bars */}
    <line x1="6" y1="10" x2="6" y2="14" opacity="0.6" />
    <line x1="18" y1="10" x2="18" y2="14" opacity="0.6" />
    <line x1="8" y1="8" x2="8" y2="16" opacity="0.5" />
    <line x1="16" y1="8" x2="16" y2="16" opacity="0.5" />
  </svg>
);

// Image file - frame with corner
export const IconImage: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon image ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    {/* Sun/light source */}
    <circle cx="8" cy="8" r="2" fill={color} fillOpacity="0.4" />
    {/* Mountain/landscape */}
    <path d="M21 15l-5-5-6 6" opacity="0.5" />
    <path d="M14 18l-5-5-6 6" opacity="0.3" />
  </svg>
);

// PDF - document with P badge
export const IconPdf: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon pdf ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    {/* PDF badge */}
    <rect
      x="7"
      y="12"
      width="10"
      height="6"
      rx="1"
      fill={color}
      fillOpacity="0.2"
    />
    <text
      x="12"
      y="16.5"
      textAnchor="middle"
      fontSize="4"
      fill={color}
      fontWeight="bold"
    >
      PDF
    </text>
  </svg>
);

// Code file - brackets
export const IconCode: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon code ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    {/* Code brackets */}
    <path d="M9 13l-2 2 2 2" opacity="0.7" />
    <path d="M15 13l2 2-2 2" opacity="0.7" />
    <line x1="11" y1="12" x2="13" y2="18" opacity="0.5" />
  </svg>
);

// Archive/Zip - stacked layers
export const IconArchive: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon archive ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M4 4v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2z" />
    <polyline points="14 2 14 8 20 8" />
    {/* Zipper pattern */}
    <rect x="10" y="4" width="4" height="2" fill={color} fillOpacity="0.3" />
    <rect x="10" y="7" width="4" height="2" fill={color} fillOpacity="0.25" />
    <rect x="10" y="10" width="4" height="2" fill={color} fillOpacity="0.2" />
    <rect
      x="10"
      y="13"
      width="4"
      height="3"
      rx="0.5"
      fill={color}
      fillOpacity="0.4"
    />
  </svg>
);

// Executable/App - gear/cog
export const IconExecutable: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon exec ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <rect x="3" y="3" width="18" height="18" rx="3" />
    {/* Gear/cog in center */}
    <circle cx="12" cy="12" r="3" />
    <path d="M12 5v2M12 17v2M5 12h2M17 12h2" opacity="0.5" />
    <path
      d="M7.05 7.05l1.41 1.41M15.54 15.54l1.41 1.41M7.05 16.95l1.41-1.41M15.54 8.46l1.41-1.41"
      opacity="0.3"
    />
  </svg>
);

// Spreadsheet - grid
export const IconSpreadsheet: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon spreadsheet ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    {/* Grid */}
    <line x1="6" y1="12" x2="18" y2="12" opacity="0.4" />
    <line x1="6" y1="16" x2="18" y2="16" opacity="0.4" />
    <line x1="10" y1="10" x2="10" y2="18" opacity="0.4" />
    <line x1="14" y1="10" x2="14" y2="18" opacity="0.4" />
  </svg>
);

// Text file - lines
export const IconText: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon file-icon text ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="12" x2="16" y2="12" opacity="0.4" />
    <line x1="8" y1="15" x2="16" y2="15" opacity="0.35" />
    <line x1="8" y1="18" x2="12" y2="18" opacity="0.3" />
  </svg>
);

// Cyberpunk folder with circuit pattern
export const IconFolderCyber: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = true,
  className = '',
}) => (
  <svg
    className={`cyber-icon folder-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
  >
    <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
    {/* Circuit pattern inside */}
    <path d="M7 12h3l1 1h2l1-1h3" opacity="0.3" />
    <circle cx="7" cy="12" r="0.5" fill={color} opacity="0.5" />
    <circle cx="17" cy="12" r="0.5" fill={color} opacity="0.5" />
    {/* Top edge highlight */}
    <path d="M3 10h18" opacity="0.2" />
  </svg>
);

// Helper to get icon by folder name
export function getFolderIcon(name: string): React.FC<IconProps> {
  const lowerName = name.toLowerCase();
  if (lowerName === 'home' || lowerName === 'user' || lowerName === 'users')
    return IconHome;
  if (lowerName === 'desktop') return IconDesktop;
  if (lowerName === 'documents') return IconDocuments;
  if (lowerName === 'downloads') return IconDownloads;
  if (lowerName === 'pictures' || lowerName === 'photos') return IconPictures;
  if (lowerName === 'music') return IconMusic;
  if (lowerName === 'volumes') return IconVolumes;
  return IconFolderCyber;
}

// Helper to get icon by storage category
export function getStorageIcon(category: string): React.FC<IconProps> {
  switch (category) {
    case 'cloud':
      return IconCloud;
    case 'network':
      return IconNetwork;
    case 'hybrid':
      return IconDatabase;
    case 'block':
      return IconCube;
    case 'custom':
      return IconLink;
    default:
      return IconLocalDrive;
  }
}

// Helper to get file icon by extension/mime type
export function getFileIcon(
  filename: string,
  mimeType?: string,
): React.FC<IconProps> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const baseName = filename.toLowerCase();

  // Common config/hidden files - use code icon with different styling
  const configFiles = [
    '.gitignore',
    '.gitattributes',
    '.gitmodules',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.editorconfig',
    '.prettierrc',
    '.eslintrc',
    '.npmrc',
    '.dockerignore',
    '.browserslistrc',
    '.babelrc',
    'dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    '.bash_history',
    '.zsh_history',
    '.bash_profile',
    '.bashrc',
    '.zshrc',
  ];
  if (configFiles.includes(baseName) || baseName.startsWith('.git')) {
    return IconCode;
  }

  // Credentials/secrets files - use code icon
  if (
    baseName.includes('credentials') ||
    baseName.includes('secrets') ||
    baseName.includes('password') ||
    ext === 'pem' ||
    ext === 'key'
  ) {
    return IconCode;
  }

  // Video
  if (
    [
      'mp4',
      'mov',
      'avi',
      'mkv',
      'webm',
      'wmv',
      'flv',
      'm4v',
      'prores',
      'mxf',
    ].includes(ext) ||
    mimeType?.startsWith('video/')
  ) {
    return IconVideo;
  }

  // Audio
  if (
    ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'aiff', 'opus'].includes(
      ext,
    ) ||
    mimeType?.startsWith('audio/')
  ) {
    return IconAudio;
  }

  // Image
  if (
    [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'bmp',
      'webp',
      'svg',
      'ico',
      'tiff',
      'heic',
      'raw',
      'cr2',
      'nef',
    ].includes(ext) ||
    mimeType?.startsWith('image/')
  ) {
    return IconImage;
  }

  // PDF
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return IconPdf;
  }

  // Code and config files
  if (
    [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'rb',
      'go',
      'rs',
      'java',
      'c',
      'cpp',
      'h',
      'hpp',
      'css',
      'scss',
      'less',
      'html',
      'htm',
      'vue',
      'svelte',
      'json',
      'jsonc',
      'json5',
      'xml',
      'yaml',
      'yml',
      'toml',
      'ini',
      'conf',
      'cfg',
      'sh',
      'bash',
      'zsh',
      'fish',
      'ps1',
      'bat',
      'cmd',
      'sql',
      'graphql',
      'gql',
      'proto',
      'swift',
      'kt',
      'scala',
      'clj',
      'ex',
      'exs',
      'r',
      'R',
      'jl',
      'lua',
      'pl',
      'pm',
      'php',
      'cs',
      'fs',
      'vb',
      'lock',
      'log',
    ].includes(ext)
  ) {
    return IconCode;
  }

  // Archive
  if (
    [
      'zip',
      'rar',
      '7z',
      'tar',
      'gz',
      'bz2',
      'xz',
      'lz',
      'lzma',
      'dmg',
      'iso',
      'pkg',
      'deb',
      'rpm',
    ].includes(ext)
  ) {
    return IconArchive;
  }

  // Executable/App
  if (['exe', 'app', 'msi', 'apk', 'ipa', 'bin', 'run', 'out'].includes(ext)) {
    return IconExecutable;
  }

  // Spreadsheet
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers', 'tsv'].includes(ext)) {
    return IconSpreadsheet;
  }

  // Text/Document
  if (
    [
      'txt',
      'md',
      'markdown',
      'rtf',
      'doc',
      'docx',
      'odt',
      'pages',
      'tex',
      'org',
      'rst',
    ].includes(ext) ||
    mimeType?.startsWith('text/')
  ) {
    return IconText;
  }

  // Default file
  return IconFile;
}

export default {
  IconLocalDrive,
  IconFolder,
  IconFolderCyber,
  IconCloud,
  IconNetwork,
  IconServer,
  IconDatabase,
  IconStar,
  IconTag,
  IconDesktop,
  IconDocuments,
  IconDownloads,
  IconPictures,
  IconMusic,
  IconVolumes,
  IconHome,
  IconLink,
  IconCube,
  IconFile,
  IconVideo,
  IconAudio,
  IconImage,
  IconPdf,
  IconCode,
  IconArchive,
  IconExecutable,
  IconSpreadsheet,
  IconText,
  getFolderIcon,
  getStorageIcon,
  getFileIcon,
};

// Alert/Warning icon (triangle with exclamation)
export const IconAlertTriangle: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = false,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// Info icon (circle with i)
export const IconInfo: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = false,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// X/Close icon
export const IconX: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = false,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Check/Checkmark icon
export const IconCheck: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  glow = false,
  className = '',
}) => (
  <svg
    className={`cyber-icon ${glow ? 'glow' : ''} ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
