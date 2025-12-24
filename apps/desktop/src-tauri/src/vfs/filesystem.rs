use anyhow::Result;
use fuser::{
    FileAttr, FileType, Filesystem, ReplyAttr, ReplyData, ReplyDirectory, ReplyEntry,
    Request,
};
use libc::{ENOENT, ENOSYS};
use std::collections::HashMap;
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use parking_lot::RwLock;
use tracing::{debug, error, info, warn};

use super::hydration::HydratedOperator;

const TTL: Duration = Duration::from_secs(1);
const ROOT_INO: u64 = 1;

/// Ursly FUSE Filesystem Implementation
pub struct UrslyFS {
    /// Hydration operator for transparent caching
    operator: Arc<HydratedOperator>,
    
    /// Inode to path mapping
    inode_map: Arc<RwLock<HashMap<u64, PathBuf>>>,
    
    /// Path to inode mapping (reverse lookup)
    path_to_inode: Arc<RwLock<HashMap<PathBuf, u64>>>,
    
    /// Next available inode number
    next_inode: Arc<RwLock<u64>>,
    
    /// File handle to path mapping
    file_handles: Arc<RwLock<HashMap<u64, PathBuf>>>,
    
    /// Next available file handle
    next_fh: Arc<RwLock<u64>>,
}

impl UrslyFS {
    pub fn new(operator: HydratedOperator) -> Self {
        let mut inode_map = HashMap::new();
        let mut path_to_inode = HashMap::new();
        
        // Initialize root directory
        inode_map.insert(ROOT_INO, PathBuf::from("/"));
        path_to_inode.insert(PathBuf::from("/"), ROOT_INO);
        
        Self {
            operator: Arc::new(operator),
            inode_map: Arc::new(RwLock::new(inode_map)),
            path_to_inode: Arc::new(RwLock::new(path_to_inode)),
            next_inode: Arc::new(RwLock::new(ROOT_INO + 1)),
            file_handles: Arc::new(RwLock::new(HashMap::new())),
            next_fh: Arc::new(RwLock::new(1)),
        }
    }
    
    /// Get or allocate an inode for a path
    fn get_or_create_inode(&self, path: PathBuf) -> u64 {
        // Check if inode already exists
        {
            let path_map = self.path_to_inode.read();
            if let Some(&ino) = path_map.get(&path) {
                return ino;
            }
        }
        
        // Allocate new inode
        let mut next_ino = self.next_inode.write();
        let ino = *next_ino;
        *next_ino += 1;
        
        // Store mappings
        self.inode_map.write().insert(ino, path.clone());
        self.path_to_inode.write().insert(path, ino);
        
        ino
    }
    
    /// Get path from inode
    fn get_path(&self, ino: u64) -> Option<PathBuf> {
        self.inode_map.read().get(&ino).cloned()
    }
    
    /// Create file attributes from OpenDAL metadata
    fn create_attr(&self, ino: u64, metadata: &opendal::Metadata) -> FileAttr {
        let size = metadata.content_length();
        let is_dir = metadata.is_dir();
        
        let kind = if is_dir {
            FileType::Directory
        } else {
            FileType::RegularFile
        };
        
        let perm = if is_dir { 0o755 } else { 0o644 };
        
        let mtime = metadata
            .last_modified()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| SystemTime::UNIX_EPOCH + d)
            .unwrap_or(SystemTime::UNIX_EPOCH);
        
        FileAttr {
            ino,
            size,
            blocks: (size + 511) / 512,
            atime: mtime,
            mtime,
            ctime: mtime,
            crtime: mtime,
            kind,
            perm,
            nlink: 1,
            uid: unsafe { libc::getuid() },
            gid: unsafe { libc::getgid() },
            rdev: 0,
            blksize: 4096,
            flags: 0,
        }
    }
}

impl Filesystem for UrslyFS {
    fn lookup(&mut self, _req: &Request, parent: u64, name: &OsStr, reply: ReplyEntry) {
        debug!("lookup(parent={}, name={:?})", parent, name);
        
        let parent_path = match self.get_path(parent) {
            Some(p) => p,
            None => {
                error!("Parent inode {} not found", parent);
                reply.error(ENOENT);
                return;
            }
        };
        
        let name_str = match name.to_str() {
            Some(s) => s,
            None => {
                reply.error(ENOENT);
                return;
            }
        };
        
        // Build full path
        let full_path = if parent_path == PathBuf::from("/") {
            format!("/{}", name_str)
        } else {
            format!("{}/{}", parent_path.display(), name_str)
        };
        
        let path_buf = PathBuf::from(&full_path);
        
        // Use tokio runtime to execute async operation
        let operator = self.operator.clone();
        let rt = tokio::runtime::Handle::current();
        
        match rt.block_on(async { operator.metadata(&full_path).await }) {
            Ok(metadata) => {
                let ino = self.get_or_create_inode(path_buf);
                let attr = self.create_attr(ino, &metadata);
                reply.entry(&TTL, &attr, 0);
            }
            Err(e) => {
                warn!("Lookup failed for {}: {}", full_path, e);
                reply.error(ENOENT);
            }
        }
    }
    
