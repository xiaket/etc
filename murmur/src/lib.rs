//! Murmur - Audio transcription using OpenAI Whisper API
//!
//! This library provides functionality to transcribe audio files using OpenAI's Whisper API,
//! with support for voice recording, large file chunking and caching.
//! 
//! # Usage
//! 
//! - File transcription: `murmur file.mp3`
//! - Voice recording: `murmur` (no arguments)

use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;

pub mod cache;
pub mod chunking;
pub mod client;
pub mod transcription;
pub mod utils;
pub mod voice_recorder;

// Re-export commonly used items
pub use cache::CacheManager;
pub use chunking::AudioChunker;
pub use client::WhisperClient;
pub use transcription::TranscriptMerger;
pub use utils::{Config, FileCleanupHelper, FileMetadata, ProgressDisplay, StatusLineManager};
pub use voice_recorder::VoiceRecorder;

/// Command line arguments for the Murmur audio transcription tool
#[derive(Parser, Debug, Clone)]
#[command(name = "murmur")]
#[command(
    about = "Transcribe MP3 audio files using OpenAI Whisper API or record voice for transcription"
)]
pub struct Args {
    /// Input MP3 file path. If not provided, enters voice recording mode
    pub input: Option<PathBuf>,

    /// Language code for transcription (e.g., 'en' for English, 'es' for Spanish)
    #[arg(short, long)]
    pub language: Option<String>,
}

/// Main transcription orchestrator that handles both file processing and voice recording
pub struct MurmurProcessor {
    config: Config,
    client: WhisperClient,
    cache_manager: CacheManager,
    chunker: AudioChunker,
    merger: TranscriptMerger,
}

impl MurmurProcessor {
    pub fn new(api_key: String) -> Result<Self> {
        let config = Config::default();
        let client = WhisperClient::new(api_key, &config)?;
        let cache_manager = CacheManager::new(&config);
        let chunker = AudioChunker::new(&config);
        let merger = TranscriptMerger::new();

        Ok(Self {
            config,
            client,
            cache_manager,
            chunker,
            merger,
        })
    }

    pub async fn process(&self, args: &Args) -> Result<String> {
        match &args.input {
            Some(input_path) => {
                // File mode - process existing audio file
                utils::validate_input_file(input_path).await?;

                let file_size = utils::get_file_size(input_path).await?;

                if file_size <= self.config.max_file_size_bytes() {
                    // Small file - process directly
                    self.process_small_file(args).await
                } else {
                    // Large file - use chunking strategy
                    self.process_large_file(args).await
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
        
        // Create temporary args with the recorded file
        let mut temp_args = args.clone();
        temp_args.input = Some(audio_file.clone());

        // Show status while waiting for Whisper API
        StatusLineManager::show_status("Waiting for Whisper response...");

        // Choose transcription method based on file size
        let transcription = {
            let file_size = utils::get_file_size(&audio_file).await?;
            if file_size <= self.config.max_file_size_bytes() {
                self.client.transcribe(&temp_args).await?
            } else {
                self.process_large_file_transcription(&temp_args).await?
            }
        };

        // Clear the status line
        StatusLineManager::clear_status();

        // Clean up temporary audio file
        FileCleanupHelper::cleanup_file(&audio_file).await?;

        // Show status while waiting for OpenAI enhancement
        StatusLineManager::show_status("Waiting for OpenAI response...");

        // Enhance the transcription using OpenAI
        let result = self.enhance_transcription(&transcription).await?;

        // Clear the status line
        StatusLineManager::clear_status();

        Ok(result)
    }

    async fn enhance_transcription(&self, text: &str) -> Result<String> {
        let prompt = format!(
            "Please improve and format the following transcribed text. Fix any grammar issues, make it coherent, add proper punctuation, and make it more readable while preserving the original meaning. Output only the improved text without any explanations:\n\n{}",
            text
        );

        let enhanced_text = self.client.enhance_text(&prompt).await?;
        Ok(enhanced_text)
    }

    async fn process_small_file(&self, args: &Args) -> Result<String> {
        self.client.transcribe(args).await
    }

    async fn process_large_file(&self, args: &Args) -> Result<String> {
        self.process_large_file_internal(args, true).await
    }

    async fn process_large_file_transcription(&self, args: &Args) -> Result<String> {
        self.process_large_file_internal(args, false).await
    }

    async fn process_large_file_internal(&self, args: &Args, use_cache: bool) -> Result<String> {
        let file_path = args.input.as_ref().unwrap();

        if use_cache {
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
        } else {
            // For temporary recordings - no cache, direct processing
            let chunks = self.chunker.split_audio_file(file_path).await?;
            self.process_chunks_without_cache(args, chunks).await
        }
    }

    async fn process_chunks_with_cache(&self, args: &Args, chunks: Vec<String>) -> Result<String> {
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

    async fn process_chunks_without_cache(
        &self,
        args: &Args,
        chunks: Vec<String>,
    ) -> Result<String> {
        let mut transcripts = Vec::new();
        for (i, chunk_path) in chunks.iter().enumerate() {
            let chunk_size = utils::get_file_size(std::path::Path::new(chunk_path)).await?;
            let chunk_size_mb = utils::bytes_to_mb(chunk_size);

            ProgressDisplay::show_chunk_progress(i + 1, chunks.len(), chunk_size_mb);

            // Process chunk directly without caching
            let mut chunk_args = args.clone();
            chunk_args.input = Some(std::path::PathBuf::from(chunk_path));
            let text = self.client.transcribe(&chunk_args).await?;
            transcripts.push(text);
        }

        ProgressDisplay::clear_progress();

        // Clean up temporary chunk files
        let chunk_paths: Vec<std::path::PathBuf> =
            chunks.into_iter().map(std::path::PathBuf::from).collect();
        FileCleanupHelper::cleanup_files(&chunk_paths).await?;

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

        match self.client.transcribe(&chunk_args).await {
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
                // Recording mode - output to stdout
                print!("\r");
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
