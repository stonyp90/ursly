/**
 * SpotlightSearch - macOS Spotlight-style quick search overlay
 *
 * Cross-platform search overlay triggered by Cmd+K (Mac) or Ctrl+K (Win/Linux)
 * Provides instant search across files, folders, tags, and actions
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { FileMetadata, StorageSource } from '../../types/storage';
import './SpotlightSearch.css';

// Platform detection for display
const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// SVG Icons using CSS variables for theming
const SpotlightIcons: Record<string, JSX.Element> = {
  tag: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 1a1 1 0 0 0-1 1v4.586a1 1 0 0 0 .293.707l7 7a1 1 0 0 0 1.414 0l4.586-4.586a1 1 0 0 0 0-1.414l-7-7A1 1 0 0 0 6.586 1H2zm4 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
    </svg>
  ),
  type: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
    </svg>
  ),
  tier: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16Zm0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15Z" />
    </svg>
  ),
  ext: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z" />
    </svg>
  ),
  is: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
    </svg>
  ),
  size: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 0h1v15h15v1H0V0Zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07Z" />
    </svg>
  ),
  modified: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3H14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4.109a.5.5 0 0 1 .54-.639z" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5ZM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 0 1-.765.935c-.845.147-2.034.309-3.235.309-1.201 0-2.39-.162-3.235-.309A.933.933 0 0 1 3 9.219V8.062Zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a24.767 24.767 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736.847 1.71a.25.25 0 0 0 .404.062l.932-.97a25.286 25.286 0 0 0 1.922-.188.25.25 0 0 0-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 0 0-.166.076l-.754.785-.842-1.7a.25.25 0 0 0-.182-.135Z" />
      <path d="M8.5 1.866a1 1 0 1 0-1 0V3h-2A4.5 4.5 0 0 0 1 7.5V8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1v-.5A4.5 4.5 0 0 0 10.5 3h-2V1.866ZM14 7.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5A3.5 3.5 0 0 1 5.5 4h5A3.5 3.5 0 0 1 14 7.5Z" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 1a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1zm4 0v6h8V1H4zm8 8H4v6h8V9zM1 1v2h2V1H1zm2 3H1v2h2V4zM1 7v2h2V7H1zm2 3H1v2h2v-2zm-2 3v2h2v-2H1zM15 1h-2v2h2V1zm-2 3v2h2V4h-2zm2 3h-2v2h2V7zm-2 3v2h2v-2h-2zm2 3h-2v2h2v-2z" />
    </svg>
  ),
  similar: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z" />
      <path
        fillRule="evenodd"
        d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"
      />
    </svg>
  ),
  autotag: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 2v4.586l7 7L14.586 9l-7-7H3zM2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 2 6.586V2z" />
      <path d="M5.5 5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm0 1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM1 7.086a1 1 0 0 0 .293.707L8.75 15.25l-.043.043a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 0 7.586V3a1 1 0 0 1 1-1v5.086z" />
    </svg>
  ),
  newFolder: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="m.5 3 .04.87a1.99 1.99 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H9v-1H2.826a1 1 0 0 1-.995-.91l-.637-7A1 1 0 0 1 2.19 4h11.62a1 1 0 0 1 .996 1.09L14.54 8h1.005l.256-2.819A2 2 0 0 0 13.81 3H9.828a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 6.172 1H2.5a2 2 0 0 0-2 2zm5.672-1a1 1 0 0 1 .707.293L7.586 3H2.19c-.24 0-.47.042-.683.12L1.5 2.98a1 1 0 0 1 1-.98h3.672z" />
      <path d="M13.5 10a.5.5 0 0 1 .5.5V12h1.5a.5.5 0 1 1 0 1H14v1.5a.5.5 0 1 1-1 0V13h-1.5a.5.5 0 0 1 0-1H13v-1.5a.5.5 0 0 1 .5-.5z" />
    </svg>
  ),
  hidden: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"
      />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"
      />
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
    </svg>
  ),
  recent: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
    </svg>
  ),
  expand: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344 0a.5.5 0 0 1 .707 0l4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707zm0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707zm-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707z"
      />
    </svg>
  ),
  collapse: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M.172 15.828a.5.5 0 0 0 .707 0l4.096-4.096V14.5a.5.5 0 1 0 1 0v-3.975a.5.5 0 0 0-.5-.5H1.5a.5.5 0 0 0 0 1h2.768L.172 15.121a.5.5 0 0 0 0 .707zM15.828.172a.5.5 0 0 0-.707 0l-4.096 4.096V1.5a.5.5 0 1 0-1 0v3.975a.5.5 0 0 0 .5.5h3.975a.5.5 0 1 0 0-1h-2.768L15.828.879a.5.5 0 0 0 0-.707zM.172.172a.5.5 0 0 1 .707 0l4.096 4.096V1.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1 0-1h2.768L.172.879a.5.5 0 0 1 0-.707zm15.656 0a.5.5 0 0 0-.707 0l-4.096 4.096V1.5a.5.5 0 1 0-1 0v3.975a.5.5 0 0 0 .5.5h3.975a.5.5 0 1 0 0-1h-2.768l4.096-4.096a.5.5 0 0 0 0-.707z"
      />
    </svg>
  ),
};

interface SearchResult {
  type: 'file' | 'folder' | 'action' | 'tag' | 'operator' | 'recent';
  id: string;
  title: string;
  subtitle?: string;
  icon: string; // Icon key for SpotlightIcons
  iconType?: string; // CSS class for coloring
  path?: string;
  action?: () => void;
  keywords?: string[];
}

interface SpotlightSearchProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileMetadata[];
  sources: StorageSource[];
  onNavigateToFile: (file: FileMetadata) => void;
  onNavigateToPath: (sourceId: string, path: string) => void;
  onSearchSubmit: (query: string) => void;
  currentSourceId?: string;
}

// Search operator hints - only tag, type, ext, size
const OPERATOR_HINTS: SearchResult[] = [
  {
    type: 'operator',
    id: 'op-tag',
    title: 'tag:',
    subtitle: 'Filter by tag (e.g., tag:important)',
    icon: 'tag',
    iconType: 'op-tag',
    keywords: ['tag', 'label'],
  },
  {
    type: 'operator',
    id: 'op-type',
    title: 'type:',
    subtitle: 'Filter by type (video, image, audio, document, folder, archive)',
    icon: 'type',
    iconType: 'op-type',
    keywords: ['type', 'kind', 'video', 'image', 'audio', 'document'],
  },
  {
    type: 'operator',
    id: 'op-ext',
    title: 'ext:',
    subtitle: 'Filter by extension (e.g., ext:mp4, ext:jpg)',
    icon: 'ext',
    iconType: 'op-ext',
    keywords: ['extension', 'format', 'mp4', 'mov', 'jpg', 'png', 'pdf'],
  },
  {
    type: 'operator',
    id: 'op-size',
    title: 'size:',
    subtitle: 'Filter by size (e.g., size:>10mb, size:<1gb)',
    icon: 'size',
    iconType: 'op-size',
    keywords: ['size', 'bytes', 'megabyte', 'gigabyte'],
  },
];

export function SpotlightSearch({
  isOpen,
  onClose,
  files,
  sources,
  onNavigateToFile,
  onNavigateToPath,
  onSearchSubmit,
  currentSourceId: _currentSourceId,
}: SpotlightSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Recent searches from localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ursly-recent-searches') || '[]');
    } catch {
      return [];
    }
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract unique tags from files
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    files.forEach((f) => {
      (f.tags || []).forEach((t) => tags.add(t));
    });
    return Array.from(tags);
  }, [files]);

  // Parse query for operators
  const parseQuery = useCallback((q: string) => {
    let textSearch = q;
    let tagFilter: string | undefined;
    let typeFilter: string | undefined;
    let extFilter: string | undefined;
    let sizeFilter: string | undefined;

    // Extract tag: operator
    const tagMatch = q.match(/tag:(\S+)/i);
    if (tagMatch) {
      tagFilter = tagMatch[1].toLowerCase();
      textSearch = textSearch.replace(tagMatch[0], '').trim();
    }

    // Extract type: operator
    const typeMatch = q.match(/type:(\S+)/i);
    if (typeMatch) {
      typeFilter = typeMatch[1].toLowerCase();
      textSearch = textSearch.replace(typeMatch[0], '').trim();
    }

    // Extract ext: operator
    const extMatch = q.match(/ext:(\S+)/i);
    if (extMatch) {
      extFilter = extMatch[1].toLowerCase().replace(/^\./, '');
      textSearch = textSearch.replace(extMatch[0], '').trim();
    }

    // Extract size: operator
    const sizeMatch = q.match(/size:(\S+)/i);
    if (sizeMatch) {
      sizeFilter = sizeMatch[1].toLowerCase();
      textSearch = textSearch.replace(sizeMatch[0], '').trim();
    }

    return {
      textSearch: textSearch.toLowerCase().trim(),
      tagFilter,
      typeFilter,
      extFilter,
      sizeFilter,
    };
  }, []);

  // Build search results - simplified to tag, type, ext, size only
  const results = useMemo((): SearchResult[] => {
    const searchResults: SearchResult[] = [];
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      // Show operator hints when empty (tag, type, ext, size)
      searchResults.push(...OPERATOR_HINTS);
      return searchResults;
    }

    // Parse query for operators
    const { textSearch, tagFilter, typeFilter, extFilter } = parseQuery(query);

    // Search files and folders with operator-aware filtering
    const matchingFiles = files
      .filter((f) => {
        // Filter by tag operator
        if (tagFilter) {
          const fileTags = (f.tags || []).map((t) => t.toLowerCase());
          if (!fileTags.some((t) => t.includes(tagFilter))) {
            return false;
          }
        }

        // Filter by type operator
        if (typeFilter) {
          const mimeType = f.mimeType?.toLowerCase() || '';
          const isMatch =
            (typeFilter === 'video' && mimeType.startsWith('video/')) ||
            (typeFilter === 'image' && mimeType.startsWith('image/')) ||
            (typeFilter === 'audio' && mimeType.startsWith('audio/')) ||
            (typeFilter === 'document' &&
              (mimeType.includes('pdf') ||
                mimeType.includes('document') ||
                mimeType.includes('text/'))) ||
            (typeFilter === 'folder' &&
              (mimeType === 'folder' || f.isDirectory)) ||
            (typeFilter === 'archive' &&
              (mimeType.includes('zip') ||
                mimeType.includes('tar') ||
                mimeType.includes('rar') ||
                mimeType.includes('7z') ||
                f.name.match(/\.(zip|tar|gz|rar|7z|bz2)$/i)));
          if (!isMatch) return false;
        }

        // Filter by ext operator
        if (extFilter) {
          const fileExt = f.name.split('.').pop()?.toLowerCase();
          if (fileExt !== extFilter) return false;
        }

        // Text search (name, path, tags) - only if there's text left after operators
        if (textSearch) {
          const nameMatch = f.name.toLowerCase().includes(textSearch);
          const pathMatch = f.path.toLowerCase().includes(textSearch);
          const tagMatch = (f.tags || []).some((t) =>
            t.toLowerCase().includes(textSearch),
          );
          if (!nameMatch && !pathMatch && !tagMatch) {
            return false;
          }
        }
        // If only operators are used (no text search), file has already passed operator filters
        // If no operators and no text, this shouldn't happen (empty query shows hints)

        return true;
      })
      .slice(0, 8);

    matchingFiles.forEach((f) => {
      searchResults.push({
        type: f.isDirectory ? 'folder' : 'file',
        id: f.path,
        title: f.name,
        subtitle: f.path,
        icon: f.isDirectory ? 'folder' : getFileIconKey(f.name),
        path: f.path,
      });
    });

    // Search tags - only show if not filtering by specific tag
    // Use textSearch for tag search, or the original query if no operators were parsed
    if (!tagFilter && textSearch) {
      availableTags
        .filter((t) => t.toLowerCase().includes(textSearch))
        .slice(0, 3)
        .forEach((tag) => {
          searchResults.push({
            type: 'tag',
            id: `tag-${tag}`,
            title: tag,
            subtitle: 'Tag',
            icon: 'tag',
          });
        });
    } else if (!tagFilter && !typeFilter && !extFilter) {
      // If no operators, search tags by the full query
      availableTags
        .filter((t) => t.toLowerCase().includes(lowerQuery))
        .slice(0, 3)
        .forEach((tag) => {
          searchResults.push({
            type: 'tag',
            id: `tag-${tag}`,
            title: tag,
            subtitle: 'Tag',
            icon: 'tag',
          });
        });
    }

    // Search operators (tag:, type:, ext:, size:) - only show if query doesn't already contain them
    const hasOperator = tagFilter || typeFilter || extFilter;
    if (!hasOperator) {
      OPERATOR_HINTS.filter(
        (o) =>
          o.title.toLowerCase().includes(lowerQuery) ||
          o.keywords?.some((k) => k.includes(lowerQuery)),
      ).forEach((op) => {
        searchResults.push(op);
      });
    }

    return searchResults.slice(0, 12);
  }, [query, files, availableTags, parseQuery]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.min(selectedIndex + 1, results.length - 1);
      setSelectedIndex(newIndex);
      scrollToSelected(newIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.max(selectedIndex - 1, 0);
      setSelectedIndex(newIndex);
      scrollToSelected(newIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (query.trim()) {
        // Submit as search query
        handleSearchSubmit();
      }
    } else if (e.key === 'Tab' && !e.shiftKey && results[selectedIndex]) {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result.type === 'operator') {
        setQuery(result.title);
        inputRef.current?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const scrollToSelected = (index: number) => {
    const container = resultsRef.current;
    const item = container?.children[index] as HTMLElement;
    if (item && container) {
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (itemRect.bottom > containerRect.bottom) {
        item.scrollIntoView({ block: 'nearest' });
      } else if (itemRect.top < containerRect.top) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const handleSelect = useCallback(
    (result: SearchResult) => {
      switch (result.type) {
        case 'file':
        case 'folder':
          if (result.path) {
            const file = files.find((f) => f.path === result.path);
            if (file) {
              onNavigateToFile(file);
            }
          }
          break;

        case 'tag':
          setQuery(`tag:${result.title} `);
          return; // Don't close, let user continue searching

        case 'operator':
          setQuery(result.title);
          return; // Don't close, let user continue
      }

      // Save to recent searches
      if (query.trim() && !recentSearches.includes(query.trim())) {
        const updated = [query.trim(), ...recentSearches].slice(0, 10);
        setRecentSearches(updated);
        localStorage.setItem('ursly-recent-searches', JSON.stringify(updated));
      }

      onClose();
    },
    [files, onNavigateToFile, query, recentSearches, onClose],
  );

  const handleSearchSubmit = () => {
    if (query.trim()) {
      // Save to recent
      if (!recentSearches.includes(query.trim())) {
        const updated = [query.trim(), ...recentSearches].slice(0, 10);
        setRecentSearches(updated);
        localStorage.setItem('ursly-recent-searches', JSON.stringify(updated));
      }
      onSearchSubmit(query.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="spotlight-overlay" onClick={onClose}>
      <div className="spotlight-container" onClick={(e) => e.stopPropagation()}>
        <div className="spotlight-input-wrapper">
          <svg
            className="spotlight-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="spotlight-input"
            placeholder="Search files, folders, tags... (tag:, type:, ext:, size:)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="spotlight-shortcut">
            <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>
            <kbd>K</kbd>
          </div>
        </div>

        {results.length > 0 && (
          <div ref={resultsRef} className="spotlight-results">
            {results.map((result, i) => (
              <button
                key={result.id}
                className={`spotlight-result ${i === selectedIndex ? 'selected' : ''} ${result.type} ${result.iconType || ''}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className={`result-icon ${result.iconType || ''}`}>
                  {SpotlightIcons[result.icon] || result.icon}
                </span>
                <div className="result-content">
                  <span className="result-title">{result.title}</span>
                  {result.subtitle && (
                    <span className="result-subtitle">{result.subtitle}</span>
                  )}
                </div>
                {result.type === 'operator' && (
                  <span className="result-hint">Tab to insert</span>
                )}
                {(result.type === 'file' || result.type === 'folder') && (
                  <span className="result-hint">↵ Open</span>
                )}
                {result.type === 'action' && (
                  <span className="result-hint">↵ Run</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="spotlight-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Select
          </span>
          <span>
            <kbd>Tab</kbd> Complete
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}

// Get file icon key based on extension
function getFileIconKey(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    mp4: 'video',
    mov: 'video',
    avi: 'video',
    mkv: 'video',
    webm: 'video',
    jpg: 'file',
    jpeg: 'file',
    png: 'file',
    gif: 'file',
    webp: 'file',
    svg: 'file',
    mp3: 'file',
    wav: 'file',
    flac: 'file',
    aac: 'file',
    pdf: 'file',
    doc: 'file',
    docx: 'file',
    xls: 'file',
    xlsx: 'file',
    ppt: 'file',
    pptx: 'file',
    zip: 'file',
    rar: 'file',
    '7z': 'file',
    tar: 'file',
    gz: 'file',
    js: 'file',
    ts: 'file',
    tsx: 'file',
    jsx: 'file',
    py: 'file',
    rs: 'file',
    go: 'file',
    json: 'file',
    yaml: 'file',
    yml: 'file',
    md: 'file',
    txt: 'file',
  };
  return iconMap[ext || ''] || 'file';
}

export default SpotlightSearch;
