use anyhow::{Context, Result};
use clap::Parser;

use murmur::{Args, MurmurProcessor};

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Initialize logging with default settings
    env_logger::init();

    // Create processor (starts Docker container for GLM ASR)
    let mut processor = MurmurProcessor::new()
        .await
        .context("Failed to initialize murmur. Is Docker installed and running?")?;

    // Set up Ctrl+C handler for graceful shutdown
    let result = tokio::select! {
        result = processor.process(&args) => result,
        _ = tokio::signal::ctrl_c() => {
            println!("\nShutting down...");
            processor.shutdown()?;
            return Ok(());
        }
    };

    // Handle result
    match result {
        Ok(transcription) => {
            processor.handle_output(&args, &transcription).await?;
        }
        Err(e) => {
            processor.shutdown()?;
            return Err(e);
        }
    }

    // Graceful shutdown
    processor.shutdown()?;

    Ok(())
}
