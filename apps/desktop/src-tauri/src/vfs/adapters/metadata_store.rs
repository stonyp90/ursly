//! Metadata Store Adapter - JSON file-based metadata persistence
//!
//! Stores file metadata (tags, favorites, ratings) in a JSON file
//! within the app's data directory.

use anyhow::{Context, Result};
use async_trait::async_trait;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::sync::RwLock;
use tracing::{debug, info};

use crate::vfs::domain::{ColorLabel, FileTag};
use crate::vfs::ports::metadata::{FileMetadata, IMetadataStore};

/// Key for metadata storage: "source_id:path"
fn make_key(source_id: &str, path: &Path) -> String {
    format!("{}:{}", source_id, path.display())
}

/// Metadata store backed by a JSON file
pub struct JsonMetadataStore {
    /// Path to the JSON file
    store_path: PathBuf,
    
    /// In-memory cache
    cache: RwLock<HashMap<String, FileMetadata>>,
    
    /// Dirty flag for write-back
    dirty: RwLock<bool>,
}

impl JsonMetadataStore {
    /// Create a new metadata store
    pub async fn new(store_path: PathBuf) -> Result<Self> {
        let store = Self {
            store_path,
            cache: RwLock::new(HashMap::new()),
            dirty: RwLock::new(false),
        };
        
        // Load existing data
        store.load().await?;
        
        Ok(store)
    }
    
    /// Create with default path in app data directory
    pub async fn default_store() -> Result<Self> {
        let data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ursly")
            .join("vfs");
        
        fs::create_dir_all(&data_dir).await?;
        
        let store_path = data_dir.join("metadata.json");
        Self::new(store_path).await
    }
    
    /// Load metadata from disk
    async fn load(&self) -> Result<()> {
        if !self.store_path.exists() {
            debug!("Metadata store not found, starting fresh");
            return Ok(());
        }
        
        let content = fs::read_to_string(&self.store_path).await
            .context("Failed to read metadata store")?;
        
        let data: HashMap<String, FileMetadata> = serde_json::from_str(&content)
            .context("Failed to parse metadata store")?;
        
        let mut cache = self.cache.write().await;
        *cache = data;
        
        info!("Loaded {} metadata entries", cache.len());
        Ok(())
    }
    
    /// Save metadata to disk
    pub async fn save(&self) -> Result<()> {
        let dirty = *self.dirty.read().await;
        if !dirty {
            return Ok(());
        }
        
        let cache = self.cache.read().await;
        
        // Only save entries that have data
        let data: HashMap<&String, &FileMetadata> = cache
            .iter()
            .filter(|(_, m)| !m.is_empty())
            .collect();
        
        let content = serde_json::to_string_pretty(&data)
            .context("Failed to serialize metadata")?;
        
        // Ensure parent directory exists
        if let Some(parent) = self.store_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::write(&self.store_path, content).await
            .context("Failed to write metadata store")?;
        
        *self.dirty.write().await = false;
        
        debug!("Saved {} metadata entries", data.len());
        Ok(())
    }
    
    /// Mark as dirty (needs saving)
    async fn mark_dirty(&self) {
        *self.dirty.write().await = true;
    }
    
    /// Get or create metadata entry
    async fn get_or_create(&self, key: &str) -> FileMetadata {
        let cache = self.cache.read().await;
        cache.get(key).cloned().unwrap_or_default()
    }
    
    /// Update metadata entry
    async fn update(&self, key: String, metadata: FileMetadata) -> Result<()> {
        let mut cache = self.cache.write().await;
        cache.insert(key, metadata);
        drop(cache);
        
        self.mark_dirty().await;
        self.save().await?;
        
        Ok(())
    }
}

#[async_trait]
impl IMetadataStore for JsonMetadataStore {
    async fn get(&self, source_id: &str, path: &Path) -> Result<Option<FileMetadata>> {
        let key = make_key(source_id, path);
        let cache = self.cache.read().await;
        Ok(cache.get(&key).cloned())
    }
    
    async fn set(&self, source_id: &str, path: &Path, metadata: FileMetadata) -> Result<()> {
        let key = make_key(source_id, path);
        self.update(key, metadata).await
    }
    
