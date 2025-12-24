import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Star, Tag, Plus, X, Palette, MessageSquare } from 'lucide-react';
import './TagEditor.css';

// Color labels matching Finder
const COLOR_LABELS = [
  { name: 'red', hex: '#FF3B30', label: 'Red' },
  { name: 'orange', hex: '#FF9500', label: 'Orange' },
  { name: 'yellow', hex: '#FFCC00', label: 'Yellow' },
  { name: 'green', hex: '#34C759', label: 'Green' },
  { name: 'blue', hex: '#007AFF', label: 'Blue' },
  { name: 'purple', hex: '#AF52DE', label: 'Purple' },
  { name: 'gray', hex: '#8E8E93', label: 'Gray' },
] as const;

interface FileTag {
  name: string;
  color?: string;
}

interface FileMetadata {
  tags: FileTag[];
  is_favorite: boolean;
  color_label: string | null;
  rating: number | null;
  comment: string | null;
}

interface TagEditorProps {
  sourceId: string;
  path: string;
  fileName: string;
  onClose?: () => void;
  onMetadataChange?: (metadata: FileMetadata) => void;
}

// localStorage key prefix
const STORAGE_KEY_PREFIX = 'vfs_metadata_';

// Get localStorage key for a file
const getStorageKey = (sourceId: string, path: string) =>
  `${STORAGE_KEY_PREFIX}${sourceId}:${path}`;

