/**
 * UnifiedFinderPage - Auto-routing Finder component
 *
 * Automatically selects the appropriate Finder implementation based on
 * the current deployment mode:
 *
 * - cloud-gpu / workstation: Full FinderPage with native Tauri access
 * - browser-only: BrowserFinderPage with API-based metadata access
 */

import React, { Suspense } from 'react';
import { useDeploymentMode } from '../hooks';
import '../styles/finder.css';

// Lazy load the components to improve initial load time
const FinderPage = React.lazy(() =>
  import('./FinderPage').then((m) => ({ default: m.FinderPage })),
);
const BrowserFinderPage = React.lazy(() =>
  import('./BrowserFinderPage').then((m) => ({ default: m.BrowserFinderPage })),
);

/**
 * Loading spinner for lazy-loaded components
 */
function FinderLoading() {
  return (
    <div className="finder">
      <div className="finder-loading">
        <div className="loading-spinner" />
        <span>Loading File System...</span>
      </div>
    </div>
  );
}

/**
 * Unified Finder that routes to the appropriate implementation
 */
export function UnifiedFinderPage() {
  const { mode, isLoading } = useDeploymentMode();

  if (isLoading) {
    return <FinderLoading />;
  }

  return (
    <Suspense fallback={<FinderLoading />}>
      {mode === 'browser-only' ? <BrowserFinderPage /> : <FinderPage />}
    </Suspense>
  );
}

export default UnifiedFinderPage;
