/**
 * AssetDetailsPanel (InfoModal) - DAM/MAM-style asset metadata panel
 *
 * Industry-standard asset management panel displaying:
 * - General info (name, size, location, dates)
 * - Storage info (tier, cached, source)
 * - Media technical metadata (for video/audio files)
 * - Organization (tags, color labels, comments)
 * - Project/Client/Department assignment
 * - Approval workflow status
 * - Usage rights and licensing
 * - Custom metadata fields
 *
 * Terminology follows DAM/MAM industry standards:
 * - "Asset Details" instead of "Get Info"
 * - "Tags" for searchable keywords
 * - "Metadata" for technical information
 */
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileMetadata } from '../../types/storage';
import {
  IconFolderCyber,
  getFileIcon as getFileIconComponent,
  IconStar,
} from '../CyberpunkIcons';
import './InfoModal.css';

interface FileTag {
  name: string;
  color?: string;
}

interface InfoModalProps {
  file: FileMetadata;
  sourceId?: string;
  onClose: () => void;
  onToggleFavorite?: (file: FileMetadata) => void;
  onAddTag?: (file: FileMetadata, tag: string) => void;
  onRemoveTag?: (file: FileMetadata, tag: string) => void;
  onSetColorLabel?: (file: FileMetadata, color: string | null) => void;
  onUpdateComments?: (file: FileMetadata, comments: string) => void;
  isFavorite?: boolean;
}

