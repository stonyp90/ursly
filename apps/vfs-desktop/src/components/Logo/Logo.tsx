/**
 * Ursly Logo - Simple & Clean
 * Minimalist "U" mark - instantly recognizable
 */

import './Logo.css';

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Main Logo - Simple U on gradient background
 */
export function Logo({ size = 32, className = '' }: LogoProps) {
  const id = `u-${Math.random().toString(36).substr(2, 4)}`;

  // Get CSS variables from computed styles
  const getCSSVariable = (varName: string, fallback: string) => {
    if (typeof window !== 'undefined') {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue(varName)
          .trim() || fallback
      );
    }
    return fallback;
  };

  const primaryColor = getCSSVariable('--primary', '#0a84ff');
  const secondaryColor = getCSSVariable('--secondary', '#5e5ce6');

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={`ursly-logo ${className}`}
      role="img"
      aria-label="Ursly"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={secondaryColor} />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="32" height="32" rx="8" fill={`url(#${id}-g)`} />

      {/* Simple U */}
      <path
        d="M9 8 L9 20 C9 24 12 26 16 26 C20 26 23 24 23 20 L23 8"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Logo with text
 */
export function LogoWithText({ size = 32, className = '' }: LogoProps) {
  return (
    <div className={`logo-with-text ${className}`}>
      <Logo size={size} />
      <span className="logo-wordmark">Ursly</span>
    </div>
  );
}

/**
 * Monochrome icon
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
      <path
        d="M6 5 L6 15 C6 19 9 21 12 21 C15 21 18 19 18 15 L18 5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Glyph only
 */
export function LogoGlyph({ size = 24, className = '' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={`ursly-logo-glyph ${className}`}
      role="img"
      aria-label="Ursly"
    >
      <path
        d="M6 4 L6 15 C6 19.5 8.5 22 12 22 C15.5 22 18 19.5 18 15 L18 4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Animated variant
 */
export function LogoAnimated({ size = 48, className = '' }: LogoProps) {
  const id = `ua-${Math.random().toString(36).substr(2, 4)}`;

  // Get CSS variables from computed styles
  const getCSSVariable = (varName: string, fallback: string) => {
    if (typeof window !== 'undefined') {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue(varName)
          .trim() || fallback
      );
    }
    return fallback;
  };

  const primaryColor = getCSSVariable('--primary', '#0a84ff');
  const secondaryColor = getCSSVariable('--secondary', '#5e5ce6');

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={`ursly-logo ursly-logo-animated ${className}`}
      role="img"
      aria-label="Ursly"
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primaryColor}>
            <animate
              attributeName="stop-color"
              values={`${primaryColor};${secondaryColor};${primaryColor}`}
              dur="2s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor={secondaryColor}>
            <animate
              attributeName="stop-color"
              values={`${secondaryColor};${primaryColor};${secondaryColor}`}
              dur="2s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
      </defs>

      <rect width="32" height="32" rx="8" fill={`url(#${id}-a)`} />
      <path
        d="M9 8 L9 20 C9 24 12 26 16 26 C20 26 23 24 23 20 L23 8"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default Logo;
