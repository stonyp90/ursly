/**
 * Ursly Logo - Adobe-inspired, clean purple design
 *
 * A modern, geometric "U" icon with a rich purple gradient background.
 * Inspired by Adobe's clean icon design language.
 * Uses global CSS variables for consistent theming.
 */

import './Logo.css';

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = '' }: LogoProps) {
  // Generate unique ID for gradient to avoid conflicts
  const gradientId = `ursly-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={`ursly-logo ${className}`}
      role="img"
      aria-label="Ursly Logo"
    >
      {/* Background - Adobe-style rounded rectangle */}
      <rect
        width="32"
        height="32"
        rx="7"
        className="logo-background"
        fill={`url(#${gradientId})`}
      />

      {/* Stylized "U" letter - modern, geometric design */}
      <path
        d="M8 9V18C8 22.4183 11.5817 26 16 26C20.4183 26 24 22.4183 24 18V9"
        className="logo-letter"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Accent dot - adds visual interest like a data node */}
      <circle cx="16" cy="18" r="2" className="logo-accent" />

      <defs>
        {/* Gradient uses CSS variables for theming */}
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            className="gradient-start"
            stopColor="var(--logo-gradient-start, #7C3AED)"
          />
          <stop
            className="gradient-mid"
            offset="0.5"
            stopColor="var(--logo-gradient-mid, #8B5CF6)"
          />
          <stop
            className="gradient-end"
            offset="1"
            stopColor="var(--logo-gradient-end, #A855F7)"
          />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Logo with text variant
 */
export function LogoWithText({ size = 32, className = '' }: LogoProps) {
  return (
    <div className={`logo-with-text ${className}`}>
      <Logo size={size} />
      <div className="logo-text">
        <span className="logo-title">Ursly</span>
        <span className="logo-tagline">VIRTUAL CLOUD FILE SYSTEM</span>
      </div>
    </div>
  );
}

/**
 * Minimal icon variant (no text, just the U)
 * Uses currentColor for flexibility
 */
export function LogoIcon({ size = 24, className = '' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={`ursly-logo-icon ${className}`}
      role="img"
      aria-label="Ursly"
    >
      {/* Just the U shape, no background - uses currentColor */}
      <path
        d="M5 4V14C5 18.4183 8.58172 22 12 22C15.4183 22 19 18.4183 19 14V4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="1.5" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export default Logo;
