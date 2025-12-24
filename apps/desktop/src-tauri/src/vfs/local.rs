use super::{FileSystem, VfsMetadata, DirEntry, FileType, FsCapabilities, VirtualFile};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::io::{Result, Error, ErrorKind};
use tokio::fs;

pub struct LocalFileSystem {
    root: PathBuf,
}

impl LocalFileSystem {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root: root.into(),
        }
    }

    fn to_real_path(&self, virtual_path: &Path) -> PathBuf {
        // Strip leading '/' if present to prevent absolute path issues relative to root
        let p = virtual_path.strip_prefix("/").unwrap_or(virtual_path);
        self.root.join(p)
    }
}

#[async_trait]
impl FileSystem for LocalFileSystem {
    fn id(&self) -> &str {
        "local"
    }

    fn capabilities(&self) -> FsCapabilities {
        FsCapabilities {
            read: true,
            write: true,
            seek: true,
            hydration: false,
        }
    }

    async fn metadata(&self, path: &Path) -> Result<VfsMetadata> {
        let real_path = self.to_real_path(path);
        let meta = fs::metadata(&real_path).await?;
        
        Ok(VfsMetadata {
            file_type: if meta.is_dir() { FileType::Directory } else { FileType::File },
            size: meta.len(),
            permissions: 0o755, // Simplified for now
            created: meta.created().ok(),
            modified: meta.modified().ok(),
            accessed: meta.accessed().ok(),
            block_size: 4096,
        })
    }

    async fn exists(&self, path: &Path) -> Result<bool> {
        let real_path = self.to_real_path(path);
        Ok(real_path.exists())
    }

    async fn read_dir(&self, path: &Path) -> Result<Vec<DirEntry>> {
        let real_path = self.to_real_path(path);
        let mut read_dir = fs::read_dir(real_path).await?;
        let mut entries = Vec::new();

        while let Some(entry) = read_dir.next_entry().await? {
            let meta = entry.metadata().await?;
            let name = entry.file_name().to_string_lossy().to_string();
            let v_path = path.join(&name).to_string_lossy().to_string();

            entries.push(DirEntry {
                name,
                path: v_path,
                metadata: VfsMetadata {
                    file_type: if meta.is_dir() { FileType::Directory } else { FileType::File },
                    size: meta.len(),
                    permissions: 0o755,
                    created: meta.created().ok(),
                    modified: meta.modified().ok(),
                    accessed: meta.accessed().ok(),
                    block_size: 4096,
                },
            });
        }

        Ok(entries)
    }

    async fn create_dir(&self, path: &Path) -> Result<()> {
        fs::create_dir_all(self.to_real_path(path)).await
    }

    async fn remove_dir(&self, path: &Path) -> Result<()> {
        fs::remove_dir_all(self.to_real_path(path)).await
    }

    async fn open_file(&self, path: &Path) -> Result<Box<dyn VirtualFile>> {
        let file = fs::File::open(self.to_real_path(path)).await?;
        // tokio::fs::File implements AsyncRead + AsyncWrite
        Ok(Box::new(file))
    }

    async fn create_file(&self, path: &Path) -> Result<Box<dyn VirtualFile>> {
        let file = fs::File::create(self.to_real_path(path)).await?;
        Ok(Box::new(file))
    }

    async fn remove_file(&self, path: &Path) -> Result<()> {
        fs::remove_file(self.to_real_path(path)).await
    }

    async fn rename(&self, from: &Path, to: &Path) -> Result<()> {
        fs::rename(self.to_real_path(from), self.to_real_path(to)).await
    }

    async fn copy(&self, from: &Path, to: &Path) -> Result<()> {
        fs::copy(self.to_real_path(from), self.to_real_path(to)).await?;
        Ok(())
    }
}




