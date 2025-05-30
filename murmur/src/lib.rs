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

// Re-export commonly used items
pub use cache::CacheManager;
pub use chunking::AudioChunker;
pub use client::WhisperClient;
pub use transcription::TranscriptMerger;
pub use utils::{Config, FileMetadata};

/// Command line arguments
#[derive(Parser, Debug, Clone)]
#[command(name = "murmur")]
#[command(about = "Transcribe MP3 audio files using OpenAI Whisper API")]
pub struct Args {
    /// Input MP3 file path
    #[arg(short, long)]
    pub input: PathBuf,

    /// Language code (e.g., 'en' for English, 'es' for Spanish)
    #[arg(short, long)]
    pub language: Option<String>,
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
        // Validate input file first
        utils::validate_input_file(&args.input).await?;
        
        let file_size = utils::get_file_size(&args.input).await?;
        
        if file_size <= self.config.max_file_size_bytes() {
            // Small file - process directly
            self.process_small_file(args).await
        } else {
            // Large file - use chunking strategy
            self.process_large_file(args).await
        }
    }

    async fn process_small_file(&self, args: &Args) -> Result<String> {
        self.client.transcribe(args).await
    }

    async fn process_large_file(&self, args: &Args) -> Result<String> {
        let file_path = &args.input;
        let file_size_mb = utils::bytes_to_mb(utils::get_file_size(file_path).await?);
        
        println!(
            "Large file detected ({:.2} MB). Implementing chunking strategy...",
            file_size_mb
        );

        // Calculate file hash and handle cache validation
        let file_hash = utils::calculate_file_hash(file_path).await?;
        self.cache_manager.validate_and_cleanup_if_needed(&file_hash).await?;

        // Split the audio file into chunks
        let chunks = self.chunker.split_audio_file(file_path).await?;
        
        // Create metadata file
        self.cache_manager.create_metadata_file(
            file_path,
            utils::get_file_size(file_path).await?,
            &file_hash,
            chunks.len(),
        ).await?;

        // Process each chunk
        let mut transcripts = Vec::new();
        for (i, chunk_path) in chunks.iter().enumerate() {
            println!("Processing chunk {}/{}", i + 1, chunks.len());

            let text = self.process_chunk(args, chunk_path, i).await?;
            transcripts.push(text);
        }

        // Clean up temporary files
        self.cache_manager.cleanup_temp_files().await?;

        // Merge transcripts
        Ok(self.merger.merge_transcripts(transcripts))
    }

    async fn process_chunk(&self, args: &Args, chunk_path: &str, chunk_index: usize) -> Result<String> {
        // Check cache first
        if let Some(cached_text) = self.cache_manager.get_cached_transcript(chunk_path).await? {
            println!("Using cached transcript for chunk {}", chunk_index + 1);
            return Ok(cached_text);
        }

        // Process chunk with API
        let mut chunk_args = args.clone();
        chunk_args.input = PathBuf::from(chunk_path);

        match self.client.transcribe(&chunk_args).await {
            Ok(text) => {
                // Cache the result
                self.cache_manager.save_transcript_cache(chunk_path, &text).await?;
                println!("Transcript cached for future use");
                Ok(text)
            }
            Err(e) => {
                println!("Error processing chunk {}: {}", chunk_index + 1, e);
                Err(e)
            }
        }
    }

    pub async fn save_transcription(&self, input_path: &std::path::Path, content: &str) -> Result<PathBuf> {
        utils::save_transcription(input_path, content)
    }
}