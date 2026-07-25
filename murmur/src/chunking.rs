use anyhow::{Context, Result};
use std::path::Path;
use std::process::Command;

use crate::utils::{self, Config, GRACE_PERIOD_SECONDS};

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
        std::fs::create_dir_all(&self.config.temp_dir)?;

        let duration = get_audio_duration(input_path)?;
        let chunks = self.create_chunks(input_path, total_size, duration)?;

        if chunks.is_empty() {
            anyhow::bail!("Failed to create any audio chunks");
        }

        Ok(chunks)
    }

    fn create_chunks(
        &self,
        input_path: &Path,
        total_size: u64,
        duration: f64,
    ) -> Result<Vec<String>> {
        let seconds_per_chunk = self.seconds_per_chunk(total_size, duration);
        let grace_period = GRACE_PERIOD_SECONDS as f64;

        let mut chunks = Vec::new();
        let mut start_time = 0.0;
        let mut chunk_index = 0;

        while start_time < duration {
            let chunk_path = self
                .config
                .temp_dir
                .join(format!("chunk_{:03}.mp3", chunk_index))
                .to_string_lossy()
                .to_string();

            // First chunk starts at the beginning; subsequent chunks start
            // earlier by the grace period so consecutive chunks overlap
            let actual_start = if chunk_index == 0 {
                0.0
            } else {
                (start_time - grace_period).max(0.0)
            };

            // Extend the end by the grace period for overlap, capped at file duration
            let theoretical_end = start_time + seconds_per_chunk;
            let actual_end = if theoretical_end >= duration {
                duration
            } else {
                (theoretical_end + grace_period).min(duration)
            };

            let chunk_duration = actual_end - actual_start;
            if chunk_duration <= 1.0 {
                break;
            }

            create_single_chunk(input_path, &chunk_path, actual_start, chunk_duration)?;
            chunks.push(chunk_path);
            start_time += seconds_per_chunk;
            chunk_index += 1;
        }

        Ok(chunks)
    }

    fn seconds_per_chunk(&self, total_size: u64, duration: f64) -> f64 {
        let bytes_per_second = total_size as f64 / duration;
        self.config.chunk_size_bytes() as f64 / bytes_per_second
    }
}

fn get_audio_duration(input_path: &Path) -> Result<f64> {
    let duration_output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            input_path.to_str().context("Invalid file path encoding")?,
        ])
        .output()?;

    if !duration_output.status.success() {
        let error = String::from_utf8_lossy(&duration_output.stderr);
        anyhow::bail!("FFprobe error: {}", error);
    }

    String::from_utf8_lossy(&duration_output.stdout)
        .trim()
        .parse()
        .map_err(Into::into)
}

fn create_single_chunk(
    input_path: &Path,
    chunk_path: &str,
    start_time: f64,
    chunk_duration: f64,
) -> Result<()> {
    let output = Command::new("ffmpeg")
        .args([
            "-y", // Overwrite output files without asking
            "-i",
            input_path.to_str().context("Invalid file path encoding")?,
            "-ss",
            &start_time.to_string(),
            "-t",
            &chunk_duration.to_string(),
            "-c:a",
            "libmp3lame", // Encode to MP3 (handles WAV and other input formats)
            "-q:a",
            "2", // High quality VBR encoding
            "-loglevel",
            "error",
            chunk_path,
        ])
        .output()?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("FFmpeg error when creating chunk: {}", error);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seconds_per_chunk() {
        let chunker = AudioChunker::new(&Config::default());

        // 100MB file, 1000 seconds duration, 20MB chunks => 200 seconds per chunk
        let total_size = 100 * 1024 * 1024;
        let duration = 1000.0;

        let seconds = chunker.seconds_per_chunk(total_size, duration);
        assert!((seconds - 200.0).abs() < 1e-9);
    }
}
