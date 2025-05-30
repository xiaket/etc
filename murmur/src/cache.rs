use anyhow::{Context, Result};
use std::path::Path;
use tokio::fs;

use crate::utils::{self, Config, FileMetadata};

/// Cache management for audio chunks and transcripts
pub struct CacheManager {
    config: Config,
}

impl CacheManager {
    pub fn new(config: &Config) -> Self {
        Self {
            config: config.clone(),
        }
    }

    /// Validate existing cache and cleanup if hash doesn't match
    pub async fn validate_and_cleanup_if_needed(&self, current_hash: &str) -> Result<()> {
        let metadata_path = self.get_metadata_path();
        
        if Path::new(&metadata_path).exists() {
            match self.read_existing_metadata(&metadata_path).await {
                Ok(existing_metadata) => {
                    if existing_metadata.original_hash != current_hash {
                        self.cleanup_all_cached_files().await?;
                    }
                }
                Err(_) => {
                    self.cleanup_all_cached_files().await?;
                }
            }
        }
        
        Ok(())
    }

    /// Create metadata file for current processing session
    pub async fn create_metadata_file(
        &self,
        file_path: &Path,
        file_size: u64,
        file_hash: &str,
        chunk_count: usize,
    ) -> Result<()> {
        let filename = utils::get_filename_or_default(file_path, "unknown_file");

        let metadata = FileMetadata {
            original_filename: filename,
            original_size: file_size,
            original_hash: file_hash.to_string(),
            chunk_count,
            creation_time: utils::current_timestamp(),
        };

        let metadata_path = self.get_metadata_path();
        let metadata_json = serde_json::to_string_pretty(&metadata)?;
        
        // Ensure directory exists
        if let Some(parent) = Path::new(&metadata_path).parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::write(&metadata_path, metadata_json).await?;

        Ok(())
    }

    /// Get cached transcript for a chunk if it exists
    pub async fn get_cached_transcript(&self, chunk_path: &str) -> Result<Option<String>> {
        let cache_path = format!("{}.transcript.txt", chunk_path);
        
        if !Path::new(&cache_path).exists() {
            return Ok(None);
        }

        match fs::read_to_string(&cache_path).await {
            Ok(cached_text) if !cached_text.trim().is_empty() => Ok(Some(cached_text)),
            _ => Ok(None),
        }
    }

    /// Save transcript to cache file
    pub async fn save_transcript_cache(&self, chunk_path: &str, text: &str) -> Result<()> {
        let cache_path = format!("{}.transcript.txt", chunk_path);
        
        fs::write(&cache_path, text).await
            .with_context(|| format!("Failed to save transcript cache to {}", cache_path))?;
        
        Ok(())
    }

    /// Clean up all temporary files after successful processing
    pub async fn cleanup_temp_files(&self) -> Result<()> {
        
        let segment_dir = self.config.temp_dir_path().to_string_lossy().to_string();
        
        if let Ok(mut dir) = fs::read_dir(&segment_dir).await {
            while let Ok(Some(entry)) = dir.next_entry().await {
                fs::remove_file(entry.path()).await.ok();
            }
        }

        // Try to remove the directory itself
        fs::remove_dir(&segment_dir).await.ok();
        
        Ok(())
    }

    /// Clean up all cached files (used when hash mismatch is detected)
    async fn cleanup_all_cached_files(&self) -> Result<()> {
        let segment_dir = self.config.temp_dir_path().to_string_lossy().to_string();
        
        if !Path::new(&segment_dir).exists() {
            return Ok(());
        }

        match fs::read_dir(&segment_dir).await {
            Ok(mut dir) => {
                while let Ok(Some(entry)) = dir.next_entry().await {
                    if let Err(_e) = fs::remove_file(entry.path()).await {
                        // Ignore error - file might already be removed
                    }
                }
                
                // Try to remove the directory itself
                if let Err(_e) = fs::remove_dir(&segment_dir).await {
                    // Ignore error - directory might not be empty or already removed
                }
            }
            Err(_e) => {
                // Ignore error - directory might not exist
            }
        }
        
        Ok(())
    }

