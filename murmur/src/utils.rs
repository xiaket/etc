use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;

// Constants
pub const WHISPER_TIMEOUT_SECONDS: u64 = 600;
pub const MAX_FILE_SIZE_MB: u64 = 25;
pub const CHUNK_SIZE_MB: u64 = 23;
pub const GRACE_PERIOD_SECONDS: u64 = 10;
pub const TEMP_DIR_NAME: &str = "murmur_audio_chunks";
pub const METADATA_FILE: &str = "metadata.json";

/// Configuration structure to centralize all constants and settings
#[derive(Debug, Clone)]
pub struct Config {
    pub whisper_timeout_seconds: u64,
    pub max_file_size_mb: u64,
    pub chunk_size_mb: u64,
    pub grace_period_seconds: u64,
    pub temp_dir_name: String,
    pub metadata_file: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            whisper_timeout_seconds: WHISPER_TIMEOUT_SECONDS,
            max_file_size_mb: MAX_FILE_SIZE_MB,
            chunk_size_mb: CHUNK_SIZE_MB,
            grace_period_seconds: GRACE_PERIOD_SECONDS,
            temp_dir_name: TEMP_DIR_NAME.to_string(),
            metadata_file: METADATA_FILE.to_string(),
        }
    }
}

impl Config {
    pub fn max_file_size_bytes(&self) -> u64 {
        self.max_file_size_mb * 1024 * 1024
    }

    pub fn chunk_size_bytes(&self) -> u64 {
        self.chunk_size_mb * 1024 * 1024
    }

    pub fn temp_dir_path(&self) -> PathBuf {
        std::env::temp_dir().join(&self.temp_dir_name)
    }
}

/// File metadata structure for caching
#[derive(Serialize, Deserialize, Debug)]
pub struct FileMetadata {
    pub original_filename: String,
    pub original_size: u64,
    pub original_hash: String,
    pub chunk_count: usize,
    pub creation_time: u64,
}

/// Calculate file hash using SHA256
pub async fn calculate_file_hash(file_path: &Path) -> Result<String> {
    sha256::try_digest(file_path).map_err(Into::into)
}

/// Get file size in bytes
pub async fn get_file_size(file_path: &Path) -> Result<u64> {
    let metadata = fs::metadata(file_path)
        .await
        .context("Failed to read file metadata")?;
    Ok(metadata.len())
}

/// Convert bytes to megabytes
pub fn bytes_to_mb(bytes: u64) -> f64 {
    bytes as f64 / (1024.0 * 1024.0)
}

/// Validate that input file exists, is readable, and is an MP3 file
pub async fn validate_input_file(file_path: &Path) -> Result<()> {
    if !file_path.exists() {
        anyhow::bail!("Input file {:?} does not exist", file_path);
    }
    
    // Check file extension
    match file_path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) if ext.to_lowercase() == "mp3" => {},
        Some(ext) => anyhow::bail!("Unsupported file format: .{}. Only MP3 files are supported.", ext),
        None => anyhow::bail!("File has no extension. Only MP3 files are supported."),
    }
    
    Ok(())
}

/// Save transcription to file
pub async fn save_transcription(input_path: &Path, content: &str) -> Result<PathBuf> {
    let output_path = input_path.with_extension("txt");
    tokio::fs::write(&output_path, content)
        .await
        .context("Failed to write output file")?;
    Ok(output_path)
}

/// Extract filename from path with fallback
pub fn get_filename_or_default(file_path: &Path, default: &str) -> String {
    file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(default)
        .to_string()
}

/// Get current timestamp in seconds since epoch
pub fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_calculate_file_hash() {
        let mut temp_file = NamedTempFile::new().unwrap();
        let test_content = b"Hello, world!";
        temp_file.write_all(test_content).unwrap();
        temp_file.flush().unwrap();

        let result = calculate_file_hash(temp_file.path()).await;
        assert!(result.is_ok());
        
        // SHA256 of "Hello, world!" should be consistent
        let expected_hash = "315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3";
        assert_eq!(result.unwrap(), expected_hash);
    }

    #[tokio::test]
    async fn test_get_file_size() {
        let mut temp_file = NamedTempFile::new().unwrap();
        let test_content = b"Hello, world!";
        temp_file.write_all(test_content).unwrap();
        temp_file.flush().unwrap();

        let result = get_file_size(temp_file.path()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), test_content.len() as u64);
    }

    #[test]
    fn test_bytes_to_mb() {
        assert_eq!(bytes_to_mb(1024 * 1024), 1.0);
        assert_eq!(bytes_to_mb(2 * 1024 * 1024), 2.0);
        assert_eq!(bytes_to_mb(1536 * 1024), 1.5);
    }

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert_eq!(config.max_file_size_bytes(), 25 * 1024 * 1024);
        assert_eq!(config.chunk_size_bytes(), 23 * 1024 * 1024);
    }

    #[tokio::test]
    async fn test_save_transcription() {
        let temp_file = NamedTempFile::new().unwrap();
        let path = temp_file.path().to_path_buf();
        
        let content = "Test transcription content";
        let result = save_transcription(&path, content).await;
        
        assert!(result.is_ok());
        let output_path = result.unwrap();
        assert_eq!(output_path.extension().unwrap(), "txt");
        
        let saved_content = tokio::fs::read_to_string(&output_path).await.unwrap();
        assert_eq!(saved_content, content);
        
        tokio::fs::remove_file(output_path).await.ok();
    }
}