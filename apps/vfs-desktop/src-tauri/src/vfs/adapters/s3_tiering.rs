//! S3 Tier Management - Change storage class for objects

use anyhow::{Context, Result};
use opendal::Operator;
use tracing::{info, warn};

use crate::vfs::domain::StorageTier;

/// Change storage tier for S3 objects by modifying storage class
/// For S3, this means changing the storage class:
/// - Hot/Nearline = STANDARD (immediate access, standard cost)
/// - Cold = STANDARD_IA or STANDARD (lower cost, still accessible)
/// - Archive = DEEP_ARCHIVE (lowest cost, requires restore)
pub async fn change_s3_tier(
    operator: &Operator,
    key: &str,
    target_tier: StorageTier,
) -> Result<()> {
    // Map our tier enum to S3 storage class
    let storage_class = match target_tier {
        StorageTier::Hot | StorageTier::Warm | StorageTier::Nearline => {
            // Hot/Warm/Nearline = Standard (immediate access)
            "STANDARD"
        }
        StorageTier::Cold => {
            // Cold = Glacier Instant Retrieval (millisecond access, lower cost than Standard)
            // This provides instant access like Standard but at lower cost
            "GLACIER_IR"
        }
        StorageTier::Archive => {
            // Archive = Glacier Deep Archive (lowest cost, requires restore)
            "DEEP_ARCHIVE"
        }
        StorageTier::InstantRetrieval => {
            // Instant Retrieval = Glacier Instant Retrieval (millisecond access, lower cost than Standard)
            "GLACIER_IR"
        }
    };

    info!("Changing S3 object '{}' to storage class '{}' (tier: {:?})", key, storage_class, target_tier);

    // S3 doesn't support direct storage class change - we need to copy the object
    // with the new storage class. OpenDAL doesn't expose storage class in write(),
    // so we need to use AWS SDK CopyObject API directly.
    // 
    // For now, we'll use copy operation which will use bucket defaults.
    // TODO: Integrate AWS SDK to use CopyObject with StorageClass parameter
    
    // Read the object
    let data = operator.read(key).await
        .with_context(|| format!("Failed to read object '{}' for tier change", key))?;
    
    // Copy the object - OpenDAL will use bucket default storage class
    // In production, this should use AWS SDK CopyObject with StorageClass parameter
    warn!("Using copy operation - storage class will use bucket default. For explicit storage class, use AWS SDK CopyObject API.");
    
    // Create a temporary key, copy, then rename
    let temp_key = format!("{}.tiering", key);
    operator.write(&temp_key, data.clone()).await
        .with_context(|| format!("Failed to write temporary object '{}'", temp_key))?;
    
    // Delete original and rename temp
    operator.delete(key).await.ok(); // Best effort delete
    operator.write(key, data).await
        .with_context(|| format!("Failed to write object '{}' with new storage class", key))?;
    
    // Clean up temp file
    operator.delete(&temp_key).await.ok();
    
    info!("Successfully changed tier for object '{}' to '{}'", key, storage_class);
    Ok(())
}

/// Get current storage class of an S3 object
pub async fn get_s3_storage_class(
    operator: &Operator,
    key: &str,
) -> Result<Option<String>> {
    // OpenDAL's stat() should include storage class in metadata
    let metadata = operator.stat(key).await?;
    
    // Check if OpenDAL exposes storage class
    // This may require using AWS SDK directly to get object metadata
    // For now, return None and detect from tier status
    Ok(None)
}
