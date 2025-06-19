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
pub use utils::{Config, FileMetadata};
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

        // Create temporary args with the recorded file
        let mut temp_args = args.clone();
        temp_args.input = Some(audio_file.clone());

        // Show status while waiting for Whisper API
        print!("Waiting for Whisper response...");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

        // Transcribe the recorded audio
        let transcription = self.client.transcribe(&temp_args).await?;

        // Clear the status line
        print!("\r\x1b[K");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

        // Clean up temporary audio file
        if audio_file.exists() {
            std::fs::remove_file(&audio_file)?;
        }

        // Show status while waiting for OpenAI enhancement
        print!("Waiting for OpenAI response...");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

        // Enhance the transcription using OpenAI
        let result = self.enhance_transcription(&transcription).await?;

        // Clear the status line
        print!("\r\x1b[K");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

        Ok(result)
    }

    async fn process_voice_recording(&self, args: &Args) -> Result<String> {
        // Record audio using voice recorder
        let audio_file = VoiceRecorder::record_with_spacebar().await?;

        // Create temporary args with the recorded file
        let mut temp_args = args.clone();
        temp_args.input = Some(audio_file.clone());

        // Show status while waiting for Whisper API
        print!("\rWaiting for Whisper response...");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

        // Transcribe the recorded audio
        let transcription = self.client.transcribe(&temp_args).await?;

        // Clear the status line
        print!("\r\x1b[K");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

        // Clean up temporary audio file
        if audio_file.exists() {
            std::fs::remove_file(&audio_file)?;
        }

        // Show status while waiting for OpenAI enhancement
        print!("\rWaiting for OpenAI response...");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

        // Enhance the transcription using OpenAI
        let result = self.enhance_transcription(&transcription).await?;

        // Clear the status line
        print!("\r\x1b[K");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

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
        let file_path = args.input.as_ref().unwrap();
        let file_size_mb = utils::bytes_to_mb(utils::get_file_size(file_path).await?);

        println!("Processing large file ({:.1} MB)...", file_size_mb);

        // Calculate file hash and handle cache validation
        let file_hash = utils::calculate_file_hash(file_path).await?;
        self.cache_manager
            .validate_and_cleanup_if_needed(&file_hash)
            .await?;

        // Split the audio file into chunks
        let chunks = self.chunker.split_audio_file(file_path).await?;

        // Create metadata file
        self.cache_manager
            .create_metadata_file(
                file_path,
                utils::get_file_size(file_path).await?,
                &file_hash,
                chunks.len(),
            )
            .await?;

        // Process each chunk with size info
        let mut transcripts = Vec::new();
        for (i, chunk_path) in chunks.iter().enumerate() {
            // Get chunk size for display
            let chunk_size = utils::get_file_size(std::path::Path::new(chunk_path)).await?;
            let chunk_size_mb = utils::bytes_to_mb(chunk_size);

            print!(
                "\r\x1b[KProcessing... {}/{} ({:.1}MB)",
                i + 1,
                chunks.len(),
                chunk_size_mb
            );
            std::io::Write::flush(&mut std::io::stdout()).unwrap();

            let text = self.process_chunk(args, chunk_path, i).await?;
            transcripts.push(text);
        }

        print!("\r\x1b[K"); // Clear from cursor to end of line

        // Clean up temporary files
        self.cache_manager.cleanup_temp_files().await?;

        // Merge transcripts
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