    async fn delete(&self, source_id: &str, path: &Path) -> Result<()> {
        let key = make_key(source_id, path);
        let mut cache = self.cache.write().await;
        cache.remove(&key);
        drop(cache);
        
        self.mark_dirty().await;
        self.save().await
    }
    
    async fn add_tag(&self, source_id: &str, path: &Path, tag: FileTag) -> Result<()> {
        let key = make_key(source_id, path);
        let mut metadata = self.get_or_create(&key).await;
        
        if !metadata.tags.contains(&tag) {
            metadata.tags.push(tag);
            self.update(key, metadata).await?;
        }
        
        Ok(())
    }
    
    async fn remove_tag(&self, source_id: &str, path: &Path, tag_name: &str) -> Result<()> {
        let key = make_key(source_id, path);
        let mut metadata = self.get_or_create(&key).await;
        
        let original_len = metadata.tags.len();
        metadata.tags.retain(|t| t.name != tag_name);
        
        if metadata.tags.len() != original_len {
            self.update(key, metadata).await?;
        }
        
        Ok(())
    }
    
    async fn set_favorite(&self, source_id: &str, path: &Path, is_favorite: bool) -> Result<()> {
        let key = make_key(source_id, path);
        let mut metadata = self.get_or_create(&key).await;
        metadata.is_favorite = is_favorite;
        self.update(key, metadata).await
    }
    
    async fn toggle_favorite(&self, source_id: &str, path: &Path) -> Result<bool> {
        let key = make_key(source_id, path);
        let mut metadata = self.get_or_create(&key).await;
        metadata.is_favorite = !metadata.is_favorite;
        let new_state = metadata.is_favorite;
        self.update(key, metadata).await?;
        Ok(new_state)
    }
    
    async fn set_color_label(&self, source_id: &str, path: &Path, color: Option<ColorLabel>) -> Result<()> {
        let key = make_key(source_id, path);
        let mut metadata = self.get_or_create(&key).await;
        metadata.color_label = color;
        self.update(key, metadata).await
    }
    
    async fn set_rating(&self, source_id: &str, path: &Path, rating: Option<u8>) -> Result<()> {
        let key = make_key(source_id, path);
        let mut metadata = self.get_or_create(&key).await;
        metadata.rating = rating.map(|r| r.min(5));
        self.update(key, metadata).await
    }
    
    async fn set_comment(&self, source_id: &str, path: &Path, comment: Option<String>) -> Result<()> {
        let key = make_key(source_id, path);
        let mut metadata = self.get_or_create(&key).await;
        metadata.comment = comment;
        self.update(key, metadata).await
    }
    
    async fn list_favorites(&self, source_id: &str) -> Result<Vec<String>> {
        let prefix = format!("{}:", source_id);
        let cache = self.cache.read().await;
        
        let favorites: Vec<String> = cache
            .iter()
            .filter(|(k, m)| k.starts_with(&prefix) && m.is_favorite)
            .map(|(k, _)| k.strip_prefix(&prefix).unwrap_or(k).to_string())
            .collect();
        
        Ok(favorites)
    }
    
    async fn list_by_tag(&self, source_id: &str, tag_name: &str) -> Result<Vec<String>> {
        let prefix = format!("{}:", source_id);
        let cache = self.cache.read().await;
        
        let files: Vec<String> = cache
            .iter()
            .filter(|(k, m)| {
                k.starts_with(&prefix) && m.tags.iter().any(|t| t.name == tag_name)
            })
            .map(|(k, _)| k.strip_prefix(&prefix).unwrap_or(k).to_string())
            .collect();
        
        Ok(files)
    }
    
    async fn list_by_color(&self, source_id: &str, color: ColorLabel) -> Result<Vec<String>> {
        let prefix = format!("{}:", source_id);
        let cache = self.cache.read().await;
        
        let files: Vec<String> = cache
            .iter()
            .filter(|(k, m)| {
                k.starts_with(&prefix) && m.color_label == Some(color)
            })
            .map(|(k, _)| k.strip_prefix(&prefix).unwrap_or(k).to_string())
            .collect();
        
        Ok(files)
    }
    
