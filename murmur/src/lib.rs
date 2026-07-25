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
use futures::stream::{self, StreamExt};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

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
pub use utils::{Config, FileMetadata};
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

    /// Chunk size in MB for splitting large audio files (default: 20)
    #[arg(short, long)]
    pub chunk_size: Option<u64>,
}

/// Main transcription orchestrator that handles both file processing and voice recording
pub struct MurmurProcessor {
    config: Config,
    client: WhisperClient,
    cache_manager: CacheManager,
    chunker: AudioChunker,
}

impl MurmurProcessor {
    pub fn new(api_key: String, chunk_size_mb: Option<u64>) -> Result<Self> {
        let mut config = Config::default();
        if let Some(size) = chunk_size_mb {
            config.chunk_size_mb = size;
            // Use the same value as the threshold for triggering chunking
            config.max_file_size_mb = size;
        }
        let client = WhisperClient::new(api_key)?;
        let cache_manager = CacheManager::new(&config);
        let chunker = AudioChunker::new(&config);

        Ok(Self {
            config,
            client,
            cache_manager,
            chunker,
        })
    }

    pub async fn process(&self, args: &Args) -> Result<String> {
        match &args.input {
            Some(input_path) => {
                // File mode - process existing audio file
                utils::validate_input_file(input_path).await?;

                let file_size = utils::get_file_size(input_path).await?;
                if file_size <= self.config.max_file_size_bytes() {
                    self.client.transcribe(args).await
                } else {
                    self.process_large_file(args, true).await
                }
            }
            None => {
                // Recording mode - record audio once and transcribe
                self.process_recording(args).await
            }
        }
    }

    async fn process_recording(&self, args: &Args) -> Result<String> {
        println!("Recording mode: recording audio.");
        println!("Press 'q' to stop recording and transcribe.");
        println!();

        let audio_file = VoiceRecorder::record_directly().await?;
        let mut temp_args = args.clone();
        temp_args.input = Some(audio_file.clone());

        utils::show_status("Waiting for Whisper response...");
        let file_size = utils::get_file_size(&audio_file).await?;
        let transcription = if file_size <= self.config.max_file_size_bytes() {
            self.client.transcribe(&temp_args).await?
        } else {
            // Temporary recording - no cache, direct processing
            self.process_large_file(&temp_args, false).await?
        };
        utils::clear_status();

        utils::cleanup_file(&audio_file).await?;

        // Enhance the transcription using OpenAI
        utils::show_status("Waiting for OpenAI response...");
        let prompt = format!(
            "Please improve and format the following transcribed text. Fix any grammar issues, make it coherent, add proper punctuation, and make it more readable while preserving the original meaning. Output only the improved text without any explanations:\n\n{}",
            transcription
        );
        let result = self.client.enhance_text(&prompt).await?;
        utils::clear_status();

        Ok(result)
    }

    async fn process_large_file(&self, args: &Args, use_cache: bool) -> Result<String> {
        let file_path = args.input.as_ref().unwrap();
        let file_size = utils::get_file_size(file_path).await?;

        if use_cache {
            println!(
                "Processing large file ({:.1} MB)...",
                utils::bytes_to_mb(file_size)
            );

            let file_hash = utils::calculate_file_hash(file_path).await?;
            self.cache_manager
                .validate_and_cleanup_if_needed(&file_hash)
                .await;

            let chunks = self.chunker.split_audio_file(file_path).await?;
            self.cache_manager
                .create_metadata_file(file_path, file_size, &file_hash, chunks.len())
                .await?;

            let transcript = self.process_chunks(args, chunks, true).await?;
            self.cache_manager.cleanup().await;
            Ok(transcript)
        } else {
            let chunks = self.chunker.split_audio_file(file_path).await?;
            let chunk_paths: Vec<PathBuf> = chunks.iter().map(PathBuf::from).collect();

            let transcript = self.process_chunks(args, chunks, false).await?;
            utils::cleanup_files(&chunk_paths).await?;
            Ok(transcript)
        }
    }

    async fn process_chunks(
        &self,
        args: &Args,
        chunks: Vec<String>,
        use_cache: bool,
    ) -> Result<String> {
        let total_chunks = chunks.len();
        let completed = AtomicUsize::new(0);

        // Process chunks in parallel with concurrency limit
        let results: Vec<Result<(usize, String)>> = stream::iter(chunks.into_iter().enumerate())
            .map(|(i, chunk_path)| {
                let completed = &completed;
                async move {
                    let text = self.transcribe_chunk(args, &chunk_path, use_cache).await?;
                    let done = completed.fetch_add(1, Ordering::SeqCst) + 1;
                    utils::show_progress(done, total_chunks);
                    Ok((i, text))
                }
            })
            .buffer_unordered(4) // Process up to 4 chunks concurrently
            .collect()
            .await;

        utils::clear_status();

        // Sort results by chunk index and merge transcripts
        let mut indexed_transcripts: Vec<(usize, String)> =
            results.into_iter().collect::<Result<Vec<_>>>()?;
        indexed_transcripts.sort_by_key(|(i, _)| *i);
        let transcripts = indexed_transcripts.into_iter().map(|(_, t)| t).collect();

        Ok(transcription::merge_transcripts(transcripts))
    }

    async fn transcribe_chunk(
        &self,
        args: &Args,
        chunk_path: &str,
        use_cache: bool,
    ) -> Result<String> {
        if use_cache {
            if let Some(cached_text) = self.cache_manager.get_cached_transcript(chunk_path).await? {
                return Ok(cached_text);
            }
        }

        let mut chunk_args = args.clone();
        chunk_args.input = Some(PathBuf::from(chunk_path));
        let text = self.client.transcribe(&chunk_args).await?;

        if use_cache {
            self.cache_manager
                .save_transcript_cache(chunk_path, &text)
                .await?;
        }

        Ok(text)
    }

    /// Handle output based on the mode and arguments
    pub async fn handle_output(&self, args: &Args, transcription: &str) -> Result<()> {
        match &args.input {
            Some(input_path) => {
                // File mode - save to file
                let output_path = utils::save_transcription(input_path, transcription).await?;
                println!(
                    "Processing complete: {:?}",
                    output_path.file_name().unwrap_or_default()
                );
            }
            None => {
                // Recording mode - output to stdout
                print!("\r");
                println!("{}", transcription);
            }
        }
        Ok(())
    }
}
