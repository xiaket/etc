use anyhow::{Context, Result};
use std::path::Path;
use std::process::Command;

use crate::utils::{self, Config};

/// Audio file chunking functionality
pub struct AudioChunker {
    config: Config,
}

impl AudioChunker {
    pub fn new(config: &Config) -> Self {
        Self {
            config: config.clone(),
        }
    }

    pub async fn split_audio_file(&self, input_path: &Path) -> Result<Vec<String>> {
        let total_size = utils::get_file_size(input_path).await?;
        let segment_dir = self.prepare_segment_directory().await?;


        let duration = self.get_audio_duration(input_path)?;
        let chunks = self.create_chunks(input_path, total_size, duration, &segment_dir)?;

        if chunks.is_empty() {
            anyhow::bail!("Failed to create any audio chunks");
        }

        Ok(chunks)
    }

    async fn prepare_segment_directory(&self) -> Result<String> {
        let segment_dir = self.config.temp_dir_path().to_string_lossy().to_string();

        if !Path::new(&segment_dir).exists() {
            std::fs::create_dir_all(&segment_dir)?;
        }

        Ok(segment_dir)
    }

    fn get_audio_duration(&self, input_path: &Path) -> Result<f64> {
        let duration_output = Command::new("ffprobe")
            .args([
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                input_path.to_str().context("Invalid file path encoding")?,
            ])
            .output()?;

        if !duration_output.status.success() {
            let error = String::from_utf8_lossy(&duration_output.stderr);
            anyhow::bail!("FFprobe error: {}", error);
        }

        let duration_str = String::from_utf8_lossy(&duration_output.stdout)
            .trim()
            .to_string();
        
        duration_str.parse().map_err(Into::into)
    }

    fn create_chunks(
        &self,
        input_path: &Path,
        total_size: u64,
        duration: f64,
        segment_dir: &str,
    ) -> Result<Vec<String>> {
        let chunk_info = self.calculate_chunk_parameters(total_size, duration);
        

        let mut chunks = Vec::new();
        let mut start_time = 0.0;
        let mut chunk_index = 0;

        while start_time < duration {
            let chunk_path = format!("{}/chunk_{:03}.mp3", segment_dir, chunk_index);
            
            // Calculate actual start and end times with overlap
            let actual_start = if chunk_index == 0 {
                // First chunk starts at the beginning
                0.0
            } else {
                // Subsequent chunks start 10 seconds earlier for overlap
                (start_time - self.config.grace_period_seconds as f64).max(0.0)
            };
            
            let theoretical_end = start_time + chunk_info.seconds_per_chunk;
            let actual_end = if theoretical_end >= duration {
                // Last chunk ends at the end of the file
                duration
            } else {
                // Add 10 seconds for overlap, but don't exceed file duration
                (theoretical_end + self.config.grace_period_seconds as f64).min(duration)
            };
            
            let chunk_duration = actual_end - actual_start;

            if chunk_duration > 1.0 {
                self.create_single_chunk(input_path, &chunk_path, actual_start, chunk_duration)?;
                chunks.push(chunk_path);
                start_time += chunk_info.seconds_per_chunk;
                chunk_index += 1;
            } else {
                break;
            }
        }

        Ok(chunks)
    }

    fn calculate_chunk_parameters(&self, total_size: u64, duration: f64) -> ChunkInfo {
        let bytes_per_second = total_size as f64 / duration;
        let target_size_bytes = self.config.chunk_size_bytes() as f64;
        let seconds_per_chunk = target_size_bytes / bytes_per_second;

        ChunkInfo {
            seconds_per_chunk,
        }
    }

    fn create_single_chunk(
        &self,
        input_path: &Path,
        chunk_path: &str,
        start_time: f64,
        chunk_duration: f64,
    ) -> Result<()> {
        let output = Command::new("ffmpeg")
            .args([
                "-y", // Overwrite output files without asking
                "-i", input_path.to_str().context("Invalid file path encoding")?,
                "-ss", &start_time.to_string(),
                "-t", &chunk_duration.to_string(),
                "-c:a", "copy", // Just copy audio stream, no re-encoding
                "-loglevel", "error",
                chunk_path,
            ])
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("FFmpeg error when creating chunk: {}", error);
        }

        Ok(())
    }
}

struct ChunkInfo {
    seconds_per_chunk: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_chunk_parameters() {
        let config = Config::default();
        let chunker = AudioChunker::new(&config);
        
        // Test with 100MB file, 1000 seconds duration
        let total_size = 100 * 1024 * 1024; // 100MB
        let duration = 1000.0; // 1000 seconds
        
        let chunk_info = chunker.calculate_chunk_parameters(total_size, duration);
        
        assert!(chunk_info.seconds_per_chunk > 0.0);
        
        // With 100MB file and ~23MB target chunk size, should have reasonable chunk duration
        assert!(chunk_info.seconds_per_chunk > 200.0 && chunk_info.seconds_per_chunk < 300.0);
    }

    #[test]
    fn test_chunker_creation() {
        let config = Config::default();
        let chunker = AudioChunker::new(&config);
        
        assert_eq!(chunker.config.chunk_size_mb, config.chunk_size_mb);
        assert_eq!(chunker.config.temp_dir_name, config.temp_dir_name);
    }

    #[test]
    fn test_overlap_calculation() {
        let config = Config::default();
        let chunker = AudioChunker::new(&config);
        
        // Test with 100MB file, 1000 seconds duration
        let total_size = 100 * 1024 * 1024; // 100MB
        let duration = 1000.0; // 1000 seconds
        
        let chunk_info = chunker.calculate_chunk_parameters(total_size, duration);
        
        // With overlap, chunks should have some buffer time
        // Grace period is 10 seconds, so we should see overlap in the logic
        assert!(chunk_info.seconds_per_chunk > 0.0);
        assert_eq!(config.grace_period_seconds, 10);
    }
}