    async fn list_all_tags(&self, source_id: &str) -> Result<Vec<FileTag>> {
        let prefix = format!("{}:", source_id);
        let cache = self.cache.read().await;
        
        let mut all_tags: Vec<FileTag> = cache
            .iter()
            .filter(|(k, _)| k.starts_with(&prefix))
            .flat_map(|(_, m)| m.tags.clone())
            .collect();
        
        // Deduplicate by name
        all_tags.sort_by(|a, b| a.name.cmp(&b.name));
        all_tags.dedup_by(|a, b| a.name == b.name);
        
        Ok(all_tags)
    }
}

// =============================================================================
// Unit Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    async fn create_test_store() -> (JsonMetadataStore, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let store_path = temp_dir.path().join("metadata.json");
        let store = JsonMetadataStore::new(store_path).await.unwrap();
        (store, temp_dir)
    }
    
    #[tokio::test]
    async fn test_add_and_get_tag() {
        let (store, _dir) = create_test_store().await;
        
        store.add_tag("local", Path::new("/test.txt"), FileTag::new("important")).await.unwrap();
        
        let meta = store.get("local", Path::new("/test.txt")).await.unwrap().unwrap();
        assert_eq!(meta.tags.len(), 1);
        assert_eq!(meta.tags[0].name, "important");
    }
    
    #[tokio::test]
    async fn test_toggle_favorite() {
        let (store, _dir) = create_test_store().await;
        
        let result = store.toggle_favorite("local", Path::new("/file.txt")).await.unwrap();
        assert!(result, "First toggle should set to true");
        
        let result = store.toggle_favorite("local", Path::new("/file.txt")).await.unwrap();
        assert!(!result, "Second toggle should set to false");
    }
    
    #[tokio::test]
    async fn test_list_favorites() {
        let (store, _dir) = create_test_store().await;
        
        store.set_favorite("local", Path::new("/fav1.txt"), true).await.unwrap();
        store.set_favorite("local", Path::new("/fav2.txt"), true).await.unwrap();
        store.set_favorite("local", Path::new("/not_fav.txt"), false).await.unwrap();
        
        let favorites = store.list_favorites("local").await.unwrap();
        assert_eq!(favorites.len(), 2);
        assert!(favorites.contains(&"/fav1.txt".to_string()));
        assert!(favorites.contains(&"/fav2.txt".to_string()));
    }
    
    #[tokio::test]
    async fn test_color_label() {
        let (store, _dir) = create_test_store().await;
        
        store.set_color_label("local", Path::new("/project"), Some(ColorLabel::Blue)).await.unwrap();
        
        let meta = store.get("local", Path::new("/project")).await.unwrap().unwrap();
        assert_eq!(meta.color_label, Some(ColorLabel::Blue));
        
        let blue_files = store.list_by_color("local", ColorLabel::Blue).await.unwrap();
        assert_eq!(blue_files.len(), 1);
    }
    
    #[tokio::test]
    async fn test_list_all_tags() {
        let (store, _dir) = create_test_store().await;
        
        store.add_tag("local", Path::new("/a.txt"), FileTag::new("work")).await.unwrap();
        store.add_tag("local", Path::new("/b.txt"), FileTag::new("personal")).await.unwrap();
        store.add_tag("local", Path::new("/c.txt"), FileTag::new("work")).await.unwrap();
        
        let tags = store.list_all_tags("local").await.unwrap();
        assert_eq!(tags.len(), 2); // work and personal (deduplicated)
    }
    
    #[tokio::test]
    async fn test_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let store_path = temp_dir.path().join("metadata.json");
        
        // Create store and add data
        {
            let store = JsonMetadataStore::new(store_path.clone()).await.unwrap();
            store.set_favorite("local", Path::new("/test.txt"), true).await.unwrap();
            store.add_tag("local", Path::new("/test.txt"), FileTag::new("saved")).await.unwrap();
        }
        
        // Reload and verify
        {
            let store = JsonMetadataStore::new(store_path).await.unwrap();
            let meta = store.get("local", Path::new("/test.txt")).await.unwrap().unwrap();
            assert!(meta.is_favorite);
            assert_eq!(meta.tags.len(), 1);
            assert_eq!(meta.tags[0].name, "saved");
        }
    }
}



