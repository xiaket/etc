//! Murmur - Audio transcription using OpenAI Whisper API
//!
//! This library provides functionality to transcribe audio files using OpenAI's Whisper API,
//! with support for large file chunking and caching.

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

/// Command line arguments
#[derive(Parser, Debug, Clone)]
#[command(name = "murmur")]
#[command(
    about = "Transcribe MP3 audio files using OpenAI Whisper API or enable voice recording mode"
)]
pub struct Args {
    /// Input MP3 file path (optional - if not provided, enters voice recording mode)
    #[arg(short, long)]
    pub input: Option<PathBuf>,

    /// Language code (e.g., 'en' for English, 'es' for Spanish)
    #[arg(short, long)]
    pub language: Option<String>,

    /// Watch mode - continuously record and transcribe audio
    #[arg(short = 'w', long)]
    pub watch: bool,
}

/// Main transcription orchestrator
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
        if args.watch {
            // Watch mode - continuous recording
            self.process_watch_mode(args).await
        } else {
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
                    // Voice recording mode
                    self.process_voice_recording(args).await
                }
            }
        }
    }

    async fn process_watch_mode(&self, args: &Args) -> Result<String> {
        println!("Watch mode: continuous recording and transcription.");
        println!("Press 'q' to stop recording and transcribe, Ctrl+C to exit.");
        println!();

        loop {
            // Process voice recording directly
            match self.process_watch_recording(args).await {
                Ok(transcription) => {
                    // Print the transcription with a timestamp
                    let timestamp = chrono::Local::now().format("%H:%M:%S");
                    println!("[{}] {}", timestamp, transcription);
                    println!(); // Add blank line for readability
                }
                Err(e) => {
                    eprintln!("Error during transcription: {}", e);
                    // Continue watching even if one transcription fails
                }
            }
        }
    }

    async fn process_watch_recording(&self, args: &Args) -> Result<String> {
        // Record audio using direct recording method
        let audio_file = VoiceRecorder::record_directly().await?;
        self.process_recorded_audio(args, audio_file, true).await
    }

    async fn process_voice_recording(&self, args: &Args) -> Result<String> {
        // Record audio using voice recorder
        let audio_file = VoiceRecorder::record_with_spacebar().await?;
        self.process_recorded_audio(args, audio_file, false).await
    }

    async fn process_recorded_audio(
        &self,
        args: &Args,
        audio_file: std::path::PathBuf,
        is_watch_mode: bool,
    ) -> Result<String> {
        // Create temporary args with the recorded file
        let mut temp_args = args.clone();
        temp_args.input = Some(audio_file.clone());

        // Show status while waiting for Whisper API
        StatusLineManager::show_status("Waiting for Whisper response...");

        // Choose transcription method based on file size and mode
        let transcription = if is_watch_mode {
            // Watch mode: check file size and use appropriate processing method
            let file_size = utils::get_file_size(&audio_file).await?;
            if file_size <= self.config.max_file_size_bytes() {
                self.client.transcribe(&temp_args).await?
            } else {
                self.process_large_file_transcription(&temp_args).await?
            }
        } else {
            // Voice recording mode: process directly
            self.client.transcribe(&temp_args).await?
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
        if args.watch {
            // Watch mode - transcription is already printed in the loop, just exit gracefully
            Ok(())
        } else {
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
                    // Voice recording mode - output to stdout
                    print!("\r");
                    println!("{}", transcription);
                    Ok(())
                }
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
            watch: false,
        };

        assert_eq!(args.input, None);
        assert_eq!(args.language, None);
        assert_eq!(args.watch, false);
    }

    #[test]
    fn test_args_with_watch_mode() {
        let args = Args {
            input: None,
            language: Some("en".to_string()),
            watch: true,
        };

        assert_eq!(args.input, None);
        assert_eq!(args.language, Some("en".to_string()));
        assert_eq!(args.watch, true);
    }

    #[test]
    fn test_args_with_input_file() {
        let args = Args {
            input: Some(PathBuf::from("test.mp3")),
            language: Some("zh".to_string()),
            watch: false,
        };

        assert_eq!(args.input, Some(PathBuf::from("test.mp3")));
        assert_eq!(args.language, Some("zh".to_string()));
        assert_eq!(args.watch, false);
    }

    #[test]
    fn test_watch_mode_conflicts_with_input() {
        // This is a logical test - watch mode should typically be used without input file
        let args = Args {
            input: Some(PathBuf::from("test.mp3")),
            language: None,
            watch: true,
        };

        // Both input and watch are set - this should work but watch mode will take precedence
        assert_eq!(args.input, Some(PathBuf::from("test.mp3")));
        assert_eq!(args.watch, true);
    }
}
