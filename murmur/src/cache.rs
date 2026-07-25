use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::fs;

use crate::utils::{self, Config, FileMetadata, METADATA_FILE};

/// Cache management for audio chunks and transcripts
pub struct CacheManager {
    temp_dir: PathBuf,
}

impl CacheManager {
    pub fn new(config: &Config) -> Self {
        Self {
            temp_dir: config.temp_dir.clone(),
        }
    }

    /// Validate existing cache and cleanup if hash doesn't match
    pub async fn validate_and_cleanup_if_needed(&self, current_hash: &str) {
        let metadata_path = self.metadata_path();
        if metadata_path.exists() {
            match read_metadata(&metadata_path).await {
                Ok(metadata) if metadata.original_hash == current_hash => {}
                _ => self.cleanup().await,
            }
        }
    }

    /// Create metadata file for current processing session
    pub async fn create_metadata_file(
        &self,
        file_path: &Path,
        file_size: u64,
        file_hash: &str,
        chunk_count: usize,
    ) -> Result<()> {
        let metadata = FileMetadata {
            original_filename: utils::get_filename_or_default(file_path, "unknown_file"),
            original_size: file_size,
            original_hash: file_hash.to_string(),
            chunk_count,
            creation_time: utils::current_timestamp(),
        };

        fs::create_dir_all(&self.temp_dir).await?;
        fs::write(
            self.metadata_path(),
            serde_json::to_string_pretty(&metadata)?,
        )
        .await?;

        Ok(())
    }

    /// Get cached transcript for a chunk if it exists
    pub async fn get_cached_transcript(&self, chunk_path: &str) -> Result<Option<String>> {
        match fs::read_to_string(transcript_cache_path(chunk_path)).await {
            Ok(cached_text) if !cached_text.trim().is_empty() => Ok(Some(cached_text)),
            _ => Ok(None),
        }
    }

    /// Save transcript to cache file
    pub async fn save_transcript_cache(&self, chunk_path: &str, text: &str) -> Result<()> {
        let cache_path = transcript_cache_path(chunk_path);
        fs::write(&cache_path, text)
            .await
            .with_context(|| format!("Failed to save transcript cache to {}", cache_path))
    }

    /// Remove all cached files and the cache directory itself.
    /// Errors are ignored — files may already be gone.
    pub async fn cleanup(&self) {
        if let Ok(mut dir) = fs::read_dir(&self.temp_dir).await {
            while let Ok(Some(entry)) = dir.next_entry().await {
                fs::remove_file(entry.path()).await.ok();
            }
        }
        fs::remove_dir(&self.temp_dir).await.ok();
    }

    fn metadata_path(&self) -> PathBuf {
        self.temp_dir.join(METADATA_FILE)
    }
}

fn transcript_cache_path(chunk_path: &str) -> String {
    format!("{}.transcript.txt", chunk_path)
}

async fn read_metadata(metadata_path: &Path) -> Result<FileMetadata> {
    let metadata_json = fs::read_to_string(metadata_path).await?;
    serde_json::from_str(&metadata_json).map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_get_cached_transcript_nonexistent() {
        let cache_manager = CacheManager::new(&Config::default());

        let result = cache_manager
            .get_cached_transcript("/nonexistent/chunk.mp3")
            .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), None);
    }

    #[tokio::test]
    async fn test_save_and_get_cached_transcript() {
        let temp_dir = TempDir::new().unwrap();
        let chunk_path = temp_dir
            .path()
            .join("chunk.mp3")
            .to_string_lossy()
            .to_string();

        let cache_manager = CacheManager::new(&Config::default());

        let test_content = "Test transcript content";

        // Save transcript
        let save_result = cache_manager
            .save_transcript_cache(&chunk_path, test_content)
            .await;
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

        // Use a cache directory inside our test directory
        let config = Config {
            temp_dir: temp_dir.path().join("cache"),
            ..Config::default()
        };
        let cache_manager = CacheManager::new(&config);

        let result = cache_manager
            .create_metadata_file(&file_path, 1024, "test_hash", 5)
            .await;

        assert!(result.is_ok());

        // Verify metadata file was created with the right content
        let metadata_path = cache_manager.metadata_path();
        assert!(metadata_path.exists());

        let metadata_content = fs::read_to_string(&metadata_path).await.unwrap();
        let metadata: FileMetadata = serde_json::from_str(&metadata_content).unwrap();

        assert_eq!(metadata.original_filename, "test.mp3");
        assert_eq!(metadata.original_size, 1024);
        assert_eq!(metadata.original_hash, "test_hash");
        assert_eq!(metadata.chunk_count, 5);
    }

    #[tokio::test]
    async fn test_cleanup() {
        let temp_dir = TempDir::new().unwrap();
        let cache_dir = temp_dir.path().join("test_cache");
        fs::create_dir_all(&cache_dir).await.unwrap();

        // Create some test files
        let test_files = vec![
            "chunk_001.mp3",
            "chunk_002.mp3",
            "chunk_001.mp3.transcript.txt",
            "metadata.json",
        ];
        for file_name in &test_files {
            let file_path = cache_dir.join(file_name);
            fs::write(&file_path, "test content").await.unwrap();
            assert!(file_path.exists());
        }

        let config = Config {
            temp_dir: cache_dir.clone(),
            ..Config::default()
        };
        let cache_manager = CacheManager::new(&config);
        cache_manager.cleanup().await;

        // Verify files and directory are deleted
        for file_name in &test_files {
            let file_path = cache_dir.join(file_name);
            assert!(
                !file_path.exists(),
                "File {} should be deleted",
                file_path.display()
            );
        }
        assert!(!cache_dir.exists(), "Directory should be deleted");
    }
}