    fn getattr(&mut self, _req: &Request, ino: u64, reply: ReplyAttr) {
        debug!("getattr(ino={})", ino);
        
        // Special case for root
        if ino == ROOT_INO {
            reply.attr(
                &TTL,
                &FileAttr {
                    ino: ROOT_INO,
                    size: 0,
                    blocks: 0,
                    atime: SystemTime::UNIX_EPOCH,
                    mtime: SystemTime::UNIX_EPOCH,
                    ctime: SystemTime::UNIX_EPOCH,
                    crtime: SystemTime::UNIX_EPOCH,
                    kind: FileType::Directory,
                    perm: 0o755,
                    nlink: 2,
                    uid: unsafe { libc::getuid() },
                    gid: unsafe { libc::getgid() },
                    rdev: 0,
                    blksize: 4096,
                    flags: 0,
                },
            );
            return;
        }
        
        let path = match self.get_path(ino) {
            Some(p) => p,
            None => {
                reply.error(ENOENT);
                return;
            }
        };
        
        let path_str = path.to_str().unwrap();
        let operator = self.operator.clone();
        let rt = tokio::runtime::Handle::current();
        
        match rt.block_on(async { operator.metadata(path_str).await }) {
            Ok(metadata) => {
                let attr = self.create_attr(ino, &metadata);
                reply.attr(&TTL, &attr);
            }
            Err(e) => {
                error!("getattr failed for {}: {}", path_str, e);
                reply.error(ENOENT);
            }
        }
    }
    
    fn read(
        &mut self,
        _req: &Request,
        ino: u64,
        _fh: u64,
        offset: i64,
        size: u32,
        _flags: i32,
        _lock: Option<u64>,
        reply: ReplyData,
    ) {
        debug!("read(ino={}, offset={}, size={})", ino, offset, size);
        
        let path = match self.get_path(ino) {
            Some(p) => p,
            None => {
                reply.error(ENOENT);
                return;
            }
        };
        
        let path_str = path.to_str().unwrap().to_string();
        let operator = self.operator.clone();
        let rt = tokio::runtime::Handle::current();
        
        match rt.block_on(async { operator.read(&path_str).await }) {
            Ok(data) => {
                let start = offset as usize;
                let end = std::cmp::min(start + size as usize, data.len());
                
                if start < data.len() {
                    reply.data(&data[start..end]);
                } else {
                    reply.data(&[]);
                }
            }
            Err(e) => {
                error!("read failed for {}: {}", path_str, e);
                reply.error(ENOENT);
            }
        }
    }
    
    fn readdir(
        &mut self,
        _req: &Request,
        ino: u64,
        _fh: u64,
        offset: i64,
        mut reply: ReplyDirectory,
    ) {
        debug!("readdir(ino={}, offset={})", ino, offset);
        
        let path = match self.get_path(ino) {
            Some(p) => p,
            None => {
                reply.error(ENOENT);
                return;
            }
        };
        
        let path_str = path.to_str().unwrap();
        let operator = self.operator.clone();
        let rt = tokio::runtime::Handle::current();
        
        match rt.block_on(async { operator.list_dir(path_str).await }) {
            Ok(entries) => {
                let mut entries_vec = vec![
                    (ino, FileType::Directory, ".".to_string()),
                    (ino, FileType::Directory, "..".to_string()),
                ];
                
                for entry in entries {
                    let name = entry.name().to_string();
                    let is_dir = entry.metadata().is_dir();
                    let kind = if is_dir {
                        FileType::Directory
                    } else {
                        FileType::RegularFile
                    };
                    
                    let entry_path = if path == PathBuf::from("/") {
                        PathBuf::from(format!("/{}", name))
                    } else {
                        path.join(&name)
                    };
                    
                    let entry_ino = self.get_or_create_inode(entry_path);
                    entries_vec.push((entry_ino, kind, name));
                }
                
                for (i, entry) in entries_vec.iter().enumerate().skip(offset as usize) {
                    if reply.add(entry.0, (i + 1) as i64, entry.1, &entry.2) {
                        break;
                    }
                }
                
                reply.ok();
            }
            Err(e) => {
                error!("readdir failed for {}: {}", path_str, e);
                reply.error(ENOENT);
            }
        }
    }
    
    // Unsupported operations (read-only filesystem for POC)
    fn write(
        &mut self,
        _req: &Request,
        _ino: u64,
        _fh: u64,
        _offset: i64,
        _data: &[u8],
        _write_flags: u32,
        _flags: i32,
        _lock_owner: Option<u64>,
        reply: fuser::ReplyWrite,
    ) {
        reply.error(ENOSYS);
    }
    
    fn create(
        &mut self,
        _req: &Request,
        _parent: u64,
        _name: &OsStr,
        _mode: u32,
        _umask: u32,
        _flags: i32,
        reply: fuser::ReplyCreate,
    ) {
        reply.error(ENOSYS);
    }
}




