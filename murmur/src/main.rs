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

    // Process the audio file or start voice recording
    let transcription = processor.process(&args).await?;

    match &args.input {
        Some(input_path) => {
            // File mode - save to file as before
            let output_path = processor.save_transcription(input_path, &transcription).await?;
            println!("Processing complete: {:?}", output_path.file_name().unwrap_or_default());
        }
        None => {
            // Voice recording mode - output to stdout
            print!("\r");
            println!("{}", transcription);
        }
    }

    Ok(())
}

