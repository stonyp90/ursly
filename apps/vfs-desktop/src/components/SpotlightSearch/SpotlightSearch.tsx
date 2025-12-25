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

interface SearchResult {
  type: 'file' | 'folder' | 'action' | 'tag' | 'operator' | 'recent';
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
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

// Quick actions available in spotlight
const QUICK_ACTIONS: SearchResult[] = [
  {
    type: 'action',
    id: 'new-folder',
    title: 'New Folder',
    subtitle: 'Create a new folder',
    icon: '📁',
    keywords: ['create', 'folder', 'new', 'mkdir'],
  },
  {
    type: 'action',
    id: 'toggle-hidden',
    title: 'Toggle Hidden Files',
    subtitle: 'Show or hide hidden files',
    icon: '👁️',
    keywords: ['hidden', 'show', 'hide', 'invisible'],
  },
  {
    type: 'action',
    id: 'icon-view',
    title: 'Switch to Icon View',
    subtitle: 'Grid layout with thumbnails',
    icon: '🔲',
    keywords: ['view', 'grid', 'icon', 'thumbnail'],
  },
  {
    type: 'action',
    id: 'list-view',
    title: 'Switch to List View',
    subtitle: 'Detailed list layout',
    icon: '📋',
    keywords: ['view', 'list', 'details'],
  },
  {
    type: 'action',
    id: 'refresh',
    title: 'Refresh',
    subtitle: 'Reload current folder',
    icon: '🔄',
    keywords: ['refresh', 'reload', 'update'],
  },
];

// Search operator hints
const OPERATOR_HINTS: SearchResult[] = [
  {
    type: 'operator',
    id: 'op-tag',
    title: 'tag:',
    subtitle: 'Filter by tag (e.g., tag:important)',
    icon: '🏷️',
    keywords: ['tag', 'label'],
  },
  {
    type: 'operator',
    id: 'op-type',
    title: 'type:',
    subtitle: 'Filter by type (video, image, document)',
    icon: '📄',
    keywords: ['type', 'kind'],
  },
  {
    type: 'operator',
    id: 'op-ext',
    title: 'ext:',
    subtitle: 'Filter by extension (e.g., ext:mp4)',
    icon: '📎',
    keywords: ['extension', 'format'],
  },
  {
    type: 'operator',
    id: 'op-size',
    title: 'size:',
    subtitle: 'Filter by size (e.g., size:>10mb)',
    icon: '📊',
    keywords: ['size', 'bytes'],
  },
  {
    type: 'operator',
    id: 'op-modified',
    title: 'modified:',
    subtitle: 'Filter by date (today, week, month)',
    icon: '📅',
    keywords: ['date', 'modified', 'time'],
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
  currentSourceId,
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

  // Build search results
  const results = useMemo((): SearchResult[] => {
    const searchResults: SearchResult[] = [];
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      // Show recent searches and operator hints when empty
      recentSearches.slice(0, 3).forEach((search, i) => {
        searchResults.push({
          type: 'recent',
          id: `recent-${i}`,
          title: search,
          subtitle: 'Recent search',
          icon: '🕐',
        });
      });

      // Show operator hints
      searchResults.push(...OPERATOR_HINTS.slice(0, 4));

      // Show quick actions
      searchResults.push(...QUICK_ACTIONS.slice(0, 3));

      return searchResults;
    }

    // Search files and folders
    const matchingFiles = files
      .filter((f) => {
        const nameMatch = f.name.toLowerCase().includes(lowerQuery);
        const pathMatch = f.path.toLowerCase().includes(lowerQuery);
        const tagMatch = (f.tags || []).some((t) =>
          t.toLowerCase().includes(lowerQuery),
        );
        return nameMatch || pathMatch || tagMatch;
      })
      .slice(0, 8);

    matchingFiles.forEach((f) => {
      searchResults.push({
        type: f.isDirectory ? 'folder' : 'file',
        id: f.path,
        title: f.name,
        subtitle: f.path,
        icon: f.isDirectory ? '📁' : getFileIcon(f.name),
        path: f.path,
      });
    });

    // Search tags
    availableTags
      .filter((t) => t.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .forEach((tag) => {
        searchResults.push({
          type: 'tag',
          id: `tag-${tag}`,
          title: tag,
          subtitle: 'Tag',
          icon: '🏷️',
        });
      });

    // Search actions
    QUICK_ACTIONS.filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.keywords?.some((k) => k.includes(lowerQuery)),
    )
      .slice(0, 3)
      .forEach((action) => {
        searchResults.push(action);
      });

    // Search operators if query starts with a letter
    if (lowerQuery.length <= 4) {
      OPERATOR_HINTS.filter((o) => o.title.startsWith(lowerQuery)).forEach(
        (op) => {
          searchResults.push(op);
        },
      );
    }

    return searchResults.slice(0, 12);
  }, [query, files, availableTags, recentSearches]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      scrollToSelected(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      scrollToSelected(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (query.trim()) {
        // Submit as search query
        handleSearchSubmit();
      }
    } else if (e.key === 'Tab' && results[selectedIndex]) {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result.type === 'operator') {
        setQuery(result.title);
      }
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

        case 'action':
          // Dispatch action via custom event
          window.dispatchEvent(
            new CustomEvent('spotlight-action', { detail: result.id }),
          );
          break;

        case 'recent':
          setQuery(result.title);
          return; // Don't close, let user search
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
            placeholder="Search files, folders, actions..."
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
                className={`spotlight-result ${i === selectedIndex ? 'selected' : ''} ${result.type}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="result-icon">{result.icon}</span>
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

// Get file icon based on extension
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    mp4: '🎬',
    mov: '🎬',
    avi: '🎬',
    mkv: '🎬',
    webm: '🎬',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    webp: '🖼️',
    svg: '🖼️',
    mp3: '🎵',
    wav: '🎵',
    flac: '🎵',
    aac: '🎵',
    pdf: '📕',
    doc: '📄',
    docx: '📄',
    xls: '📊',
    xlsx: '📊',
    ppt: '📽️',
    pptx: '📽️',
    zip: '📦',
    rar: '📦',
    '7z': '📦',
    tar: '📦',
    gz: '📦',
    js: '💻',
    ts: '💻',
    tsx: '💻',
    jsx: '💻',
    py: '🐍',
    rs: '🦀',
    go: '🐹',
    json: '📋',
    yaml: '📋',
    yml: '📋',
    md: '📝',
    txt: '📝',
  };
  return iconMap[ext || ''] || '📄';
}

export default SpotlightSearch;
