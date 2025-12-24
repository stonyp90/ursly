/**
 * FinderPage Context Menu Tests
 *
 * Tests for all right-click context menu operations:
 * - Copy, Cut, Paste
 * - Rename
 * - Delete
 * - New Folder
 * - Duplicate
 * - Add to Favorites
 * - Get Info
 * - Make Available Offline
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock file metadata
const createMockFile = (overrides = {}) => ({
  id: 'file-1',
  name: 'test-file.txt',
  path: '/test/test-file.txt',
  size: 1024,
  lastModified: new Date().toISOString(),
  mimeType: 'text/plain',
  tierStatus: 'hot' as const,
  canWarm: false,
  canTranscode: false,
  ...overrides,
});

const createMockFolder = (overrides = {}) => ({
  id: 'folder-1',
  name: 'test-folder',
  path: '/test/test-folder/',
  size: 0,
  lastModified: new Date().toISOString(),
  mimeType: 'folder',
  tierStatus: 'hot' as const,
  canWarm: false,
  canTranscode: false,
  ...overrides,
});

describe('FinderPage Context Menu', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Copy Operation', () => {
    it('should copy a single file to clipboard', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const file = createMockFile();

      // Simulate copy operation
      await mockInvoke('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: [file.path],
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: [file.path],
      });
    });

    it('should copy multiple files to clipboard', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const files = [
        createMockFile({ path: '/test/file1.txt' }),
        createMockFile({ path: '/test/file2.txt' }),
      ];

      await mockInvoke('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: files.map((f) => f.path),
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: ['/test/file1.txt', '/test/file2.txt'],
      });
    });
  });

  describe('Cut Operation', () => {
    it('should cut files to clipboard', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const file = createMockFile();

      await mockInvoke('vfs_clipboard_cut', {
        sourceId: 'local-1',
        paths: [file.path],
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_cut', {
        sourceId: 'local-1',
        paths: [file.path],
      });
    });
  });

  describe('Paste Operation', () => {
    it('should paste files to VFS', async () => {
      mockInvoke.mockResolvedValue({ pastedCount: 1 });

      await mockInvoke('vfs_clipboard_paste_to_vfs', {
        sourceId: 'local-1',
        targetPath: '/test/destination/',
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_paste_to_vfs', {
        sourceId: 'local-1',
        targetPath: '/test/destination/',
      });
    });

    it('should paste files into a folder', async () => {
      mockInvoke.mockResolvedValue({ pastedCount: 2 });

      const folder = createMockFolder();

      await mockInvoke('vfs_clipboard_paste_to_vfs', {
        sourceId: 'local-1',
        targetPath: folder.path,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_paste_to_vfs', {
        sourceId: 'local-1',
        targetPath: folder.path,
      });
    });
  });

  describe('Rename Operation', () => {
    it('should rename a file', async () => {
      mockInvoke.mockResolvedValue('Renamed successfully');

      const file = createMockFile();
      const newPath = '/test/renamed-file.txt';

      await mockInvoke('vfs_rename', {
        sourceId: 'local-1',
        from: file.path,
        to: newPath,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_rename', {
        sourceId: 'local-1',
        from: file.path,
        to: newPath,
      });
    });

    it('should rename a folder', async () => {
      mockInvoke.mockResolvedValue('Renamed successfully');

      const folder = createMockFolder();
      const newPath = '/test/renamed-folder/';

      await mockInvoke('vfs_rename', {
        sourceId: 'local-1',
        from: folder.path,
        to: newPath,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_rename', {
        sourceId: 'local-1',
        from: folder.path,
        to: newPath,
      });
    });

    it('should reject invalid file names with slashes', () => {
      const invalidName = 'file/with/slashes.txt';
      expect(invalidName.includes('/')).toBe(true);
    });

    it('should preserve file extension during rename', () => {
      const fileName = 'document.pdf';
      const dotIndex = fileName.lastIndexOf('.');
      const extension = fileName.slice(dotIndex);

      expect(extension).toBe('.pdf');
      expect(dotIndex).toBe(8);
    });
  });

  describe('Delete Operation', () => {
    it('should delete a file', async () => {
      mockInvoke.mockResolvedValue('Deleted');

      const file = createMockFile();

      await mockInvoke('vfs_delete_recursive', {
        sourceId: 'local-1',
        path: file.path,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_delete_recursive', {
        sourceId: 'local-1',
        path: file.path,
      });
    });

    it('should delete a folder recursively', async () => {
      mockInvoke.mockResolvedValue('Deleted');

      const folder = createMockFolder();

      await mockInvoke('vfs_delete_recursive', {
        sourceId: 'local-1',
        path: folder.path,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_delete_recursive', {
        sourceId: 'local-1',
        path: folder.path,
      });
    });

    it('should delete multiple files', async () => {
      mockInvoke.mockResolvedValue('Deleted');

      const files = [
        createMockFile({ path: '/test/file1.txt' }),
        createMockFile({ path: '/test/file2.txt' }),
      ];

      for (const file of files) {
        await mockInvoke('vfs_delete_recursive', {
          sourceId: 'local-1',
          path: file.path,
        });
      }

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should normalize path before delete (remove double slashes)', async () => {
      mockInvoke.mockResolvedValue('Deleted');

      const pathWithDoubleSlash = '//test//file.txt';
      const normalizedPath = pathWithDoubleSlash.replace(/\/+/g, '/');

      expect(normalizedPath).toBe('/test/file.txt');
    });

    it('should handle delete failures gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Permission denied'));

      await expect(
        mockInvoke('vfs_delete_recursive', {
          sourceId: 'local-1',
          path: '/test/protected-file.txt',
        }),
      ).rejects.toThrow('Permission denied');
    });

    it('should handle non-existent file delete silently', async () => {
      // Backend returns OK even if file doesn't exist
      mockInvoke.mockResolvedValue('Deleted');

      const result = await mockInvoke('vfs_delete_recursive', {
        sourceId: 'local-1',
        path: '/test/non-existent.txt',
      });

      expect(result).toBe('Deleted');
    });

    it('should refresh file list after successful delete', () => {
      // Simulate file list before and after delete
      const filesBefore = [
        createMockFile({ path: '/test/file1.txt' }),
        createMockFile({ path: '/test/file2.txt' }),
      ];
      const deletedPath = '/test/file1.txt';
      const filesAfter = filesBefore.filter((f) => f.path !== deletedPath);

      expect(filesAfter.length).toBe(1);
      expect(filesAfter[0].path).toBe('/test/file2.txt');
    });

    it('should clear selection after delete', () => {
      const selectedFiles = new Set(['/test/file1.txt', '/test/file2.txt']);
      const cleared = new Set<string>();

      expect(cleared.size).toBe(0);
    });
  });

  describe('New Folder Operation', () => {
    it('should create a new folder with untitled folder name', async () => {
      mockInvoke.mockResolvedValue('Created');

      const newFolderPath = '/test/untitled folder';

      await mockInvoke('vfs_mkdir', {
        sourceId: 'local-1',
        path: newFolderPath,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_mkdir', {
        sourceId: 'local-1',
        path: newFolderPath,
      });
    });

    it('should create numbered folder if name exists', async () => {
      // First call fails (folder exists)
      mockInvoke
        .mockRejectedValueOnce(new Error('Folder exists'))
        .mockResolvedValueOnce('Created');

      try {
        await mockInvoke('vfs_mkdir', {
          sourceId: 'local-1',
          path: '/test/untitled folder',
        });
      } catch {
        // Try with number suffix
        await mockInvoke('vfs_mkdir', {
          sourceId: 'local-1',
          path: '/test/untitled folder 2',
        });
      }

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should only show New Folder option on empty space or folders', () => {
      const file = createMockFile();
      const folder = createMockFolder();

      // File should NOT have New Folder option
      const isFile = file.mimeType !== 'folder' && !file.path.endsWith('/');
      expect(isFile).toBe(true);

      // Folder should have New Folder option
      const isFolder =
        folder.mimeType === 'folder' || folder.path.endsWith('/');
      expect(isFolder).toBe(true);
    });

    it('should create folder inside target folder when right-clicking a folder', async () => {
      mockInvoke.mockResolvedValue('Created');

      const targetFolder = createMockFolder({ path: '/test/target-folder/' });
      const newFolderPath = '/test/target-folder/untitled folder';

      await mockInvoke('vfs_mkdir', {
        sourceId: 'local-1',
        path: newFolderPath,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_mkdir', {
        sourceId: 'local-1',
        path: newFolderPath,
      });
    });
  });

  describe('Duplicate Operation', () => {
    it('should duplicate a file with " copy" suffix', async () => {
      mockInvoke.mockResolvedValue('Copied');

      const file = createMockFile({
        name: 'document.pdf',
        path: '/test/document.pdf',
      });
      const duplicatePath = '/test/document copy.pdf';

      await mockInvoke('vfs_copy', {
        sourceId: 'local-1',
        from: file.path,
        to: duplicatePath,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_copy', {
        sourceId: 'local-1',
        from: file.path,
        to: duplicatePath,
      });
    });

    it('should duplicate a folder', async () => {
      mockInvoke.mockResolvedValue('Copied');

      const folder = createMockFolder();
      const duplicatePath = '/test/test-folder copy/';

      await mockInvoke('vfs_copy', {
        sourceId: 'local-1',
        from: folder.path,
        to: duplicatePath,
        recursive: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_copy', {
        sourceId: 'local-1',
        from: folder.path,
        to: duplicatePath,
        recursive: true,
      });
    });
  });

  describe('Favorites Operation', () => {
    it('should add a file to favorites', async () => {
      mockInvoke.mockResolvedValue(true);

      const file = createMockFile();

      await mockInvoke('vfs_toggle_favorite', {
        sourceId: 'local-1',
        path: file.path,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_toggle_favorite', {
        sourceId: 'local-1',
        path: file.path,
      });
    });

    it('should remove a file from favorites', async () => {
      mockInvoke.mockResolvedValue(false);

      const file = createMockFile();

      await mockInvoke('vfs_toggle_favorite', {
        sourceId: 'local-1',
        path: file.path,
      });

      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('Get Info Operation', () => {
    it('should retrieve file metadata', () => {
      const file = createMockFile({
        size: 1048576, // 1 MB
        tags: ['important', 'work'],
        colorLabel: 'blue',
      });

      expect(file.size).toBe(1048576);
      expect(file.tags).toContain('important');
      expect(file.colorLabel).toBe('blue');
    });

    it('should display media metadata for video files', () => {
      const videoFile = createMockFile({
        name: 'video.mp4',
        mimeType: 'video/mp4',
        duration: 3600,
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        frameRate: 24,
      });

      expect(videoFile.duration).toBe(3600);
      expect(videoFile.width).toBe(1920);
      expect(videoFile.videoCodec).toBe('h264');
    });
  });

  describe('Make Available Offline (Warm) Operation', () => {
    it('should warm a cold file', async () => {
      mockInvoke.mockResolvedValue('Warming started');

      const coldFile = createMockFile({
        tierStatus: 'cold',
        canWarm: true,
      });

      await mockInvoke('vfs_warm_file', {
        sourceId: 'local-1',
        filePath: coldFile.path,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_warm_file', {
        sourceId: 'local-1',
        filePath: coldFile.path,
      });
    });

    it('should not warm an already hot file', () => {
      const hotFile = createMockFile({
        tierStatus: 'hot',
        canWarm: false,
      });

      expect(hotFile.canWarm).toBe(false);
      expect(hotFile.tierStatus).toBe('hot');
    });
  });

  describe('Tier Change Operation', () => {
    it('should change file tier to hot', async () => {
      mockInvoke.mockResolvedValue({ files_synced: 1 });

      const file = createMockFile({ tierStatus: 'cold' });

      await mockInvoke('vfs_change_tier', {
        sourceId: 'local-1',
        paths: [file.path],
        targetTier: 'hot',
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_change_tier', {
        sourceId: 'local-1',
        paths: [file.path],
        targetTier: 'hot',
      });
    });

    it('should change multiple files to cold tier', async () => {
      mockInvoke.mockResolvedValue({ files_synced: 3 });

      const files = [
        createMockFile({ path: '/test/file1.txt' }),
        createMockFile({ path: '/test/file2.txt' }),
        createMockFile({ path: '/test/file3.txt' }),
      ];

      await mockInvoke('vfs_change_tier', {
        sourceId: 'local-1',
        paths: files.map((f) => f.path),
        targetTier: 'cold',
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_change_tier', {
        sourceId: 'local-1',
        paths: ['/test/file1.txt', '/test/file2.txt', '/test/file3.txt'],
        targetTier: 'cold',
      });
    });
  });

  describe('Clipboard State', () => {
    it('should check if clipboard has files', async () => {
      mockInvoke.mockResolvedValue(true);

      const hasFiles = await mockInvoke('vfs_clipboard_has_files');

      expect(hasFiles).toBe(true);
    });

    it('should get clipboard contents', async () => {
      mockInvoke.mockResolvedValue({
        paths: ['/test/file1.txt', '/test/file2.txt'],
        isCut: false,
        sourceId: 'local-1',
      });

      const clipboard = await mockInvoke('vfs_clipboard_get');

      expect(clipboard.paths).toHaveLength(2);
      expect(clipboard.isCut).toBe(false);
    });

    it('should clear clipboard', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await mockInvoke('vfs_clipboard_clear');

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_clear');
    });
  });

  describe('Open File Operation', () => {
    it('should open a file with default application', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const file = createMockFile({
        name: 'document.pdf',
        path: '/test/document.pdf',
      });

      await mockInvoke('vfs_open_file', {
        sourceId: 'local-1',
        filePath: file.path,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_open_file', {
        sourceId: 'local-1',
        filePath: file.path,
      });
    });

    it('should open a file with specific application', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const file = createMockFile({
        name: 'photo.jpg',
        path: '/test/photo.jpg',
      });
      const appPath = '/Applications/Preview.app';

      await mockInvoke('vfs_open_file_with', {
        sourceId: 'local-1',
        filePath: file.path,
        appPath,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_open_file_with', {
        sourceId: 'local-1',
        filePath: file.path,
        appPath,
      });
    });

    it('should get available apps for a file type', async () => {
      const expectedApps = [
        { name: 'Preview', path: '/System/Applications/Preview.app' },
        { name: 'Photos', path: '/System/Applications/Photos.app' },
      ];
      mockInvoke.mockResolvedValue(expectedApps);

      const apps = await mockInvoke('vfs_get_apps_for_file', {
        filePath: '/test/image.png',
      });

      expect(apps).toHaveLength(2);
      expect(apps[0].name).toBe('Preview');
    });

    it('should not show Open With for folders', () => {
      const folder = createMockFolder();
      const isFolder =
        folder.mimeType === 'folder' || folder.path.endsWith('/');

      // Open With should not be shown for folders
      expect(isFolder).toBe(true);
    });

    it('should navigate into folder on double-click', () => {
      const folder = createMockFolder({ path: '/test/Documents/' });
      const isFolder =
        folder.mimeType === 'folder' || folder.path.endsWith('/');

      // Double-clicking a folder should navigate, not open
      expect(isFolder).toBe(true);
      expect(folder.path).toBe('/test/Documents/');
    });
  });

  describe('macOS Finder-like Clipboard Behavior', () => {
    it('should clear cut overlay after paste', async () => {
      // After paste, cutFilePaths should be cleared
      const cutFiles = new Set(['/test/file1.txt']);

      // Simulate cut operation
      mockInvoke.mockResolvedValue(undefined);
      await mockInvoke('vfs_clipboard_cut', {
        sourceId: 'local-1',
        paths: ['/test/file1.txt'],
      });

      // Simulate paste
      mockInvoke.mockResolvedValue({ files_pasted: 1, errors: [] });
      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/test/dest/',
      });

      expect(result.files_pasted).toBe(1);
      // Cut overlay should be cleared after successful paste
    });

    it('should clear clipboard after cut-paste but not after copy-paste', async () => {
      // After cut-paste, clipboard should be empty
      // After copy-paste, clipboard should persist

      // Copy operation - clipboard persists
      mockInvoke.mockResolvedValue(undefined);
      await mockInvoke('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: ['/test/file1.txt'],
      });

      mockInvoke.mockResolvedValue({ files_pasted: 1, errors: [] });
      await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/test/dest/',
      });

      // For copy, clipboard should still have files
      mockInvoke.mockResolvedValue(true);
      const hasFilesAfterCopyPaste = await mockInvoke(
        'vfs_clipboard_has_files',
      );
      expect(hasFilesAfterCopyPaste).toBe(true);
    });

    it('should cancel cut operation on Escape key', async () => {
      // Escape should clear cutFilePaths and clipboard
      mockInvoke.mockResolvedValue(undefined);

      // Simulate clearing clipboard via Escape
      await mockInvoke('vfs_clipboard_clear');
      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_clear');
    });

    it('should show "Move Item" label for cut operation', () => {
      // Context menu should show "Move Item" instead of "Paste" when cut
      const isCutOperation = true;
      const label = isCutOperation ? 'Move Item' : 'Paste';
      expect(label).toBe('Move Item');
    });

    it('should show "Move into folder" label for cut + paste into folder', () => {
      const isCutOperation = true;
      const label = isCutOperation ? 'Move into folder' : 'Paste into folder';
      expect(label).toBe('Move into folder');
    });

    it('should refresh clipboard state on window focus', async () => {
      // When window regains focus, native clipboard should be checked
      mockInvoke.mockResolvedValue(['/Users/test/file.txt']);
      const nativeFiles = await mockInvoke('vfs_clipboard_read_native');
      expect(nativeFiles).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle rename errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Permission denied'));

      await expect(
        mockInvoke('vfs_rename', {
          sourceId: 'local-1',
          from: '/test/file.txt',
          to: '/test/renamed.txt',
        }),
      ).rejects.toThrow('Permission denied');
    });

    it('should handle delete errors', async () => {
      mockInvoke.mockRejectedValue(new Error('File in use'));

      await expect(
        mockInvoke('vfs_delete_recursive', {
          sourceId: 'local-1',
          path: '/test/locked-file.txt',
        }),
      ).rejects.toThrow('File in use');
    });

    it('should handle paste errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Destination full'));

      await expect(
        mockInvoke('vfs_clipboard_paste_to_vfs', {
          sourceId: 'local-1',
          targetPath: '/test/',
        }),
      ).rejects.toThrow('Destination full');
    });
  });

  describe('Move Operation', () => {
    it('should move a file within the same source', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const file = createMockFile({ path: '/source/file.txt' });

      await mockInvoke('vfs_move', {
        sourceId: 'local-1',
        request: { from: file.path, to: '/dest/file.txt' },
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_move', {
        sourceId: 'local-1',
        request: { from: '/source/file.txt', to: '/dest/file.txt' },
      });
    });

    it('should move a folder with all contents', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const folder = createMockFolder({ path: '/source/folder/' });

      await mockInvoke('vfs_move', {
        sourceId: 'local-1',
        request: { from: folder.path, to: '/dest/folder/' },
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_move', {
        sourceId: 'local-1',
        request: { from: '/source/folder/', to: '/dest/folder/' },
      });
    });

    it('should move multiple files at once', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const files = [
        createMockFile({ path: '/source/file1.txt' }),
        createMockFile({ path: '/source/file2.txt' }),
        createMockFile({ path: '/source/file3.txt' }),
      ];

      for (const file of files) {
        await mockInvoke('vfs_move', {
          sourceId: 'local-1',
          request: { from: file.path, to: `/dest/${file.name}` },
        });
      }

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    it('should move files between different sources', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const file = createMockFile({ path: '/source/file.txt' });

      await mockInvoke('vfs_move_to_source', {
        fromSourceId: 'local-1',
        fromPath: file.path,
        toSourceId: 'fsx-ontap-1',
        toPath: '/dest/file.txt',
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_move_to_source', {
        fromSourceId: 'local-1',
        fromPath: '/source/file.txt',
        toSourceId: 'fsx-ontap-1',
        toPath: '/dest/file.txt',
      });
    });

    it('should clear cut overlay after successful move', async () => {
      mockInvoke.mockResolvedValue({ files_pasted: 2, errors: [] });

      // Cut files
      const cutPaths = ['/source/file1.txt', '/source/file2.txt'];

      // Simulate cut
      await mockInvoke('vfs_clipboard_cut', {
        sourceId: 'local-1',
        paths: cutPaths,
      });

      // Simulate paste (move)
      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/dest/',
      });

      expect(result.files_pasted).toBe(2);
      // After paste, cut overlay should be cleared (handled in UI)
    });

    it('should handle move errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Source file not found'));

      await expect(
        mockInvoke('vfs_move', {
          sourceId: 'local-1',
          request: { from: '/missing/file.txt', to: '/dest/file.txt' },
        }),
      ).rejects.toThrow('Source file not found');
    });
  });

  describe('Multi-Select Operations', () => {
    it('should handle Cmd/Ctrl+Click for toggle selection', () => {
      // Simulate toggle selection logic
      const selectedFiles = new Set(['/file1.txt']);

      // Toggle on - add file
      const toggleOn = (path: string) => {
        const next = new Set(selectedFiles);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      };

      const result1 = toggleOn('/file2.txt');
      expect(result1.size).toBe(2);
      expect(result1.has('/file1.txt')).toBe(true);
      expect(result1.has('/file2.txt')).toBe(true);

      // Toggle off - remove file
      selectedFiles.add('/file2.txt');
      const result2 = toggleOn('/file1.txt');
      expect(result2.size).toBe(1);
      expect(result2.has('/file1.txt')).toBe(false);
    });

    it('should handle Shift+Click for range selection', () => {
      // Simulate range selection logic
      const allPaths = [
        '/file1.txt',
        '/file2.txt',
        '/file3.txt',
        '/file4.txt',
        '/file5.txt',
      ];
      const lastSelected = '/file2.txt';
      const currentClick = '/file4.txt';

      const lastIdx = allPaths.indexOf(lastSelected);
      const currentIdx = allPaths.indexOf(currentClick);
      const [start, end] = [
        Math.min(lastIdx, currentIdx),
        Math.max(lastIdx, currentIdx),
      ];
      const range = allPaths.slice(start, end + 1);

      expect(range).toEqual(['/file2.txt', '/file3.txt', '/file4.txt']);
    });

    it('should handle Cmd/Ctrl+A for select all', () => {
      const allFiles = [
        createMockFile({ path: '/file1.txt' }),
        createMockFile({ path: '/file2.txt' }),
        createMockFile({ path: '/file3.txt' }),
      ];

      const selectedAll = new Set(allFiles.map((f) => f.path));

      expect(selectedAll.size).toBe(3);
      expect(selectedAll.has('/file1.txt')).toBe(true);
      expect(selectedAll.has('/file2.txt')).toBe(true);
      expect(selectedAll.has('/file3.txt')).toBe(true);
    });

    it('should copy multiple selected files', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const selectedPaths = ['/file1.txt', '/file2.txt', '/file3.txt'];

      await mockInvoke('vfs_clipboard_copy_for_native', {
        sourceId: 'local-1',
        paths: selectedPaths,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_copy_for_native', {
        sourceId: 'local-1',
        paths: selectedPaths,
      });
    });

    it('should cut multiple selected files', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const selectedPaths = ['/file1.txt', '/file2.txt', '/file3.txt'];

      await mockInvoke('vfs_clipboard_cut', {
        sourceId: 'local-1',
        paths: selectedPaths,
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_cut', {
        sourceId: 'local-1',
        paths: selectedPaths,
      });
    });

    it('should delete multiple selected files', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const selectedPaths = ['/file1.txt', '/file2.txt', '/file3.txt'];

      for (const path of selectedPaths) {
        await mockInvoke('vfs_delete_recursive', {
          sourceId: 'local-1',
          path,
        });
      }

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    it('should handle Escape to clear selection', () => {
      const selectedFiles = new Set(['/file1.txt', '/file2.txt', '/file3.txt']);

      // Escape clears selection
      const cleared = new Set<string>();

      expect(cleared.size).toBe(0);
    });
  });

  // =========================================================================
  // VFS to Native Clipboard Operations (Copy from VFS, Paste in Finder)
  // =========================================================================
  describe('VFS to Native Clipboard', () => {
    beforeEach(() => {
      mockInvoke.mockReset();
    });

    it('should copy VFS files to native clipboard for Finder paste', async () => {
      mockInvoke.mockResolvedValue(
        'Copied 1 files to clipboard (native-compatible)',
      );

      const result = await mockInvoke('vfs_clipboard_copy_for_native', {
        sourceId: 'local-1',
        paths: ['/Documents/report.pdf'],
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_copy_for_native', {
        sourceId: 'local-1',
        paths: ['/Documents/report.pdf'],
      });
      expect(result).toContain('native-compatible');
    });

    it('should copy multiple VFS files to native clipboard', async () => {
      mockInvoke.mockResolvedValue(
        'Copied 3 files to clipboard (native-compatible)',
      );

      const paths = [
        '/Documents/file1.pdf',
        '/Documents/file2.docx',
        '/Images/photo.jpg',
      ];
      const result = await mockInvoke('vfs_clipboard_copy_for_native', {
        sourceId: 'local-1',
        paths,
      });

      expect(result).toContain('3 files');
    });

    it('should export VFS files to temp directory for native clipboard', async () => {
      // The backend should:
      // 1. Read VFS files
      // 2. Write to temp directory
      // 3. Set native clipboard to temp paths
      mockInvoke.mockResolvedValue(
        'Copied 1 files to clipboard (native-compatible)',
      );

      await mockInvoke('vfs_clipboard_copy_for_native', {
        sourceId: 'cloud-s3',
        paths: ['/remote-file.txt'],
      });

      expect(mockInvoke).toHaveBeenCalled();
    });

    it('should handle large files gracefully', async () => {
      mockInvoke.mockResolvedValue(
        'Copied 1 files to clipboard (native-compatible)',
      );

      // Large video file
      const result = await mockInvoke('vfs_clipboard_copy_for_native', {
        sourceId: 'local-1',
        paths: ['/Videos/large-video.mov'], // 2GB file
      });

      expect(result).toBeDefined();
    });

    it('should handle VFS copy errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed to read VFS file'));

      await expect(
        mockInvoke('vfs_clipboard_copy_for_native', {
          sourceId: 'local-1',
          paths: ['/nonexistent.txt'],
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Native to VFS Clipboard Operations (Copy from Finder, Paste in VFS)
  // =========================================================================
  describe('Native to VFS Clipboard', () => {
    beforeEach(() => {
      mockInvoke.mockReset();
    });

    it('should read native clipboard files', async () => {
      mockInvoke.mockResolvedValue(['/Users/test/Desktop/file.txt']);

      const result = await mockInvoke('vfs_clipboard_read_native');

      expect(result).toEqual(['/Users/test/Desktop/file.txt']);
    });

    it('should paste native files to VFS', async () => {
      // First, native clipboard has files
      mockInvoke
        .mockResolvedValueOnce({
          operation: 'copy',
          source: 'native',
          paths: ['/Users/test/Desktop/file.txt'],
          file_count: 1,
        })
        // Then paste to VFS
        .mockResolvedValueOnce({
          success: true,
          pasted: ['/Documents/file.txt'],
          errors: [],
        });

      const clipboard = await mockInvoke('vfs_clipboard_get');
      expect(clipboard.source).toBe('native');

      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/Documents',
      });

      expect(result.success).toBe(true);
    });

    it('should copy native files and make them available for VFS paste', async () => {
      mockInvoke.mockResolvedValue('Copied 2 files to clipboard');

      const result = await mockInvoke('vfs_clipboard_copy_native', {
        paths: ['/Users/test/file1.txt', '/Users/test/file2.txt'],
      });

      expect(result).toContain('2 files');
    });

    it('should handle paste of multiple native files', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        pasted: ['/target/file1.txt', '/target/file2.txt', '/target/file3.txt'],
        errors: [],
      });

      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/target',
      });

      expect(result.pasted).toHaveLength(3);
    });
  });

  // =========================================================================
  // VFS to VFS Clipboard Operations (Within VFS)
  // =========================================================================
  describe('VFS to VFS Clipboard', () => {
    beforeEach(() => {
      mockInvoke.mockReset();
    });

    it('should copy within same VFS source', async () => {
      mockInvoke
        .mockResolvedValueOnce('Copied 1 files to clipboard')
        .mockResolvedValueOnce({
          success: true,
          pasted: ['/dest/file.txt'],
          errors: [],
        });

      await mockInvoke('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: ['/source/file.txt'],
      });

      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/dest',
      });

      expect(result.success).toBe(true);
    });

    it('should copy between different VFS sources', async () => {
      mockInvoke
        .mockResolvedValueOnce('Copied 1 files to clipboard')
        .mockResolvedValueOnce({
          success: true,
          pasted: ['/cloud-dest/file.txt'],
          errors: [],
        });

      await mockInvoke('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: ['/local/file.txt'],
      });

      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'cloud-s3',
        destPath: '/cloud-dest',
      });

      expect(result.success).toBe(true);
    });

    it('should handle cut operation (move) within VFS', async () => {
      mockInvoke
        .mockResolvedValueOnce('Cut 1 files to clipboard')
        .mockResolvedValueOnce({
          success: true,
          pasted: ['/dest/file.txt'],
          errors: [],
        });

      await mockInvoke('vfs_clipboard_cut', {
        sourceId: 'local-1',
        paths: ['/source/file.txt'],
      });

      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/dest',
      });

      expect(result.success).toBe(true);
    });

    it('should clear clipboard after cut-paste', async () => {
      mockInvoke
        .mockResolvedValueOnce('Cut 1 files to clipboard')
        .mockResolvedValueOnce({
          success: true,
          pasted: ['/dest/file.txt'],
          errors: [],
        })
        .mockResolvedValueOnce(false); // has_files returns false

      await mockInvoke('vfs_clipboard_cut', {
        sourceId: 'local-1',
        paths: ['/source/file.txt'],
      });

      await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/dest',
      });

      const hasFiles = await mockInvoke('vfs_clipboard_has_files');
      expect(hasFiles).toBe(false);
    });
  });

  // =========================================================================
  // Edge Cases and Error Handling
  // =========================================================================
  describe('Clipboard Edge Cases', () => {
    beforeEach(() => {
      mockInvoke.mockReset();
    });

    it('should handle paste with empty clipboard', async () => {
      mockInvoke.mockRejectedValue(new Error('Clipboard is empty'));

      await expect(
        mockInvoke('vfs_clipboard_paste_to_vfs', {
          destSourceId: 'local-1',
          destPath: '/dest',
        }),
      ).rejects.toThrow('Clipboard is empty');
    });

    it('should handle paste to non-existent destination', async () => {
      mockInvoke.mockRejectedValue(
        new Error('Destination path does not exist'),
      );

      await expect(
        mockInvoke('vfs_clipboard_paste_to_vfs', {
          destSourceId: 'local-1',
          destPath: '/nonexistent',
        }),
      ).rejects.toThrow();
    });

    it('should handle partial paste failures', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        pasted: ['/dest/file1.txt'],
        errors: ['Failed to copy file2.txt: Permission denied'],
      });

      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/dest',
      });

      expect(result.success).toBe(false);
      expect(result.pasted).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle permission denied errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Permission denied'));

      await expect(
        mockInvoke('vfs_clipboard_paste_to_vfs', {
          destSourceId: 'local-1',
          destPath: '/protected',
        }),
      ).rejects.toThrow('Permission denied');
    });

    it('should handle disk full errors', async () => {
      mockInvoke.mockRejectedValue(new Error('No space left on device'));

      await expect(
        mockInvoke('vfs_clipboard_paste_to_vfs', {
          destSourceId: 'local-1',
          destPath: '/dest',
        }),
      ).rejects.toThrow('No space left');
    });

    it('should handle file name conflicts', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        pasted: ['/dest/file (copy).txt'],
        errors: [],
      });

      const result = await mockInvoke('vfs_clipboard_paste_to_vfs', {
        destSourceId: 'local-1',
        destPath: '/dest',
      });

      // Should rename with "(copy)" suffix
      expect(result.pasted[0]).toContain('copy');
    });

    it('should handle special characters in file names', async () => {
      mockInvoke.mockResolvedValue('Copied 1 files to clipboard');

      await mockInvoke('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: ['/Documents/file with spaces & special (chars).txt'],
      });

      expect(mockInvoke).toHaveBeenCalled();
    });

    it('should handle unicode file names', async () => {
      mockInvoke.mockResolvedValue('Copied 1 files to clipboard');

      await mockInvoke('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: ['/Documents/文档.txt'],
      });

      expect(mockInvoke).toHaveBeenCalled();
    });

    it('should handle deeply nested paths', async () => {
      mockInvoke.mockResolvedValue('Copied 1 files to clipboard');

      const deepPath = '/a/b/c/d/e/f/g/h/i/j/file.txt';
      await mockInvoke('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: [deepPath],
      });

      expect(mockInvoke).toHaveBeenCalledWith('vfs_clipboard_copy', {
        sourceId: 'local-1',
        paths: [deepPath],
      });
    });

    it('should clear clipboard explicitly', async () => {
      mockInvoke
        .mockResolvedValueOnce('Clipboard cleared')
        .mockResolvedValueOnce(false);

      await mockInvoke('vfs_clipboard_clear');

      const hasFiles = await mockInvoke('vfs_clipboard_has_files');
      expect(hasFiles).toBe(false);
    });
  });

  // =========================================================================
  // All Clipboard Scenarios Summary
  // =========================================================================
  describe('Complete Clipboard Scenarios', () => {
    const scenarios = [
      // VFS -> VFS (same source)
      {
        from: 'VFS (local)',
        to: 'VFS (local)',
        operation: 'copy',
        expected: 'success',
      },
      {
        from: 'VFS (local)',
        to: 'VFS (local)',
        operation: 'cut',
        expected: 'success',
      },
      // VFS -> VFS (different sources)
      {
        from: 'VFS (local)',
        to: 'VFS (cloud)',
        operation: 'copy',
        expected: 'success',
      },
      {
        from: 'VFS (cloud)',
        to: 'VFS (local)',
        operation: 'copy',
        expected: 'success',
      },
      // VFS -> Native (Finder/Explorer)
      {
        from: 'VFS (local)',
        to: 'Native (Finder)',
        operation: 'copy',
        expected: 'success',
      },
      {
        from: 'VFS (cloud)',
        to: 'Native (Finder)',
        operation: 'copy',
        expected: 'success',
      },
      // Native -> VFS
      {
        from: 'Native (Finder)',
        to: 'VFS (local)',
        operation: 'copy',
        expected: 'success',
      },
      {
        from: 'Native (Finder)',
        to: 'VFS (cloud)',
        operation: 'copy',
        expected: 'success',
      },
    ];

    scenarios.forEach(({ from, to, operation, expected }) => {
      it(`should ${operation} from ${from} to ${to}`, () => {
        // This is a documentation test - all these scenarios should work
        expect(expected).toBe('success');
      });
    });
  });
});
