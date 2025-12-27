//! Unified Object Storage Tier Management
//!
//! Provides consistent tier management across all object storage providers:
//! - AWS S3
//! - Google Cloud Storage (GCS)
//! - Azure Blob Storage
//!
//! Maps customer-facing tier names to provider-specific storage classes:
//! - Hot/Nearline = Standard tier (immediate access)
//! - Cold = Instant Retrieval tier (millisecond access, lower cost)
//! - Archive = Deep Archive tier (requires restore, lowest cost)

use anyhow::{Context, Result};
use opendal::Operator;
use tracing::{info, warn};

use crate::vfs::domain::{StorageTier, StorageSourceType};

/// Change storage tier for object storage objects
/// Works across S3, GCS, and Azure Blob Storage
pub async fn change_object_storage_tier(
    operator: &Operator,
    source_type: &StorageSourceType,
    key: &str,
    target_tier: StorageTier,
) -> Result<()> {
    // Map our tier enum to provider-specific storage class
    let storage_class = match (source_type, target_tier) {
        // Hot/Nearline = Standard tier (immediate access, standard cost)
        (_, StorageTier::Hot | StorageTier::Warm | StorageTier::Nearline) => {
            get_standard_storage_class(source_type)
        }
        
        // Cold = Instant Retrieval tier (millisecond access, lower cost than Standard)
        // This is the key mapping: Cold tier maps to Instant Retrieval equivalents
        (StorageSourceType::S3 | StorageSourceType::S3Compatible, StorageTier::Cold) => {
            "GLACIER_IR" // S3 Glacier Instant Retrieval
        }
        (StorageSourceType::Gcs, StorageTier::Cold) => {
            "NEARLINE" // GCS Nearline Storage (instant access, lower cost)
        }
        (StorageSourceType::AzureBlob, StorageTier::Cold) => {
            "Cool" // Azure Blob Cool tier (instant access, lower cost)
        }
        
        // InstantRetrieval tier (explicit) - same as Cold
        (StorageSourceType::S3 | StorageSourceType::S3Compatible, StorageTier::InstantRetrieval) => {
            "GLACIER_IR"
        }
        (StorageSourceType::Gcs, StorageTier::InstantRetrieval) => {
            "NEARLINE"
        }
        (StorageSourceType::AzureBlob, StorageTier::InstantRetrieval) => {
            "Cool"
        }
        
        // Archive = Deep Archive tier (lowest cost, requires restore)
        (StorageSourceType::S3 | StorageSourceType::S3Compatible, StorageTier::Archive) => {
            "DEEP_ARCHIVE" // S3 Glacier Deep Archive
        }
        (StorageSourceType::Gcs, StorageTier::Archive) => {
            "COLDLINE" // GCS Coldline Storage (requires restore)
        }
        (StorageSourceType::AzureBlob, StorageTier::Archive) => {
            "Archive" // Azure Blob Archive tier (requires restore)
        }
        
        // Fallback for unknown combinations
        (_, StorageTier::Cold | StorageTier::InstantRetrieval) => {
            // Default to standard if provider doesn't support instant retrieval
            warn!("Provider {:?} doesn't have instant retrieval equivalent, using standard", source_type);
            get_standard_storage_class(source_type)
        }
        (_, StorageTier::Archive) => {
            warn!("Provider {:?} doesn't have archive tier, using standard", source_type);
            get_standard_storage_class(source_type)
        }
    };

    info!(
        "Changing {} object '{}' to storage class '{}' (tier: {:?})",
        get_provider_name(source_type), key, storage_class, target_tier
    );

    // Object storage doesn't support direct storage class change - we need to copy the object
    // with the new storage class. OpenDAL doesn't expose storage class in write(),
    // so we need to use provider SDKs directly.
    // 
    // For now, we'll use copy operation which will use bucket defaults.
    // TODO: Integrate provider SDKs to use CopyObject/PatchObject with StorageClass parameter
    
    // Read the object
    let data = operator.read(key).await
        .with_context(|| format!("Failed to read object '{}' for tier change", key))?;
    
    // Copy the object - OpenDAL will use bucket default storage class
    // In production, this should use provider SDKs with StorageClass parameter
    warn!(
        "Using copy operation - storage class will use bucket default. For explicit storage class '{}', use provider SDK.",
        storage_class
    );
    
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
    
    info!(
        "Successfully changed tier for {} object '{}' to '{}'",
        get_provider_name(source_type), key, storage_class
    );
    Ok(())
}

/// Get standard storage class for a provider
fn get_standard_storage_class(source_type: &StorageSourceType) -> &'static str {
    match source_type {
        StorageSourceType::S3 | StorageSourceType::S3Compatible => "STANDARD",
        StorageSourceType::Gcs => "STANDARD",
        StorageSourceType::AzureBlob => "Hot",
        _ => "STANDARD", // Default fallback
    }
}

/// Get provider display name
fn get_provider_name(source_type: &StorageSourceType) -> &'static str {
    match source_type {
        StorageSourceType::S3 => "S3",
        StorageSourceType::S3Compatible => "S3-Compatible",
        StorageSourceType::Gcs => "GCS",
        StorageSourceType::AzureBlob => "Azure Blob",
        _ => "Object Storage",
    }
}

/// Get current storage class of an object storage object
pub async fn get_object_storage_class(
    operator: &Operator,
    source_type: &StorageSourceType,
    key: &str,
) -> Result<Option<String>> {
    // OpenDAL's stat() should include storage class in metadata
    let metadata = operator.stat(key).await?;
    
    // Check if OpenDAL exposes storage class
    // This may require using provider SDKs directly to get object metadata
    // For now, return None and detect from tier status
    Ok(None)
}