// Load metadata from localStorage
const loadFromLocalStorage = (
  sourceId: string,
  path: string,
): FileMetadata | null => {
  try {
    const key = getStorageKey(sourceId, path);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

// Save metadata to localStorage
const saveToLocalStorage = (
  sourceId: string,
  path: string,
  metadata: FileMetadata,
) => {
  try {
    const key = getStorageKey(sourceId, path);
    localStorage.setItem(key, JSON.stringify(metadata));

    // Track dirty items for sync
    const dirtyKey = 'vfs_metadata_dirty';
    const dirty = JSON.parse(localStorage.getItem(dirtyKey) || '[]');
    const itemKey = `${sourceId}:${path}`;
    if (!dirty.includes(itemKey)) {
      dirty.push(itemKey);
      localStorage.setItem(dirtyKey, JSON.stringify(dirty));
    }
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

export const TagEditor: React.FC<TagEditorProps> = ({
  sourceId,
  path,
  fileName,
  onClose,
  onMetadataChange,
}) => {
  const [metadata, setMetadata] = useState<FileMetadata>({
    tags: [],
    is_favorite: false,
    color_label: null,
    rating: null,
    comment: null,
  });
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#007AFF');
  const [showCommentEditor, setShowCommentEditor] = useState(false);
  const [comment, setComment] = useState('');
  const [availableTags, setAvailableTags] = useState<FileTag[]>([]);
  const [loading, setLoading] = useState(true);

  // Load metadata on mount
  useEffect(() => {
    const loadMetadata = async () => {
      setLoading(true);

      // First check localStorage
      const localData = loadFromLocalStorage(sourceId, path);
      if (localData) {
        setMetadata(localData);
        setComment(localData.comment || '');
      }

      // Then try to load from Tauri backend
      try {
        const data = await invoke<FileMetadata | null>('vfs_get_metadata', {
          sourceId,
          path,
        });

        if (data) {
          setMetadata(data);
          setComment(data.comment || '');
          saveToLocalStorage(sourceId, path, data);
        }

        // Load available tags
        const tags = await invoke<FileTag[]>('vfs_list_all_tags', { sourceId });
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load metadata:', error);
      }

      setLoading(false);
    };

    loadMetadata();
  }, [sourceId, path]);

  // Update handler
  const updateMetadata = useCallback(
    (updates: Partial<FileMetadata>) => {
      const newMetadata = { ...metadata, ...updates };
      setMetadata(newMetadata);
      saveToLocalStorage(sourceId, path, newMetadata);
      onMetadataChange?.(newMetadata);
    },
    [metadata, sourceId, path, onMetadataChange],
  );

  // Toggle favorite
  const toggleFavorite = async () => {
    try {
      const result = await invoke<boolean>('vfs_toggle_favorite', {
        sourceId,
        path,
      });
      updateMetadata({ is_favorite: result });
    } catch (error) {
      // Fallback to local-only
      updateMetadata({ is_favorite: !metadata.is_favorite });
    }
  };

  // Add tag
  const addTag = async () => {
    if (!newTagName.trim()) return;

    const tag: FileTag = { name: newTagName.trim(), color: newTagColor };

    try {
      await invoke('vfs_add_tag', {
        sourceId,
        path,
        tagName: tag.name,
        tagColor: tag.color,
      });
    } catch (error) {
      console.error('Failed to add tag:', error);
    }

    // Update local state
    const newTags = [...metadata.tags.filter((t) => t.name !== tag.name), tag];
    updateMetadata({ tags: newTags });
    setNewTagName('');

    // Add to available tags if not exists
    if (!availableTags.some((t) => t.name === tag.name)) {
      setAvailableTags([...availableTags, tag]);
    }
  };

  // Remove tag
  const removeTag = async (tagName: string) => {
    try {
      await invoke('vfs_remove_tag', { sourceId, path, tagName });
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }

    updateMetadata({ tags: metadata.tags.filter((t) => t.name !== tagName) });
  };

  // Add existing tag
  const addExistingTag = async (tag: FileTag) => {
    if (metadata.tags.some((t) => t.name === tag.name)) return;

    try {
      await invoke('vfs_add_tag', {
        sourceId,
        path,
        tagName: tag.name,
        tagColor: tag.color,
      });
    } catch (error) {
      console.error('Failed to add tag:', error);
    }

    updateMetadata({ tags: [...metadata.tags, tag] });
  };

  // Set color label
  const setColorLabel = async (color: string | null) => {
    try {
      await invoke('vfs_set_color_label', { sourceId, path, color });
    } catch (error) {
      console.error('Failed to set color:', error);
    }

    updateMetadata({ color_label: color });
  };

  // Set rating
  const setRating = async (rating: number | null) => {
    try {
      await invoke('vfs_set_rating', { sourceId, path, rating });
    } catch (error) {
      console.error('Failed to set rating:', error);
    }

    updateMetadata({ rating });
  };

  // Save comment
  const saveComment = async () => {
    const trimmedComment = comment.trim() || null;

    try {
      await invoke('vfs_set_comment', {
        sourceId,
        path,
        comment: trimmedComment,
      });
    } catch (error) {
      console.error('Failed to save comment:', error);
    }

    updateMetadata({ comment: trimmedComment });
    setShowCommentEditor(false);
  };

  if (loading) {
    return (
      <div className="tag-editor tag-editor-loading">
        <div className="tag-editor-spinner" />
      </div>
    );
  }

  return (
    <div className="tag-editor">
      {/* Header */}
      <div className="tag-editor-header">
        <h3 className="tag-editor-title">{fileName}</h3>
        {onClose && (
          <button className="tag-editor-close" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Favorite Button */}
      <div className="tag-editor-section">
        <button
          className={`tag-editor-favorite ${metadata.is_favorite ? 'active' : ''}`}
          onClick={toggleFavorite}
        >
          <Star
            size={18}
            fill={metadata.is_favorite ? 'currentColor' : 'none'}
          />
          <span>{metadata.is_favorite ? 'Favorited' : 'Add to Favorites'}</span>
        </button>
      </div>

      {/* Color Labels */}
      <div className="tag-editor-section">
        <div className="tag-editor-section-header">
          <Palette size={14} />
          <span>Color Label</span>
        </div>
        <div className="tag-editor-colors">
          {COLOR_LABELS.map((color) => (
            <button
              key={color.name}
              className={`tag-editor-color-btn ${metadata.color_label === color.name ? 'active' : ''}`}
              style={{ backgroundColor: color.hex }}
              onClick={() => setColorLabel(color.name)}
              title={color.label}
            />
          ))}
          {metadata.color_label && (
            <button
              className="tag-editor-color-clear"
              onClick={() => setColorLabel(null)}
              title="Clear color"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Rating */}
      <div className="tag-editor-section">
        <div className="tag-editor-section-header">
          <Star size={14} />
          <span>Rating</span>
        </div>
        <div className="tag-editor-rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className={`tag-editor-star ${(metadata.rating || 0) >= star ? 'active' : ''}`}
              onClick={() => setRating(metadata.rating === star ? null : star)}
            >
              <Star
                size={20}
                fill={(metadata.rating || 0) >= star ? 'currentColor' : 'none'}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="tag-editor-section">
        <div className="tag-editor-section-header">
          <Tag size={14} />
          <span>Tags</span>
        </div>

        {/* Current tags */}
        <div className="tag-editor-tags">
          {metadata.tags.map((tag) => (
            <span
              key={tag.name}
              className="tag-editor-tag"
              style={{ borderColor: tag.color || '#8E8E93' }}
            >
              <span
                className="tag-editor-tag-dot"
                style={{ backgroundColor: tag.color || '#8E8E93' }}
              />
              {tag.name}
              <button
                className="tag-editor-tag-remove"
                onClick={() => removeTag(tag.name)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>

        {/* Add new tag */}
        <div className="tag-editor-add-tag">
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className="tag-editor-color-input"
            title="Tag color"
          />
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag..."
            className="tag-editor-tag-input"
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
          />
          <button
            className="tag-editor-add-btn"
            onClick={addTag}
            disabled={!newTagName.trim()}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Available tags (suggestions) */}
        {availableTags.length > 0 && (
          <div className="tag-editor-suggestions">
            <span className="tag-editor-suggestions-label">Add existing:</span>
            {availableTags
              .filter((t) => !metadata.tags.some((mt) => mt.name === t.name))
              .slice(0, 5)
              .map((tag) => (
                <button
                  key={tag.name}
                  className="tag-editor-suggestion"
                  onClick={() => addExistingTag(tag)}
                  style={{ borderColor: tag.color || '#8E8E93' }}
                >
                  <span
                    className="tag-editor-tag-dot"
                    style={{ backgroundColor: tag.color || '#8E8E93' }}
                  />
                  {tag.name}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Comment */}
      <div className="tag-editor-section">
        <div className="tag-editor-section-header">
          <MessageSquare size={14} />
          <span>Comment</span>
        </div>

        {showCommentEditor ? (
          <div className="tag-editor-comment-editor">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note..."
              className="tag-editor-comment-textarea"
              rows={3}
            />
            <div className="tag-editor-comment-actions">
              <button
                className="tag-editor-btn tag-editor-btn-secondary"
                onClick={() => {
                  setComment(metadata.comment || '');
                  setShowCommentEditor(false);
                }}
              >
                Cancel
              </button>
              <button
                className="tag-editor-btn tag-editor-btn-primary"
                onClick={saveComment}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <button
            className="tag-editor-comment-btn"
            onClick={() => setShowCommentEditor(true)}
          >
            {metadata.comment || 'Add a comment...'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TagEditor;