// Color labels use CSS variables for theme consistency
// Colors are derived from theme with slight variations
const COLOR_LABELS = [
  { name: 'None', value: null, color: 'transparent' },
  { name: 'Primary', value: 'primary', color: 'var(--primary)' },
  { name: 'Secondary', value: 'secondary', color: 'var(--secondary)' },
  { name: 'Accent', value: 'accent', color: 'var(--accent)' },
  { name: 'Success', value: 'success', color: 'var(--success)' },
  { name: 'Warning', value: 'warning', color: 'var(--warning)' },
  { name: 'Error', value: 'error', color: 'var(--error)' },
  { name: 'Muted', value: 'muted', color: 'var(--text-muted)' },
];

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatBitrate(kbps: number | undefined): string {
  if (!kbps) return '—';
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} kbps`;
}

function getAudioChannelLabel(channels: number | undefined): string {
  if (!channels) return '—';
  switch (channels) {
    case 1:
      return 'Mono';
    case 2:
      return 'Stereo';
    case 6:
      return '5.1 Surround';
    case 8:
      return '7.1 Surround';
    default:
      return `${channels} channels`;
  }
}

function getResolutionLabel(
  width: number | undefined,
  height: number | undefined,
): string {
  if (!width || !height) return '—';

  // Determine resolution name
  if (height >= 2160) return `4K UHD (${width}×${height})`;
  if (height >= 1440) return `2K QHD (${width}×${height})`;
  if (height >= 1080) return `Full HD (${width}×${height})`;
  if (height >= 720) return `HD (${width}×${height})`;
  if (height >= 480) return `SD (${width}×${height})`;
  return `${width}×${height}`;
}

function getHdrLabel(hdrFormat: string | undefined): string {
  if (!hdrFormat) return 'SDR';
  switch (hdrFormat.toLowerCase()) {
    case 'hdr10':
      return 'HDR10';
    case 'hdr10+':
      return 'HDR10+';
    case 'dolby_vision':
      return 'Dolby Vision';
    case 'hlg':
      return 'HLG';
    default:
      return hdrFormat.toUpperCase();
  }
}

function getTierLabel(tier: string): { label: string; class: string } {
  switch (tier) {
    case 'hot':
      return { label: 'Hot (Instant)', class: 'tier-hot' };
    case 'warm':
      return { label: 'Warm (Fast)', class: 'tier-warm' };
    case 'cold':
      return { label: 'Cold (Minutes)', class: 'tier-cold' };
    case 'nearline':
      return { label: 'Nearline (Minutes-Hours)', class: 'tier-nearline' };
    case 'archive':
      return { label: 'Archive (Hours)', class: 'tier-archive' };
    default:
      return { label: tier, class: '' };
  }
}

function getAssetCategoryLabel(category: string | undefined): string {
  switch (category) {
    case 'raw':
      return 'Raw Footage';
    case 'edit':
      return 'Edit/Work in Progress';
    case 'final':
      return 'Final/Approved';
    case 'archive':
      return 'Archive';
    case 'proxy':
      return 'Proxy/Preview';
    case 'other':
      return 'Other';
    default:
      return 'Not Categorized';
  }
}

function getApprovalStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'pending':
      return 'Pending Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'review':
      return 'In Review';
    default:
      return 'Pending Review';
  }
}

/**
 * Get suggested tags based on file type (DAM/MAM feature)
 * Provides intelligent tag suggestions for better asset organization
 */
function getSuggestedTags(file: FileMetadata): string[] {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.mimeType?.toLowerCase() || '';
  const suggestions: string[] = [];

  // Video suggestions
  if (
    mimeType.startsWith('video/') ||
    ['mp4', 'mov', 'avi', 'mkv', 'prores', 'mxf'].includes(extension)
  ) {
    suggestions.push(
      'video',
      'footage',
      'b-roll',
      'interview',
      'raw',
      'edit',
      'final',
      'proxy',
    );
  }

  // Audio suggestions
  if (
    mimeType.startsWith('audio/') ||
    ['mp3', 'wav', 'aiff', 'flac', 'm4a'].includes(extension)
  ) {
    suggestions.push(
      'audio',
      'music',
      'voiceover',
      'sfx',
      'soundtrack',
      'mix',
      'stem',
    );
  }

  // Image suggestions
  if (
    mimeType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'tiff', 'psd', 'raw', 'cr2', 'arw'].includes(
      extension,
    )
  ) {
    suggestions.push(
      'image',
      'photo',
      'still',
      'thumbnail',
      'screenshot',
      'artwork',
      'logo',
    );
  }

  // Document suggestions
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) {
    suggestions.push(
      'document',
      'script',
      'storyboard',
      'contract',
      'brief',
      'notes',
    );
  }

  // Project file suggestions
  if (['prproj', 'aep', 'psd', 'ai', 'fcp', 'drp'].includes(extension)) {
    suggestions.push('project', 'source', 'working', 'master');
  }

  // Common workflow tags
  suggestions.push('review', 'approved', 'archive', 'hero', 'selects');

  return [...new Set(suggestions)]; // Remove duplicates
}

export const InfoModal: React.FC<InfoModalProps> = ({
  file,
  sourceId,
  onClose,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  onSetColorLabel,
  onUpdateComments,
  isFavorite = false,
}) => {
  const [newTag, setNewTag] = useState('');
  const [comments, setComments] = useState(file.comments || '');
  const [isEditingComments, setIsEditingComments] = useState(false);
  const [availableTags, setAvailableTags] = useState<FileTag[]>([]);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  // Load available tags with colors
  useEffect(() => {
    const loadTags = async () => {
      try {
        // Try to get tags from Tauri backend if available
        if (
          sourceId &&
          typeof window !== 'undefined' &&
          '__TAURI_INTERNALS__' in window
        ) {
          const tags = await invoke<FileTag[]>('vfs_list_all_tags', {
            sourceId,
          });
          setAvailableTags(tags);

          // Create a map of tag names to colors
          const colorMap: Record<string, string> = {};
          tags.forEach((tag) => {
            if (tag.color) {
              colorMap[tag.name] = tag.color;
            }
          });
          setTagColors(colorMap);
        }
      } catch (error) {
        // Fallback: try to get from localStorage
        console.debug('Failed to load tags from backend:', error);
      }
    };

    loadTags();
  }, [sourceId]);

  const isFolder = file.mimeType === 'folder' || file.path.endsWith('/');
  const isMedia =
    file.mimeType?.startsWith('video/') || file.mimeType?.startsWith('audio/');
  const isVideo = file.mimeType?.startsWith('video/');

  const tierInfo = getTierLabel(file.tierStatus);

  const handleAddTag = () => {
    if (newTag.trim() && onAddTag) {
      onAddTag(file, newTag.trim());
      setNewTag('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  };

  const handleSaveComments = () => {
    if (onUpdateComments) {
      onUpdateComments(file, comments);
    }
    setIsEditingComments(false);
  };

  // Get file icon
  const FileIcon = isFolder
    ? () => <IconFolderCyber size={64} glow />
    : () => {
        const IconComponent = getFileIconComponent(file.name, file.mimeType);
        return <IconComponent size={64} glow />;
      };

  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="info-header">
          <div className="info-header-icon">
            <FileIcon />
          </div>
          <div className="info-header-title">
            <h2>{file.name}</h2>
            <span className="info-kind">{file.mimeType || 'Unknown'}</span>
          </div>
          <button className="info-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Content */}
        <div className="info-content">
          {/* General Info Section */}
          <section className="info-section">
            <h3 className="info-section-title">General</h3>
            <div className="info-grid">
              <div className="info-field">
                <span className="info-label">Kind</span>
                <span className="info-value">
                  {file.mimeType || (isFolder ? 'Folder' : 'File')}
                </span>
              </div>
              <div className="info-field">
                <span className="info-label">Size</span>
                <span className="info-value">
                  {file.size_human || `${file.size.toLocaleString()} bytes`}
                </span>
              </div>
              <div className="info-field full-width">
                <span className="info-label">Location</span>
                <span className="info-value path">{file.path}</span>
              </div>
              <div className="info-field">
                <span className="info-label">Modified</span>
                <span className="info-value">
                  {new Date(file.lastModified).toLocaleString()}
                </span>
              </div>
              {file.createdAt && (
                <div className="info-field">
                  <span className="info-label">Created</span>
                  <span className="info-value">
                    {new Date(file.createdAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Storage Info Section */}
          <section className="info-section">
            <h3 className="info-section-title">Storage</h3>
            <div className="info-grid">
              <div className="info-field">
                <span className="info-label">Tier</span>
                <span className={`info-value tier-badge ${tierInfo.class}`}>
                  {tierInfo.label}
                </span>
              </div>
              <div className="info-field">
                <span className="info-label">Cached</span>
                <span
                  className={`info-value ${file.isCached ? 'cached-yes' : 'cached-no'}`}
                >
                  {file.isCached ? 'Yes' : 'No'}
                </span>
              </div>
              {file.canWarm && (
                <div className="info-field">
                  <span className="info-label">Status</span>
                  <span className="info-value">
                    {file.isWarmed ? 'Warmed' : 'Requires warming'}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Media Info Section (only for video/audio) */}
          {isMedia && (
            <section className="info-section">
              <h3 className="info-section-title">Media</h3>
              <div className="info-grid">
                {file.duration !== undefined && (
                  <div className="info-field">
                    <span className="info-label">Duration</span>
                    <span className="info-value">
                      {formatDuration(file.duration)}
                    </span>
                  </div>
                )}
                {isVideo && (
                  <>
                    <div className="info-field">
                      <span className="info-label">Resolution</span>
                      <span className="info-value">
                        {getResolutionLabel(file.width, file.height)}
                      </span>
                    </div>
                    <div className="info-field">
                      <span className="info-label">Frame Rate</span>
                      <span className="info-value">
                        {file.frameRate
                          ? `${file.frameRate.toFixed(2)} fps`
                          : '—'}
                      </span>
                    </div>
                    <div className="info-field">
                      <span className="info-label">Video Codec</span>
                      <span className="info-value codec">
                        {file.videoCodec?.toUpperCase() || '—'}
                      </span>
                    </div>
                    <div className="info-field">
                      <span className="info-label">Video Bitrate</span>
                      <span className="info-value">
                        {formatBitrate(file.videoBitrate)}
                      </span>
                    </div>
                    <div className="info-field">
                      <span className="info-label">Color Space</span>
                      <span className="info-value">
                        {file.colorSpace || '—'}
                      </span>
                    </div>
                    <div className="info-field">
                      <span className="info-label">HDR</span>
                      <span
                        className={`info-value ${file.hdrFormat ? 'hdr-badge' : ''}`}
                      >
                        {getHdrLabel(file.hdrFormat)}
                      </span>
                    </div>
                  </>
                )}
                <div className="info-field">
                  <span className="info-label">Audio Codec</span>
                  <span className="info-value codec">
                    {file.audioCodec?.toUpperCase() || '—'}
                  </span>
                </div>
                <div className="info-field">
                  <span className="info-label">Audio Channels</span>
                  <span className="info-value">
                    {getAudioChannelLabel(file.audioChannels)}
                  </span>
                </div>
                {file.audioSampleRate && (
                  <div className="info-field">
                    <span className="info-label">Sample Rate</span>
                    <span className="info-value">
                      {(file.audioSampleRate / 1000).toFixed(1)} kHz
                    </span>
                  </div>
                )}
                {file.audioBitrate && (
                  <div className="info-field">
                    <span className="info-label">Audio Bitrate</span>
                    <span className="info-value">
                      {formatBitrate(file.audioBitrate)}
                    </span>
                  </div>
                )}
                {file.container && (
                  <div className="info-field">
                    <span className="info-label">Container</span>
                    <span className="info-value">
                      {file.container.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Metadata & Tags Section - DAM/MAM Standard */}
          <section className="info-section">
            <h3 className="info-section-title">Metadata & Tags</h3>

            {/* Favorite Toggle */}
            <div className="info-field inline">
              <button
                className={`favorite-button ${isFavorite ? 'active' : ''}`}
                onClick={() => onToggleFavorite?.(file)}
              >
                <IconStar size={20} glow={isFavorite} />
                <span>{isFavorite ? 'Favorited' : 'Add to Favorites'}</span>
              </button>
            </div>

            {/* Tags - Searchable keywords for DAM/MAM */}
            <div className="info-field tags-field">
              <div className="tags-header">
                <span className="info-label">Tags</span>
                <span className="tags-count">({file.tags?.length || 0})</span>
              </div>
              <span className="info-hint">
                Use tag:keyword in search to find assets
              </span>
              <div className="tags-container">
                {(file.tags || []).map((tag) => {
                  const tagColor = tagColors[tag] || '#8E8E93';
                  return (
                    <span
                      key={tag}
                      className="tag-chip"
                      style={{
                        borderColor: tagColor,
                        backgroundColor: `${tagColor}15`,
                      }}
                    >
                      <span
                        className="tag-dot"
                        style={{ backgroundColor: tagColor }}
                      />
                      <span className="tag-name">{tag}</span>
                      <button
                        className="tag-remove"
                        onClick={() => onRemoveTag?.(file, tag)}
                        title={`Remove "${tag}" tag`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                <div className="tag-input-wrapper">
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="tag-input"
                  />
                  <button
                    className="tag-add"
                    onClick={handleAddTag}
                    disabled={!newTag.trim()}
                    title="Add tag"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Available Tags (existing tags with colors) */}
              {availableTags.length > 0 && (
                <div className="available-tags">
                  <span className="available-tags-label">Available:</span>
                  <div className="available-tags-list">
                    {availableTags
                      .filter((t) => !(file.tags || []).includes(t.name))
                      .slice(0, 8)
                      .map((tag) => {
                        const tagColor = tag.color || '#8E8E93';
                        return (
                          <button
                            key={tag.name}
                            className="available-tag"
                            onClick={() => onAddTag?.(file, tag.name)}
                            style={{
                              borderColor: tagColor,
                              backgroundColor: `${tagColor}15`,
                            }}
                            title={`Add "${tag.name}" tag`}
                          >
                            <span
                              className="tag-dot"
                              style={{ backgroundColor: tagColor }}
                            />
                            {tag.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Suggested Tags based on file type */}
              <div className="suggested-tags">
                <span className="suggested-label">Suggested:</span>
                {getSuggestedTags(file)
                  .filter((tag) => !(file.tags || []).includes(tag))
                  .slice(0, 5)
                  .map((tag) => (
                    <button
                      key={tag}
                      className="suggested-tag"
                      onClick={() => onAddTag?.(file, tag)}
                      title={`Add "${tag}" tag`}
                    >
                      + {tag}
                    </button>
                  ))}
              </div>
            </div>

            {/* Color Label */}
            <section className="info-section color-label-section">
              <h3 className="info-section-title">Color Label</h3>
              <div className="color-labels">
                {COLOR_LABELS.map(({ name, value }) => (
                  <button
                    key={name}
                    className={`color-label-btn ${file.colorLabel === value ? 'active' : ''}`}
                    data-color={value || undefined}
                    onClick={() => onSetColorLabel?.(file, value)}
                    title={name}
                  >
                    {file.colorLabel === value && (
                      <span className="check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* Comments */}
            <div className="info-field comments-field">
              <span className="info-label">Comments</span>
              {isEditingComments ? (
                <div className="comments-editor">
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add comments about this file..."
                    rows={3}
                  />
                  <div className="comments-actions">
                    <button
                      className="cancel-btn"
                      onClick={() => setIsEditingComments(false)}
                    >
                      Cancel
                    </button>
                    <button className="save-btn" onClick={handleSaveComments}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="comments-display"
                  onClick={() => setIsEditingComments(true)}
                >
                  {comments || (
                    <span className="placeholder">
                      Click to add comments...
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Organization Defaults Section (set by org) */}
          <section className="info-section org-defaults">
            <h3 className="info-section-title">Organization Defaults</h3>
            <div className="info-grid">
              <div className="info-field">
                <span className="info-label">Project</span>
                <span className="info-value editable">
                  {file.project || (
                    <span className="placeholder">Not assigned</span>
                  )}
                </span>
              </div>
              <div className="info-field">
                <span className="info-label">Client</span>
                <span className="info-value editable">
                  {file.client || (
                    <span className="placeholder">Not assigned</span>
                  )}
                </span>
              </div>
              <div className="info-field">
                <span className="info-label">Department</span>
                <span className="info-value editable">
                  {file.department || (
                    <span className="placeholder">Not assigned</span>
                  )}
                </span>
              </div>
              <div className="info-field">
                <span className="info-label">Asset Category</span>
                <span
                  className={`info-value asset-category ${file.assetCategory || ''}`}
                >
                  {getAssetCategoryLabel(file.assetCategory)}
                </span>
              </div>
              <div className="info-field">
                <span className="info-label">Approval Status</span>
                <span
                  className={`info-value approval-status ${file.approvalStatus || 'pending'}`}
                >
                  {getApprovalStatusLabel(file.approvalStatus)}
                </span>
              </div>
              <div className="info-field">
                <span className="info-label">Usage Rights</span>
                <span className="info-value editable">
                  {file.usageRights || (
                    <span className="placeholder">Not specified</span>
                  )}
                </span>
              </div>
              {file.createdBy && (
                <div className="info-field">
                  <span className="info-label">Created By</span>
                  <span className="info-value">{file.createdBy}</span>
                </div>
              )}
              {file.modifiedBy && (
                <div className="info-field">
                  <span className="info-label">Modified By</span>
                  <span className="info-value">{file.modifiedBy}</span>
                </div>
              )}
              {file.expiresAt && (
                <div className="info-field">
                  <span className="info-label">Expires</span>
                  <span
                    className={`info-value ${new Date(file.expiresAt) < new Date() ? 'expired' : ''}`}
                  >
                    {new Date(file.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Custom Fields */}
            {file.customFields && Object.keys(file.customFields).length > 0 && (
              <div className="custom-fields">
                <div className="custom-fields-header">Custom Fields</div>
                <div className="info-grid">
                  {Object.entries(file.customFields).map(([key, value]) => (
                    <div key={key} className="info-field">
                      <span className="info-label">{key}</span>
                      <span className="info-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
