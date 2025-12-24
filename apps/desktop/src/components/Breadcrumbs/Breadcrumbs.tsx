/**
 * Breadcrumbs Component
 * Theme-aware path navigation
 */

import { useState, useRef, useEffect } from 'react';
import './Breadcrumbs.css';

export interface BreadcrumbItem {
  name: string;
  path: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  maxVisible?: number;
  showIcons?: boolean;
  rootIcon?: React.ReactNode;
}

// SVG Icon components - using currentColor to inherit theme
const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3H13.5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2.5a2 2 0 0 1-2-2V3.87z" />
  </svg>
);

const DesktopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 4s0-2 2-2h12s2 0 2 2v6s0 2-2 2h-4c0 .667.083 1.167.25 1.5H11a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1h.75c.167-.333.25-.833.25-1.5H2s-2 0-2-2V4zm1.398-.855a.758.758 0 0 0-.254.302A1.46 1.46 0 0 0 1 4.01V10c0 .325.078.502.145.602.07.105.17.188.302.254a1.464 1.464 0 0 0 .538.143L2.01 11H14c.325 0 .502-.078.602-.145a.758.758 0 0 0 .254-.302 1.464 1.464 0 0 0 .143-.538L15 9.99V4c0-.325-.078-.502-.145-.602a.757.757 0 0 0-.302-.254A1.46 1.46 0 0 0 13.99 3H2c-.325 0-.502.078-.602.145z" />
  </svg>
);

const DocumentsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm-.5 2.5A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zM5 8a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1H5z" />
    <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z" />
  </svg>
);

const DownloadsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
  </svg>
);

const PicturesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
    <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z" />
  </svg>
);

const MusicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6 13c0 1.105-1.12 2-2.5 2S1 14.105 1 13c0-1.104 1.12-2 2.5-2s2.5.896 2.5 2zm9-2c0 1.105-1.12 2-2.5 2s-2.5-.895-2.5-2 1.12-2 2.5-2 2.5.895 2.5 2z" />
    <path fillRule="evenodd" d="M14 11V2h1v9h-1zM6 3v10H5V3h1z" />
    <path d="M5 2.905a1 1 0 0 1 .9-.995l8-.8a1 1 0 0 1 1.1.995V3L5 4V2.905z" />
  </svg>
);

const DriveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.5 5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM3 4.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" />
    <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H8.5v3a1.5 1.5 0 0 1 1.5 1.5h5.5a.5.5 0 0 1 0 1H10A1.5 1.5 0 0 1 8.5 14h-1A1.5 1.5 0 0 1 6 12.5H.5a.5.5 0 0 1 0-1H6A1.5 1.5 0 0 1 7.5 10V7H2a2 2 0 0 1-2-2V4zm1 0v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1zm6 7.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5z" />
  </svg>
);

const HomeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146zM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v4H2.5z" />
  </svg>
);

// Reserved for future use:
// CloudIcon, NetworkIcon (defined but not yet used in breadcrumb system)

