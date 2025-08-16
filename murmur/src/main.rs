use anyhow::{Context, Result};
use clap::Parser;

use murmur::{Args, MurmurProcessor};

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Initialize logging with default settings
    env_logger::init();

    // Load API key from environment
    dotenvy::dotenv().ok();
    let api_key = std::env::var("OPENAI_API_KEY")
        .context("OPENAI_API_KEY not found. Set it as an environment variable or in .env file")?;

    // Create processor
    let processor = MurmurProcessor::new(api_key)?;

    // Process the audio file or start voice recording/listening
    let transcription = processor.process(&args).await?;

    // Handle output based on mode and arguments
    processor.handle_output(&args, &transcription).await?;

    Ok(())
}
