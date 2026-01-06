//! Murmur - Audio transcription using GLM ASR
//!
//! This library provides functionality to transcribe audio files using GLM ASR via SGLang,
//! with support for voice recording, large file chunking and caching.
//!
//! # Usage
//!
//! - File transcription: `murmur file.mp3`
//! - Voice recording: `murmur` (no arguments)

use anyhow::{Context, Result};
use clap::Parser;
use std::path::PathBuf;
use std::time::Duration;

pub mod cache;
pub mod chunking;
pub mod client;
pub mod docker;
pub mod python_server;
pub mod transcription;
pub mod utils;
pub mod voice_recorder;

// Re-export commonly used items
pub use cache::CacheManager;
pub use chunking::AudioChunker;
pub use client::GlmAsrClient;
pub use docker::GlmAsrContainer;
pub use python_server::PythonServer;
pub use transcription::TranscriptMerger;
pub use utils::{Config, FileCleanupHelper, FileMetadata, ProgressDisplay, StatusLineManager};
pub use voice_recorder::VoiceRecorder;

/// Command line arguments for the Murmur audio transcription tool
#[derive(Parser, Debug, Clone)]
#[command(name = "murmur")]
#[command(
    about = "Transcribe audio files using GLM ASR or record voice for transcription"
)]
pub struct Args {
    /// Input audio file path (mp3, wav, m4a, flac, ogg). If not provided, enters voice recording mode
    pub input: Option<PathBuf>,

    /// Language code for transcription (e.g., 'en' for English, 'es' for Spanish)
    #[arg(short, long)]
    pub language: Option<String>,
}

/// Main transcription orchestrator that handles both file processing and voice recording
pub struct MurmurProcessor {
    config: Config,
    client: GlmAsrClient,
    cache_manager: CacheManager,
    chunker: AudioChunker,
    merger: TranscriptMerger,
    python_server: Option<PythonServer>,
}

impl MurmurProcessor {
    /// Create a new MurmurProcessor
    /// If GLM_ASR_URL is set, connects to external server
    /// Otherwise, starts local Python server
    pub async fn new() -> Result<Self> {
        let config = Config::default();

        // Check for external server URL
        let (client, python_server) = if let Ok(url) = std::env::var("GLM_ASR_URL") {
            // Wait for external server to be ready
            let client = GlmAsrClient::new(url.clone(), &config)?;
            Self::wait_for_server(&url, Duration::from_secs(30)).await?;

            (client, None)
        } else {
            // Start local Python server
            let mut server = PythonServer::new(config.container_port)?;

            server
                .start()
                .context("Failed to start GLM ASR Python server")?;

            // Wait for server to be ready (longer timeout for first run with model download)
            let timeout = Duration::from_secs(config.container_startup_timeout_seconds);
            server
                .wait_until_ready(timeout)
                .await
                .context("GLM ASR Python server failed to start")?;

            // Create client pointing to server
            let client = GlmAsrClient::new(server.get_api_url(), &config)?;

            (client, Some(server))
        };

        let cache_manager = CacheManager::new(&config);
        let chunker = AudioChunker::new(&config);
        let merger = TranscriptMerger::new();

        Ok(Self {
            config,
            client,
            cache_manager,
            chunker,
            merger,
            python_server,
        })
    }