export function Breadcrumbs({
  items,
  onNavigate,
  maxVisible = 4,
  showIcons = true,
  rootIcon,
}: BreadcrumbsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent,
    path: string,
    index: number,
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigate(path);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      const prevButton = containerRef.current?.querySelector(
        `[data-index="${index - 1}"]`,
      ) as HTMLButtonElement;
      prevButton?.focus();
    } else if (e.key === 'ArrowRight' && index < items.length - 1) {
      e.preventDefault();
      const nextButton = containerRef.current?.querySelector(
        `[data-index="${index + 1}"]`,
      ) as HTMLButtonElement;
      nextButton?.focus();
    }
  };

  // Get folder icon based on name
  const getFolderIcon = (name: string, isRoot: boolean): React.ReactNode => {
    if (isRoot && rootIcon) return rootIcon;

    const lowerName = name.toLowerCase();
    if (lowerName === 'home' || lowerName.includes('user')) return <HomeIcon />;
    if (lowerName === 'desktop') return <DesktopIcon />;
    if (lowerName === 'documents' || lowerName === 'docs')
      return <DocumentsIcon />;
    if (lowerName === 'downloads') return <DownloadsIcon />;
    if (lowerName === 'pictures' || lowerName === 'photos')
      return <PicturesIcon />;
    if (lowerName === 'music' || lowerName === 'audio') return <MusicIcon />;
    if (lowerName === 'volumes' || lowerName === 'drives') return <DriveIcon />;
    if (isRoot) return <DriveIcon />;

    return <FolderIcon />;
  };

  // Truncate name if too long
  const truncateName = (name: string, maxLength = 20): string => {
    if (name.length <= maxLength) return name;
    return name.slice(0, maxLength - 2) + '...';
  };

  // If we have more items than maxVisible, show collapsed view
  const shouldCollapse = items.length > maxVisible;
  const visibleItems = shouldCollapse
    ? [items[0], ...items.slice(-maxVisible + 1)]
    : items;
  const hiddenItems = shouldCollapse ? items.slice(1, -maxVisible + 1) : [];

  return (
    <nav
      ref={containerRef}
      className="breadcrumbs"
      aria-label="File path navigation"
    >
      <ol className="breadcrumbs-list">
        {visibleItems.map((item, displayIndex) => {
          const actualIndex =
            shouldCollapse && displayIndex > 0
              ? items.length - maxVisible + displayIndex
              : displayIndex;
          const isLast = actualIndex === items.length - 1;
          const isFirst = actualIndex === 0;
          const showEllipsis = shouldCollapse && displayIndex === 1;

          return (
            <li key={item.path || 'root'} className="breadcrumbs-item">
              {/* Show ellipsis dropdown for hidden items */}
              {showEllipsis && hiddenItems.length > 0 && (
                <>
                  <span className="breadcrumbs-separator" aria-hidden="true">
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                      <path
                        d="M1.5 1L6.5 6L1.5 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div
                    className="breadcrumbs-ellipsis-container"
                    ref={dropdownRef}
                  >
                    <button
                      className="breadcrumbs-ellipsis"
                      onClick={() => setShowDropdown(!showDropdown)}
                      aria-expanded={showDropdown}
                      aria-haspopup="menu"
                      title="Show hidden folders"
                    >
                      ...
                    </button>
                    {showDropdown && (
                      <div className="breadcrumbs-dropdown" role="menu">
                        {hiddenItems.map((hidden) => (
                          <button
                            key={hidden.path}
                            className="breadcrumbs-dropdown-item"
                            onClick={() => {
                              onNavigate(hidden.path);
                              setShowDropdown(false);
                            }}
                            role="menuitem"
                          >
                            <span className="dropdown-icon">
                              {getFolderIcon(hidden.name, false)}
                            </span>
                            <span className="dropdown-name">{hidden.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Separator */}
              {!isFirst && !showEllipsis && (
                <span className="breadcrumbs-separator" aria-hidden="true">
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                    <path
                      d="M1.5 1L6.5 6L1.5 11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}

              {/* Breadcrumb button */}
              <button
                className={`breadcrumbs-button ${isLast ? 'current' : ''} ${
                  hoveredIndex === actualIndex ? 'hovered' : ''
                }`}
                onClick={() => !isLast && onNavigate(item.path)}
                onKeyDown={(e) => handleKeyDown(e, item.path, actualIndex)}
                onMouseEnter={() => setHoveredIndex(actualIndex)}
                onMouseLeave={() => setHoveredIndex(null)}
                data-index={actualIndex}
                disabled={isLast}
                aria-current={isLast ? 'page' : undefined}
                title={item.name}
              >
                {showIcons && (
                  <span className="breadcrumbs-icon" aria-hidden="true">
                    {item.icon || getFolderIcon(item.name, isFirst)}
                  </span>
                )}
                <span className="breadcrumbs-name">
                  {truncateName(item.name)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