    fn get_metadata_path(&self) -> String {
        format!("{}/{}", 
                self.config.temp_dir_path().to_string_lossy(), 
                self.config.metadata_file)
    }

    async fn read_existing_metadata(&self, metadata_path: &str) -> Result<FileMetadata> {
        let metadata_json = fs::read_to_string(metadata_path).await?;
        serde_json::from_str(&metadata_json).map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_cache_manager_creation() {
        let config = Config::default();
        let cache_manager = CacheManager::new(&config);
        
        assert_eq!(cache_manager.config.temp_dir_name, config.temp_dir_name);
        assert_eq!(cache_manager.config.metadata_file, config.metadata_file);
    }

    #[tokio::test]
    async fn test_get_cached_transcript_nonexistent() {
        let config = Config::default();
        let cache_manager = CacheManager::new(&config);
        
        let result = cache_manager.get_cached_transcript("/nonexistent/chunk.mp3").await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), None);
    }

    #[tokio::test]
    async fn test_save_and_get_cached_transcript() {
        let temp_dir = TempDir::new().unwrap();
        let chunk_path = temp_dir.path().join("chunk.mp3").to_string_lossy().to_string();
        
        let config = Config::default();
        let cache_manager = CacheManager::new(&config);
        
        let test_content = "Test transcript content";
        
        // Save transcript
        let save_result = cache_manager.save_transcript_cache(&chunk_path, test_content).await;
        assert!(save_result.is_ok());
        
        // Get cached transcript
        let get_result = cache_manager.get_cached_transcript(&chunk_path).await;
        assert!(get_result.is_ok());
        assert_eq!(get_result.unwrap(), Some(test_content.to_string()));
    }

    #[tokio::test]
    async fn test_create_metadata_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.mp3");
        
        // Create a custom config with temp directory in our test directory
        let mut config = Config::default();
        config.temp_dir_name = temp_dir.path().join("cache").to_string_lossy().to_string();
        
        let cache_manager = CacheManager::new(&config);
        
        let result = cache_manager.create_metadata_file(
            &file_path,
            1024,
            "test_hash",
            5,
        ).await;
        
        assert!(result.is_ok());
        
        // Verify metadata file was created
        let metadata_path = cache_manager.get_metadata_path();
        assert!(Path::new(&metadata_path).exists());
        
        // Verify content
        let metadata_content = fs::read_to_string(&metadata_path).await.unwrap();
        let metadata: FileMetadata = serde_json::from_str(&metadata_content).unwrap();
        
        assert_eq!(metadata.original_filename, "test.mp3");
        assert_eq!(metadata.original_size, 1024);
        assert_eq!(metadata.original_hash, "test_hash");
        assert_eq!(metadata.chunk_count, 5);
    }

    #[tokio::test]
    async fn test_cleanup_all_cached_files() {
        let temp_dir = TempDir::new().unwrap();
        let cache_dir = temp_dir.path().join("test_cache");
        fs::create_dir_all(&cache_dir).await.unwrap();
        
        // Create some test files
        let test_files = vec!["chunk_001.mp3", "chunk_002.mp3", "chunk_001.mp3.transcript.txt", "metadata.json"];
        for file_name in &test_files {
            let file_path = cache_dir.join(file_name);
            fs::write(&file_path, "test content").await.unwrap();
            assert!(file_path.exists());
        }
        
        // Create custom config
        let mut config = Config::default();
        config.temp_dir_name = cache_dir.to_string_lossy().to_string();
        
        let cache_manager = CacheManager::new(&config);
        
        // Call cleanup function
        let result = cache_manager.cleanup_all_cached_files().await;
        assert!(result.is_ok());
        
        // Verify files are deleted
        for file_name in &test_files {
            let file_path = cache_dir.join(file_name);
            assert!(!file_path.exists(), "File {} should be deleted", file_path.display());
        }
        
        // Verify directory is also deleted
        assert!(!cache_dir.exists(), "Directory should be deleted");
    }
}