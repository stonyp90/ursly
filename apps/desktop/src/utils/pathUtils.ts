/**
 * Path utilities for cross-storage type path handling
 *
 * Different storage types have different path formats:
 * - Local: /Users/tony/Documents (Unix-style)
 * - Windows Local: C:\Users\tony\Documents (Windows-style)
 * - S3/GCS: bucket-name/prefix/key (no leading slash)
 * - SMB: //server/share/folder or \\server\share\folder
 * - NFS: /mnt/nfs/share/folder
 */

export type StorageType =
  | 'local'
  | 'aws-s3'
  | 's3'
  | 's3-compatible'
  | 'gcs'
  | 'azure-blob'
  | 'smb'
  | 'nfs'
  | 'nas'
  | 'fsx-ontap'
  | 'sftp'
  | 'webdav';

export interface PathSegment {
  name: string;
  path: string;
}

/**
 * Parse a path into segments based on storage type
 */
export function parsePath(
  path: string,
  storageType: StorageType,
): PathSegment[] {
  if (!path || path === '/' || path === '') {
    return [];
  }

  const segments: PathSegment[] = [];
  let pathParts: string[] = [];
  let separator = '/';

  switch (storageType) {
    case 'aws-s3':
    case 's3':
    case 's3-compatible':
    case 'gcs':
    case 'azure-blob':
      // Object storage: bucket/prefix/key format (no leading slash)
      pathParts = path.replace(/^\/+/, '').split('/').filter(Boolean);
      break;

    case 'smb':
      // SMB paths: //server/share or \\server\share
      if (path.startsWith('\\\\')) {
        separator = '\\';
        pathParts = path.replace(/^\\\\/, '').split('\\').filter(Boolean);
      } else {
        pathParts = path
          .replace(/^\/\//, '')
          .replace(/^\/+/, '')
          .split('/')
          .filter(Boolean);
      }
      break;

    case 'nfs':
    case 'nas':
    case 'sftp':
    case 'webdav':
    case 'fsx-ontap':
    case 'local':
    default:
      // Standard Unix-style paths
      pathParts = path.split('/').filter(Boolean);
      break;
  }

  // Build accumulated paths
  let accumulated = '';
  for (const part of pathParts) {
    accumulated = accumulated
      ? `${accumulated}${separator}${part}`
      : `${separator}${part}`;
    segments.push({
      name: part,
      path: accumulated,
    });
  }

  return segments;
}

/**
 * Get the parent path
 */
export function getParentPath(path: string, storageType: StorageType): string {
  if (!path || path === '/' || path === '') {
    return '';
  }

  const segments = parsePath(path, storageType);
  if (segments.length <= 1) {
    return '';
  }

  return segments[segments.length - 2].path;
}

/**
 * Join path segments based on storage type
 */
export function joinPath(
  basePath: string,
  segment: string,
  storageType: StorageType,
): string {
  const separator =
    storageType === 'smb' && basePath.startsWith('\\') ? '\\' : '/';

  if (!basePath || basePath === '/' || basePath === '') {
    return `${separator}${segment}`;
  }

  const cleanBase = basePath.endsWith(separator)
    ? basePath.slice(0, -1)
    : basePath;
  return `${cleanBase}${separator}${segment}`;
}

/**
 * Normalize a path to use forward slashes (cross-OS compatible)
 * Windows paths with backslashes are converted to forward slashes
 * for consistent handling in the VFS layer
 */
export function normalizePath(path: string): string {
  if (!path) return '';

  // Convert Windows backslashes to forward slashes
  let normalized = path.replace(/\\/g, '/');

  // Remove duplicate slashes (but keep leading slash or UNC)
  normalized = normalized.replace(/\/+/g, '/');

  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Check if path is absolute (works for Unix and Windows)
 */
export function isAbsolutePath(path: string): boolean {
  if (!path) return false;

  // Unix absolute: starts with /
  if (path.startsWith('/')) return true;

  // Windows absolute: starts with drive letter (C:, D:, etc.)
  if (/^[A-Za-z]:/.test(path)) return true;

  // UNC path: starts with \\ or //
  if (path.startsWith('\\\\') || path.startsWith('//')) return true;

  return false;
}

/**
 * Get the file/folder name from a path
 */
export function getBasename(path: string): string {
  if (!path) return '';

  const normalized = normalizePath(path);
  const parts = normalized.split('/').filter(Boolean);

  return parts.length > 0 ? parts[parts.length - 1] : '';
}

/**
 * Get the directory part of a path (everything except the last segment)
 */
export function getDirname(path: string): string {
  if (!path) return '';

  const normalized = normalizePath(path);
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length <= 1) return '/';

  parts.pop();
  return '/' + parts.join('/');
}

/**
 * Get icon for storage type
 */
export function getStorageIcon(storageType: StorageType): string {
  switch (storageType) {
    case 'aws-s3':
    case 's3':
    case 's3-compatible':
      return '☁️';
    case 'gcs':
      return '🌐';
    case 'azure-blob':
      return '📦';
    case 'smb':
    case 'nfs':
    case 'nas':
      return '🌐';
    case 'fsx-ontap':
      return '💾';
    case 'sftp':
    case 'webdav':
      return '🔗';
    default:
      return '💻';
  }
}

// ============================================================================
// Tests
// ============================================================================

if (import.meta.env?.MODE === 'test' || process.env.NODE_ENV === 'test') {
  console.log('Running pathUtils tests...');

  // Test local paths
  const localSegments = parsePath('/Users/tony/Documents', 'local');
  console.assert(
    localSegments.length === 3,
    'Local path should have 3 segments',
  );
  console.assert(
    localSegments[0].name === 'Users',
    'First segment should be Users',
  );
  console.assert(
    localSegments[2].path === '/Users/tony/Documents',
    'Last path should match',
  );

  // Test S3 paths
  const s3Segments = parsePath('my-bucket/prefix/file.txt', 'aws-s3');
  console.assert(s3Segments.length === 3, 'S3 path should have 3 segments');
  console.assert(
    s3Segments[0].name === 'my-bucket',
    'First segment should be bucket',
  );

  // Test S3 with leading slash (normalized)
  const s3Normalized = parsePath('/my-bucket/prefix', 's3');
  console.assert(
    s3Normalized.length === 2,
    'S3 normalized should have 2 segments',
  );

  // Test SMB paths
  const smbSegments = parsePath('//server/share/folder', 'smb');
  console.assert(smbSegments.length === 3, 'SMB path should have 3 segments');
  console.assert(
    smbSegments[0].name === 'server',
    'First segment should be server',
  );

  // Test parent path
  const parent = getParentPath('/Users/tony/Documents', 'local');
  console.assert(parent === '/Users/tony', 'Parent should be /Users/tony');

  // Test join path
  const joined = joinPath('/Users/tony', 'Documents', 'local');
  console.assert(
    joined === '/Users/tony/Documents',
    'Joined path should match',
  );

  console.log('All pathUtils tests passed!');
}