    /// Wait for external server to be ready
    async fn wait_for_server(url: &str, timeout: Duration) -> Result<()> {
        let client = reqwest::Client::new();
        let health_url = format!("{}/v1/models", url);
        let start = std::time::Instant::now();

        loop {
            if start.elapsed() > timeout {
                anyhow::bail!(
                    "GLM ASR server at {} not responding after {} seconds",
                    url,
                    timeout.as_secs()
                );
            }

            match client.get(&health_url).send().await {
                Ok(response) if response.status().is_success() => {
                    return Ok(());
                }
                _ => {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }

    /// Stop the server gracefully
    pub fn shutdown(&mut self) -> Result<()> {
        if let Some(ref mut server) = self.python_server {
            server.stop()?;
        }
        Ok(())
    }

    pub async fn process(&self, args: &Args) -> Result<String> {
        match &args.input {
            Some(input_path) => {
                // File mode - process existing audio file
                utils::validate_input_file(input_path).await?;

                let file_size = utils::get_file_size(input_path).await?;

                // Python server can access local files directly
                if file_size <= self.config.max_file_size_bytes() {
                    self.process_small_file_direct(args, input_path).await
                } else {
                    self.process_large_file_direct(args, input_path).await
                }
            }
            None => {
                // Recording mode - record audio once and transcribe
                self.process_recording_mode(args).await
            }
        }
    }

    async fn process_recording_mode(&self, args: &Args) -> Result<String> {
        println!("Recording mode: recording audio.");
        println!("Press 'q' to stop recording and transcribe.");
        println!();

        // Process voice recording directly - single recording session
        self.process_recording_session(args).await
    }

    async fn process_recording_session(&self, args: &Args) -> Result<String> {
        // Record audio using direct recording method
        let audio_file = VoiceRecorder::record_directly().await?;


        // Python server can access local files directly
        let mut temp_args = args.clone();
        temp_args.input = Some(audio_file.clone());

        let audio_path = audio_file
            .canonicalize()
            .unwrap_or(audio_file.clone())
            .to_string_lossy()
            .to_string();
        let file_size = utils::get_file_size(&audio_file).await?;

        let transcription = if file_size <= self.config.max_file_size_bytes() {
            self.client.transcribe(&temp_args, &audio_path).await?
        } else {
            self.process_large_file_direct(&temp_args, &audio_file)
                .await?
        };

        // Clean up temporary audio file
        FileCleanupHelper::cleanup_file(&audio_file).await?;

        Ok(transcription)
    }

    /// Process small file (direct path)
    async fn process_small_file_direct(
        &self,
        args: &Args,
        file_path: &std::path::Path,
    ) -> Result<String> {
        let path_str = file_path
            .canonicalize()
            .context("Failed to get absolute path")?
            .to_string_lossy()
            .to_string();
        self.client.transcribe(args, &path_str).await
    }

    /// Process large file
    async fn process_large_file_direct(
        &self,
        args: &Args,
        file_path: &std::path::Path,
    ) -> Result<String> {
        let file_size_mb = utils::bytes_to_mb(utils::get_file_size(file_path).await?);
        println!("Processing large file ({:.1} MB)...", file_size_mb);

        // Calculate file hash and handle cache validation
        let file_hash = utils::calculate_file_hash(file_path).await?;
        self.cache_manager
            .validate_and_cleanup_if_needed(&file_hash)
            .await?;

        // Create metadata file after splitting
        let chunks = self.chunker.split_audio_file(file_path).await?;
        self.cache_manager
            .create_metadata_file(
                file_path,
                utils::get_file_size(file_path).await?,
                &file_hash,
                chunks.len(),
            )
            .await?;

        self.process_chunks_with_cache(args, chunks).await
    }

    async fn process_chunks_with_cache(
        &self,
        args: &Args,
        chunks: Vec<String>,
    ) -> Result<String> {
        let mut transcripts = Vec::new();
        for (i, chunk_path) in chunks.iter().enumerate() {
            let chunk_size = utils::get_file_size(std::path::Path::new(chunk_path)).await?;
            let chunk_size_mb = utils::bytes_to_mb(chunk_size);

            ProgressDisplay::show_chunk_progress(i + 1, chunks.len(), chunk_size_mb);

            let text = self.process_chunk(args, chunk_path, i).await?;
            transcripts.push(text);
        }

        ProgressDisplay::clear_progress();
        self.cache_manager.cleanup_temp_files().await?;
        Ok(self.merger.merge_transcripts(transcripts))
    }

    async fn process_chunk(
        &self,
        args: &Args,
        chunk_path: &str,
        chunk_index: usize,
    ) -> Result<String> {
        // Check cache first
        if let Some(cached_text) = self.cache_manager.get_cached_transcript(chunk_path).await? {
            return Ok(cached_text);
        }

        // Process chunk with API
        let mut chunk_args = args.clone();
        chunk_args.input = Some(PathBuf::from(chunk_path));

        match self.client.transcribe(&chunk_args, chunk_path).await {
            Ok(text) => {
                // Cache the result
                self.cache_manager
                    .save_transcript_cache(chunk_path, &text)
                    .await?;
                Ok(text)
            }
            Err(e) => {
                println!("\rError processing chunk {}: {}", chunk_index + 1, e);
                Err(e)
            }
        }
    }

    pub async fn save_transcription(
        &self,
        input_path: &std::path::Path,
        content: &str,
    ) -> Result<PathBuf> {
        utils::save_transcription(input_path, content).await
    }

    /// Handle output based on the mode and arguments
    pub async fn handle_output(&self, args: &Args, transcription: &str) -> Result<()> {
        match &args.input {
            Some(input_path) => {
                // File mode - save to file
                let output_path = self.save_transcription(input_path, transcription).await?;
                println!(
                    "Processing complete: {:?}",
                    output_path.file_name().unwrap_or_default()
                );
                Ok(())
            }
            None => {
                // Recording mode - output to stdout (clear the "Transcribing..." line first)
                print!("\r\x1b[2K");
                println!("{}", transcription);
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_args_default_values() {
        let args = Args {
            input: None,
            language: None,
        };

        assert_eq!(args.input, None);
        assert_eq!(args.language, None);
    }

    #[test]
    fn test_args_recording_mode_when_no_input() {
        let args = Args {
            input: None,
            language: Some("en".to_string()),
        };

        assert_eq!(args.input, None);
        assert_eq!(args.language, Some("en".to_string()));
        // Recording mode is determined by input being None
        assert!(args.input.is_none());
    }

    #[test]
    fn test_args_file_mode_when_input_provided() {
        let args = Args {
            input: Some(PathBuf::from("test.mp3")),
            language: Some("zh".to_string()),
        };

        assert_eq!(args.input, Some(PathBuf::from("test.mp3")));
        assert_eq!(args.language, Some("zh".to_string()));
        // File mode is determined by input being Some
        assert!(args.input.is_some());
    }
}
