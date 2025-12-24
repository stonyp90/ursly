//! Metadata Port - Interface for file metadata persistence
//!
//! This module defines the contract for storing and retrieving
//! user-defined metadata like tags, favorites, ratings, and comments.

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::vfs::domain::{ColorLabel, FileTag};

/// File metadata that can be stored separately from the file itself
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FileMetadata {
    /// User-assigned tags
    pub tags: Vec<FileTag>,
    
    /// Is marked as favorite
    pub is_favorite: bool,
    
    /// Color label
    pub color_label: Option<ColorLabel>,
    
    /// User rating (0-5)
    pub rating: Option<u8>,
    
    /// User comment/notes
    pub comment: Option<String>,
}

impl FileMetadata {
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Check if metadata has any user-defined values
    pub fn is_empty(&self) -> bool {
        self.tags.is_empty()
            && !self.is_favorite
            && self.color_label.is_none()
            && self.rating.is_none()
            && self.comment.is_none()
    }
}

/// Metadata storage interface
#[async_trait]
pub trait IMetadataStore: Send + Sync {
    /// Get metadata for a file
    async fn get(&self, source_id: &str, path: &Path) -> Result<Option<FileMetadata>>;
    
    /// Set metadata for a file
    async fn set(&self, source_id: &str, path: &Path, metadata: FileMetadata) -> Result<()>;
    
    /// Delete metadata for a file
    async fn delete(&self, source_id: &str, path: &Path) -> Result<()>;
    
    /// Add a tag to a file
    async fn add_tag(&self, source_id: &str, path: &Path, tag: FileTag) -> Result<()>;
    
    /// Remove a tag from a file
    async fn remove_tag(&self, source_id: &str, path: &Path, tag_name: &str) -> Result<()>;
    
    /// Set favorite status
    async fn set_favorite(&self, source_id: &str, path: &Path, is_favorite: bool) -> Result<()>;
    
    /// Toggle favorite status
    async fn toggle_favorite(&self, source_id: &str, path: &Path) -> Result<bool>;
    
    /// Set color label
    async fn set_color_label(&self, source_id: &str, path: &Path, color: Option<ColorLabel>) -> Result<()>;
    
    /// Set rating
    async fn set_rating(&self, source_id: &str, path: &Path, rating: Option<u8>) -> Result<()>;
    
    /// Set comment
    async fn set_comment(&self, source_id: &str, path: &Path, comment: Option<String>) -> Result<()>;
    
    /// Get all favorites for a source
    async fn list_favorites(&self, source_id: &str) -> Result<Vec<String>>;
    
    /// Get all files with a specific tag
    async fn list_by_tag(&self, source_id: &str, tag_name: &str) -> Result<Vec<String>>;
    
    /// Get all files with a specific color label
    async fn list_by_color(&self, source_id: &str, color: ColorLabel) -> Result<Vec<String>>;
    
    /// Get all unique tags used in a source
    async fn list_all_tags(&self, source_id: &str) -> Result<Vec<FileTag>>;
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_file_metadata_default() {
        let meta = FileMetadata::new();
        assert!(meta.is_empty());
        assert!(!meta.is_favorite);
        assert!(meta.tags.is_empty());
    }
    
    #[test]
    fn test_file_metadata_not_empty_with_favorite() {
        let mut meta = FileMetadata::new();
        meta.is_favorite = true;
        assert!(!meta.is_empty());
    }
    
    #[test]
    fn test_file_metadata_not_empty_with_tag() {
        let mut meta = FileMetadata::new();
        meta.tags.push(FileTag::new("important"));
        assert!(!meta.is_empty());
    }
}



